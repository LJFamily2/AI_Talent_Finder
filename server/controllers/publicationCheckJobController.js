const fs = require("fs");
const path = require("path");
const VerificationJob = require("../models/VerificationJob");
const { verifyCV } = require("./cvVerificationController");

const VALID_PRIORITY_SOURCES = [
  "googleScholar",
  "scopus",
  "openalex",
  "pubmed",
  "crossref",
];

const UPLOAD_DIR = path.join(__dirname, "../uploads");
const MAX_CONCURRENT_BATCH_JOBS = Number(
  process.env.BATCH_JOB_CONCURRENCY || 2,
);

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

async function safeUpdateJob(jobId, update) {
  try {
    await VerificationJob.updateOne({ _id: jobId }, update);
  } catch (error) {
    console.error("[Publication Check] Failed to update job:", error);
  }
}

function resolveUploadPath(storedFileName) {
  return path.join(UPLOAD_DIR, storedFileName);
}

async function deleteUploadedFile(storedFileName) {
  if (!storedFileName) return;

  try {
    await fs.promises.unlink(resolveUploadPath(storedFileName));
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("[Publication Check] Failed to delete upload:", error);
    }
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
      void runBatchJob(jobId).finally(() => {
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
  const filePath = resolveUploadPath(job.storedFileName);

  try {
    await safeUpdateJob(jobId, {
      $set: {
        status: "processing",
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const result = await verifyCV(
      {
        path: filePath,
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

    if ((await isJobCancelled(jobId)) || result?.code === "JOB_CANCELLED") {
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

    const jobs = await VerificationJob.insertMany(
      uploadedFiles.map((file) => ({
        userId: req.user._id,
        jobType: "publication-check",
        prioritySource,
        originalFileName: file.originalname,
        storedFileName: file.filename,
        fileSize: file.size || 0,
        status: "queued",
        progress: 0,
        stage: "queued",
        cancelRequested: false,
      })),
    );

    batchIo = req.app.get("io");

    jobs.forEach((job) => scheduleBatchJob(job._id.toString()));

    res.status(202).json({
      success: true,
      message:
        jobs.length > 1
          ? "Background verifications started"
          : "Background verification started",
      jobs: jobs.map((job) => serializeJob(job)),
      jobIds: jobs.map((job) => job._id.toString()),
    });
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

async function listBatchJobs(req, res) {
  try {
    const jobs = await VerificationJob.find({
      userId: req.user._id,
      jobType: "publication-check",
    })
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

    const filePath = resolveUploadPath(job.storedFileName);
    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ success: false, error: "File not found" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${path.basename(job.originalFileName)}"`,
    );
    return res.sendFile(filePath);
  } catch (error) {
    console.error("[Publication Check] Failed to stream PDF:", error);
    return res.status(500).json({
      error: "Unable to load PDF",
      message: error.message,
    });
  }
}

module.exports = {
  startBatchVerification,
  listBatchJobs,
  getBatchJob,
  getBatchJobPdf,
  cancelBatchJob,
  removeBatchJob,
};
