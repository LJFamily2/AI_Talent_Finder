const path = require("path");
const VerificationJob = require("../models/VerificationJob");
const { verifyCV } = require("./cvVerificationController");
const {
  uploadToSupabase,
  deleteFromSupabase,
  getSignedUrl,
  generateStoredFileName,
} = require("../utils/supabaseStorage");

const VALID_PRIORITY_SOURCES = [
  "googleScholar",
  "scopus",
  "openalex",
  "pubmed",
  "crossref",
];

const MAX_CONCURRENT_BATCH_JOBS = Number(
  process.env.BATCH_JOB_CONCURRENCY || 2,
);

// Global timeout for a single verification job (10 minutes)
const VERIFICATION_TIMEOUT_MS = 10 * 60 * 1000;

const queuedBatchJobIds = [];
const activeBatchJobIds = new Set();
let queueDrainInProgress = false;
let batchIo = null;

function serializeJob(job) {
  if (!job) return null;

  return {
    id: job._id.toString(),
    _id: job._id,
    userId: job.userId,
    jobType: job.jobType,
    prioritySource: job.prioritySource,
    originalFileName: job.originalFileName,
    storedFileName: job.storedFileName,
    fileSize: job.fileSize,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    result: job.result,
    errorMessage: job.errorMessage,
    errorCode: job.errorCode,
    retryable: job.retryable,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function buildComparisonSummary(job) {
  const result = job?.result || null;
  const displayItems = Array.isArray(result?.results)
    ? result.results
        .map((item) => item?.verification?.displayData)
        .filter(Boolean)
    : [];

  const statusCounts = {
    verified: 0,
    verifiedDifferentAuthor: 0,
    notVerified: 0,
  };
  const yearCounts = {};
  const typeCounts = {};
  let totalCitations = 0;

  displayItems.forEach((item) => {
    const status = String(item.status || "").toLowerCase();
    if (status.startsWith("verified but not same")) {
      statusCounts.verifiedDifferentAuthor += 1;
    } else if (status.startsWith("verified")) {
      statusCounts.verified += 1;
    } else {
      statusCounts.notVerified += 1;
    }

    const year = parseInt(item.year, 10);
    if (!Number.isNaN(year)) {
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    }

    const type = String(item.type || "")
      .trim()
      .toLowerCase();
    if (type) {
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }

    const cited = parseInt(item.citedBy, 10);
    if (!Number.isNaN(cited)) {
      totalCitations += cited;
    }
  });

  const topTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));

  const yearlyTrend = Object.entries(yearCounts)
    .map(([year, count]) => ({ year: Number(year), count }))
    .sort((a, b) => a.year - b.year);

  return {
    jobId: job._id.toString(),
    originalFileName: job.originalFileName,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    prioritySource: job.prioritySource,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    candidateName: result?.candidateName || null,
    totals: {
      publications: displayItems.length,
      verified: statusCounts.verified,
      verifiedDifferentAuthor: statusCounts.verifiedDifferentAuthor,
      notVerified: statusCounts.notVerified,
    },
    citations: {
      total: totalCitations,
    },
    authorMetrics: result?.authorDetails?.metrics || null,
    authorName: result?.authorDetails?.author?.name || null,
    topTypes,
    yearlyTrend,
  };
}

async function safeUpdateJob(jobId, update) {
  try {
    await VerificationJob.updateOne({ _id: jobId }, update);
  } catch (error) {
    console.error("[Publication Check] Failed to update job:", error);
  }
}

async function deleteUploadedFile(storedFileName) {
  if (!storedFileName) return;

  try {
    await deleteFromSupabase(storedFileName);
  } catch (error) {
    console.error(
      "[Publication Check] Failed to delete upload from Supabase:",
      error,
    );
  }
}

async function isJobCancelled(jobId) {
  const job = await VerificationJob.findById(jobId)
    .select("cancelRequested status")
    .lean();

  return !job || job.cancelRequested || job.status === "canceled";
}

function scheduleBatchJob(jobId) {
  if (queuedBatchJobIds.includes(jobId) || activeBatchJobIds.has(jobId)) {
    return;
  }

  queuedBatchJobIds.push(jobId);
  void drainBatchQueue();
}

function unscheduleBatchJob(jobId) {
  const queueIndex = queuedBatchJobIds.indexOf(jobId);
  if (queueIndex >= 0) {
    queuedBatchJobIds.splice(queueIndex, 1);
  }
}

async function drainBatchQueue() {
  if (queueDrainInProgress) return;

  queueDrainInProgress = true;
  try {
    while (
      activeBatchJobIds.size < MAX_CONCURRENT_BATCH_JOBS &&
      queuedBatchJobIds.length > 0
    ) {
      const jobId = queuedBatchJobIds.shift();
      if (!jobId) {
        continue;
      }

      activeBatchJobIds.add(jobId);
      void runBatchJob(jobId)
        .catch((err) => {
          console.error(
            `[Publication Check] Unhandled error in job ${jobId}:`,
            err,
          );
        })
        .finally(() => {
          activeBatchJobIds.delete(jobId);
          void drainBatchQueue();
        });
    }
  } finally {
    queueDrainInProgress = false;
  }
}

async function runBatchJob(jobId) {
  const job = await VerificationJob.findById(jobId).lean();
  if (!job) return;

  if (job.cancelRequested || job.status === "canceled") {
    await deleteUploadedFile(job.storedFileName);
    return;
  }

  const proxyIo = createJobIoProxy(batchIo, jobId);

  // Set up a timeout to prevent jobs from hanging indefinitely
  let timeoutId = null;
  let timedOut = false;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      reject(
        new Error(
          `Verification timed out after ${VERIFICATION_TIMEOUT_MS / 1000 / 60} minutes`,
        ),
      );
    }, VERIFICATION_TIMEOUT_MS);
  });

  try {
    await safeUpdateJob(jobId, {
      $set: {
        status: "processing",
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const verifyPromise = verifyCV(
      {
        storedFileName: job.storedFileName,
        filename: job.storedFileName,
        originalname: job.originalFileName,
        size: job.fileSize,
      },
      job.prioritySource,
      {
        jobId,
        io: proxyIo,
        shouldCancel: () => isJobCancelled(jobId),
        keepFile: true,
      },
    );

    // Race between verification and timeout
    const result = await Promise.race([verifyPromise, timeoutPromise]);

    // Clear the timeout if verification completed
    if (timeoutId) clearTimeout(timeoutId);

    if (
      timedOut ||
      (await isJobCancelled(jobId)) ||
      result?.code === "JOB_CANCELLED"
    ) {
      await safeUpdateJob(jobId, {
        $set: {
          status: "canceled",
          progress: 100,
          stage: "canceled",
          errorMessage: null,
          errorCode: null,
          retryable: false,
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      });
      return;
    }

    if (result && result.success === false) {
      await safeUpdateJob(jobId, {
        $set: {
          status: "failed",
          progress: 100,
          completedAt: new Date(),
          stage: result.stage || "failed",
          errorMessage: result.error || "Verification failed",
          errorCode: result.code || null,
          retryable: Boolean(result.retryable),
          updatedAt: new Date(),
        },
      });
      return;
    }

    await safeUpdateJob(jobId, {
      $set: {
        status: "completed",
        progress: 100,
        stage: "done",
        result,
        errorMessage: null,
        errorCode: null,
        retryable: false,
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    // Clear the timeout on error
    if (timeoutId) clearTimeout(timeoutId);

    if (timedOut) {
      console.error(`[Publication Check] Job ${jobId} timed out`);
      await safeUpdateJob(jobId, {
        $set: {
          status: "failed",
          progress: 100,
          completedAt: new Date(),
          stage: "timeout",
          errorMessage: `Verification timed out after ${VERIFICATION_TIMEOUT_MS / 1000 / 60} minutes`,
          errorCode: "VERIFICATION_TIMEOUT",
          retryable: true,
          updatedAt: new Date(),
        },
      });
      return;
    }

    if (await isJobCancelled(jobId)) {
      await safeUpdateJob(jobId, {
        $set: {
          status: "canceled",
          progress: 100,
          stage: "canceled",
          errorMessage: null,
          errorCode: null,
          retryable: false,
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      });
      return;
    }

    console.error("[Publication Check] Batch verification failed:", error);
    await safeUpdateJob(jobId, {
      $set: {
        status: "failed",
        progress: 100,
        stage: "failed",
        errorMessage: error.message,
        errorCode: "BATCH_VERIFICATION_FAILED",
        retryable: false,
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } finally {
    // Keep the uploaded file for later PDF viewing; cleanup happens on removal.
  }
}

function createJobIoProxy(realIo, jobId) {
  return {
    to(room) {
      const targetRoom = room || jobId;

      return {
        emit(event, payload) {
          if (event === "progress") {
            safeUpdateJob(jobId, {
              $set: {
                status: "processing",
                progress: payload?.progress ?? 0,
                stage: payload?.step || "processing",
                updatedAt: new Date(),
              },
            });
          }

          if (event === "error") {
            safeUpdateJob(jobId, {
              $set: {
                status: "failed",
                progress: 100, // Mark as complete (failed) so it doesn't appear stuck
                errorMessage: payload?.error || "Verification failed",
                errorCode: payload?.code || null,
                retryable: Boolean(payload?.retryable),
                stage: payload?.stage || "failed",
                updatedAt: new Date(),
              },
            });
          }

          if (realIo) {
            try {
              // Ensure payload includes jobId so clients can correlate events
              const out =
                payload &&
                typeof payload === "object" &&
                !Array.isArray(payload)
                  ? { jobId: jobId, ...payload }
                  : { jobId: jobId, payload };

              realIo.to(targetRoom).emit(event, out);
            } catch (e) {
              // Fallback to original emit if something goes wrong
              realIo.to(targetRoom).emit(event, payload);
            }
          }
        },
      };
    },
  };
}

async function startBatchVerification(req, res) {
  try {
    const uploadedFiles = Array.isArray(req.files)
      ? req.files
      : req.file
        ? [req.file]
        : [];

    if (uploadedFiles.length === 0) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const prioritySource = req.body.prioritySource || "scopus";
    if (!VALID_PRIORITY_SOURCES.includes(prioritySource)) {
      return res.status(400).json({
        error: "Invalid priority source",
        message:
          "Priority source must be one of: googleScholar, scopus, openalex, pubmed, crossref",
        providedValue: prioritySource,
      });
    }

    // Prepare job data - files are in memory buffers at this point
    const jobData = uploadedFiles.map((file) => {
      const storedFileName = generateStoredFileName(file.originalname);
      return {
        userId: req.user._id,
        jobType: "publication-check",
        prioritySource,
        originalFileName: file.originalname,
        storedFileName: storedFileName, // Pre-generate the name
        fileSize: file.size || 0,
        status: "uploading", // Initial status is uploading
        progress: 0,
        stage: "uploading",
        cancelRequested: false,
      };
    });

    const jobs = await VerificationJob.insertMany(jobData);
    batchIo = req.app.get("io");

    // Send immediate response to the client
    res.status(202).json({
      success: true,
      message:
        jobs.length > 1
          ? "Background verifications started"
          : "Background verification started",
      jobs: jobs.map((job) => serializeJob(job)),
      jobIds: jobs.map((job) => job._id.toString()),
    });

    // Start background process: Upload to Supabase then schedule
    (async () => {
      try {
        await Promise.all(
          jobs.map(async (job, index) => {
            const file = uploadedFiles[index];

            // 1. Upload the buffer to Supabase
            const { error: uploadError } = await uploadToSupabase(
              file.buffer,
              job.storedFileName,
              file.mimetype,
            );

            if (uploadError) {
              console.error(
                `[Publication Check] Background upload failed for ${job.originalFileName}:`,
                uploadError,
              );
              await safeUpdateJob(job._id, {
                $set: {
                  status: "failed",
                  stage: "upload_failed",
                  errorMessage: "Failed to upload file to cloud storage",
                },
              });
              return;
            }

            // 2. Update job status to queued
            await safeUpdateJob(job._id, {
              $set: {
                status: "queued",
                stage: "queued",
              },
            });

            // 3. Schedule for processing
            scheduleBatchJob(job._id.toString());
          }),
        );
      } catch (bgError) {
        console.error(
          "[Publication Check] Critical error in background upload process:",
          bgError,
        );
      }
    })();
  } catch (error) {
    console.error(
      "[Publication Check] Could not start batch verification:",
      error,
    );
    res.status(500).json({
      error: "Unable to start background verification",
      message: error.message,
    });
  }
}

/**
 * Initializes the batch job queue on server start
 * Picks up any 'queued' or 'processing' jobs from database
 */
async function initBatchQueue(io) {
  try {
    batchIo = io;
    console.log("[Publication Check] Initializing background job queue...");

    // Find all jobs that should be in the queue
    const pendingJobs = await VerificationJob.find({
      status: { $in: ["queued", "processing", "uploading"] },
      jobType: "publication-check",
    });

    if (pendingJobs.length === 0) {
      return;
    }

    console.log(
      `[Publication Check] Found ${pendingJobs.length} pending jobs to resume.`,
    );

    for (const job of pendingJobs) {
      if (job.status === "processing" || job.status === "uploading") {
        // Reset to queued for a fresh start on server reboot
        // Unless it was uploading and we don't have the buffer anymore...
        // If it was 'uploading' when server crashed, we don't have the buffer, so it must fail.
        if (job.status === "uploading") {
          await safeUpdateJob(job._id, {
            $set: {
              status: "failed",
              stage: "failed",
              errorMessage: "Upload interrupted by server restart",
            },
          });
          continue;
        }

        await safeUpdateJob(job._id, {
          $set: {
            status: "queued",
            stage: "resumed",
          },
        });
      }

      scheduleBatchJob(job._id.toString());
    }
  } catch (error) {
    console.error("[Publication Check] Queue initialization failed:", error);
  }
}

async function listBatchJobs(req, res) {
  try {
    const jobs = await VerificationJob.find({
      userId: req.user._id,
      jobType: "publication-check",
    })
      .select("-result") // Exclude large result field for better performance
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({
      success: true,
      data: jobs.map((job) => serializeJob(job)),
    });
  } catch (error) {
    console.error("[Publication Check] Failed to list jobs:", error);
    res.status(500).json({
      error: "Unable to load batch jobs",
      message: error.message,
    });
  }
}

async function getBatchJobComparison(req, res) {
  try {
    const rawIds = req.query.ids;
    const ids = Array.isArray(rawIds)
      ? rawIds
      : typeof rawIds === "string"
        ? rawIds.split(",")
        : [];

    const uniqueIds = [...new Set(ids.map((id) => String(id).trim()))].filter(
      Boolean,
    );

    if (uniqueIds.length === 0) {
      return res.status(400).json({
        error: "No job IDs provided",
        message: "Provide 1 to 3 job IDs for comparison.",
      });
    }

    if (uniqueIds.length > 3) {
      return res.status(400).json({
        error: "Too many jobs",
        message: "You can only compare up to 3 CVs at a time.",
      });
    }

    const jobs = await VerificationJob.find({
      _id: { $in: uniqueIds },
      userId: req.user._id,
      jobType: "publication-check",
    })
      .select(
        "originalFileName status stage progress prioritySource createdAt completedAt result",
      )
      .lean();

    const summaries = jobs.map((job) => buildComparisonSummary(job));
    const foundIds = new Set(jobs.map((job) => job._id.toString()));
    const missingIds = uniqueIds.filter((id) => !foundIds.has(id));

    return res.json({
      success: true,
      data: summaries,
      missingIds,
    });
  } catch (error) {
    console.error("[Publication Check] Failed to load comparison:", error);
    return res.status(500).json({
      error: "Unable to load comparison",
      message: error.message,
    });
  }
}

async function getBatchJob(req, res) {
  try {
    const job = await VerificationJob.findOne({
      _id: req.params.jobId,
      userId: req.user._id,
      jobType: "publication-check",
    }).lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    res.json({
      success: true,
      data: serializeJob(job),
    });
  } catch (error) {
    console.error("[Publication Check] Failed to load job:", error);
    res.status(500).json({
      error: "Unable to load batch job",
      message: error.message,
    });
  }
}

async function cancelBatchJob(req, res) {
  try {
    const job = await VerificationJob.findOne({
      _id: req.params.jobId,
      userId: req.user._id,
      jobType: "publication-check",
    });

    if (!job) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }

    await VerificationJob.updateOne(
      { _id: job._id },
      {
        $set: {
          cancelRequested: true,
          status: "canceled",
          progress: 100,
          stage: "canceled",
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );
    unscheduleBatchJob(job._id.toString());

    return res.json({
      success: true,
      data: serializeJob({
        ...job.toObject(),
        cancelRequested: true,
        status: "canceled",
        progress: 100,
        stage: "canceled",
      }),
    });
  } catch (error) {
    console.error("[Publication Check] Failed to cancel job:", error);
    res.status(500).json({
      error: "Unable to cancel batch job",
      message: error.message,
    });
  }
}

async function removeBatchJob(req, res) {
  try {
    const job = await VerificationJob.findOne({
      _id: req.params.jobId,
      userId: req.user._id,
      jobType: "publication-check",
    });

    if (!job) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }

    await VerificationJob.updateOne(
      { _id: job._id },
      { $set: { cancelRequested: true, status: "canceled" } },
    );
    unscheduleBatchJob(job._id.toString());
    await VerificationJob.deleteOne({ _id: job._id });
    await deleteUploadedFile(job.storedFileName);

    return res.json({ success: true, removed: true });
  } catch (error) {
    console.error("[Publication Check] Failed to remove job:", error);
    res.status(500).json({
      error: "Unable to remove batch job",
      message: error.message,
    });
  }
}

async function getBatchJobPdf(req, res) {
  try {
    const job = await VerificationJob.findOne({
      _id: req.params.jobId,
      userId: req.user._id,
      jobType: "publication-check",
    }).lean();

    if (!job) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }

    if (!job.storedFileName) {
      return res
        .status(404)
        .json({ success: false, error: "No file available" });
    }

    // Generate a signed URL for the PDF in Supabase Storage
    // Expiration set to 300 seconds (5 minutes)
    const { signedUrl, error } = await getSignedUrl(job.storedFileName, 300);

    if (error || !signedUrl) {
      console.error(
        "[Publication Check] Failed to generate signed URL:",
        error,
      );
      return res.status(500).json({
        success: false,
        error: "Unable to generate secure viewing link",
      });
    }

    // Return the signed URL instead of streaming the file
    return res.json({
      success: true,
      url: signedUrl,
      originalName: job.originalFileName,
    });
  } catch (error) {
    console.error("[Publication Check] Failed to get signed PDF URL:", error);
    return res.status(500).json({
      error: "Unable to load PDF",
      message: error.message,
    });
  }
}

module.exports = {
  startBatchVerification,
  listBatchJobs,
  getBatchJobComparison,
  getBatchJob,
  getBatchJobPdf,
  cancelBatchJob,
  removeBatchJob,
  initBatchQueue,
};
