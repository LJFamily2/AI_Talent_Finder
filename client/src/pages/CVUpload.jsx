import React, { useCallback, useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import Header from "../components/Header";
import fileUploadIcon from "../assets/document-upload.svg";
import { useDropzone } from "react-dropzone";
import api from "../config/api";
import { useNavigate } from "react-router-dom";
import Footer from "../components/Footer";
import SimplePDFViewer from "../components/SimplePDFViewer";
import { useAuth } from "../context/AuthContext";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
} from "@mui/material";

function CVUpload() {
  const { user, loading: authLoading } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressPhase, setProgressPhase] = useState("upload"); // 'upload', 'processing', 'complete'
  const [errorInfo, setErrorInfo] = useState(null); // {message, retryable, code}
  const [uploadedFile, setUploadedFile] = useState(null); // Store the uploaded file for preview
  const [batchFiles, setBatchFiles] = useState([]);
  const [batchJobs, setBatchJobs] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchMessage, setBatchMessage] = useState("");
  const [batchError, setBatchError] = useState(null);
  const [removeConfirmJob, setRemoveConfirmJob] = useState(null);
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const fileRef = useRef(null); // Store file reference for socket callbacks

  const loadBatchJobs = useCallback(async () => {
    if (!user) {
      setBatchJobs([]);
      return;
    }

    setBatchLoading(true);
    try {
      const response = await api.get("/api/cv/batch-jobs");
      setBatchJobs(response.data.data || []);
    } catch (error) {
      console.error("Failed to load batch jobs:", error);
    } finally {
      setBatchLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadBatchJobs();
  }, [loadBatchJobs]);

  // Establish socket connection for batch job updates and join recent job rooms
  useEffect(() => {
    if (!user) return;

    const backendUrl =
      import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
    if (!socketRef.current) {
      socketRef.current = io(backendUrl, { withCredentials: true });
    }

    const socket = socketRef.current;

    const onProgress = (payload) => {
      const jobId = payload?.jobId || payload?.id || null;
      const progress = payload?.progress ?? payload?.p ?? null;
      const stage = payload?.step || payload?.stage || null;
      const status = payload?.status || null;

      if (!jobId) return;

      setBatchJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                progress: typeof progress === "number" ? progress : j.progress,
                stage: stage ?? j.stage,
                status: status ?? j.status,
                updatedAt: new Date().toISOString(),
              }
            : j,
        ),
      );
    };

    const onComplete = (payload) => {
      const jobId = payload?.jobId || payload?.id || null;
      const result = payload?.result || null;
      if (!jobId) return;

      setBatchJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                progress: 100,
                stage: "done",
                status: result?.success === false ? "failed" : "completed",
                result: result ?? j.result,
                updatedAt: new Date().toISOString(),
              }
            : j,
        ),
      );
    };

    const onError = (payload) => {
      const jobId = payload?.jobId || payload?.id || null;
      const errorMsg = payload?.error || payload?.message || null;
      if (!jobId) return;

      setBatchJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status: "failed",
                stage: payload?.stage || "failed",
                errorMessage: errorMsg ?? j.errorMessage,
                updatedAt: new Date().toISOString(),
              }
            : j,
        ),
      );
    };

    socket.on("progress", onProgress);
    socket.on("complete", onComplete);
    socket.on("error", onError);

    // When jobs are loaded, join each job room so we receive updates
    // Use an interval to ensure jobs loaded after mount are joined too
    const joinJobs = () => {
      if (!Array.isArray(batchJobs)) return;
      batchJobs.forEach((job) => {
        try {
          socket.emit("joinJob", job.id);
        } catch {
          // ignore
        }
      });
    };

    joinJobs();

    return () => {
      socket.off("progress", onProgress);
      socket.off("complete", onComplete);
      socket.off("error", onError);
    };
  }, [user, batchJobs]);

  const handleBatchLoginClick = () => {
    try {
      const target =
        window.location.pathname +
        window.location.search +
        window.location.hash;
      sessionStorage.setItem("postLoginRedirect", target);
    } catch {
      // ignore storage failures
    }
    navigate("/login");
  };

  const handleBatchUpload = useCallback(
    async (files) => {
      const filesToUpload = Array.isArray(files)
        ? files.filter(Boolean)
        : files
          ? [files]
          : [];

      if (filesToUpload.length === 0) return;

      setBatchSubmitting(true);
      setBatchError(null);
      setBatchMessage("");

      try {
        const formData = new FormData();
        filesToUpload.forEach((file) => {
          formData.append("cv", file);
        });
        formData.append("prioritySource", "scopus");

        const response = await api.post("/api/cv/batch-verify", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        await loadBatchJobs();
        setBatchFiles([]);

        const jobIds = response.data?.jobIds || [];
        if (jobIds.length === 1) {
          setBatchMessage(
            `${filesToUpload[0].name} is now verifying in the background. Check the Recent batch jobs below to track progress.`,
          );
        } else {
          setBatchMessage(
            `${jobIds.length || filesToUpload.length} CVs are now verifying in the background. Check the Recent batch jobs below to track progress.`,
          );
        }
      } catch (error) {
        console.error("Error starting batch verification:", error);
        setBatchError(
          error.response?.data?.message ||
            error.response?.data?.error ||
            error.message ||
            "Failed to start background verification.",
        );
      } finally {
        setBatchSubmitting(false);
      }
    },
    [loadBatchJobs],
  );

  const handleRemoveBatchJob = useCallback((jobId) => {
    setRemoveConfirmJob(jobId);
  }, []);

  const confirmRemoveBatchJob = useCallback(async () => {
    if (!removeConfirmJob) return;

    const jobId = removeConfirmJob;
    setRemoveConfirmJob(null);

    try {
      await api.delete(`/api/cv/batch-jobs/${jobId}`);
      await loadBatchJobs();
    } catch (error) {
      setBatchError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to remove this job.",
      );
    }
  }, [loadBatchJobs, removeConfirmJob]);

  const cancelRemoveBatchJob = useCallback(() => {
    setRemoveConfirmJob(null);
  }, []);

  const handleFileUpload = useCallback(
    async (file) => {
      setProcessing(true);
      setProgress(0);
      setProgressPhase("upload");
      setErrorInfo(null); // Clear any previous error
      setUploadedFile(file); // Store the file for preview
      fileRef.current = file; // Store file reference for socket callbacks

      try {
        const formData = new FormData();
        formData.append("cv", file);

        // Start with upload progress (0-20%)
        const response = await api.post("/api/cv/verify-cv", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (e) => {
            const uploadPercent = Math.round((e.loaded * 100) / e.total);
            setProgress(Math.round(Math.min(uploadPercent * 0.2, 20))); // Round to ensure integer
          },
        });

        // Connect to socket.io server
        if (!socketRef.current) {
          // Use Vite env variable for backend URL
          const backendUrl =
            import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
          socketRef.current = io(backendUrl, {
            withCredentials: true,
          });
        }

        const { jobId } = response.data;
        setProgressPhase("processing");

        // Join the job room
        socketRef.current.emit("joinJob", jobId);

        // Listen for progress updates
        socketRef.current.on("progress", (data) => {
          // Progress from backend is 10-100, map to 20-100 for UI
          const mapped = 20 + ((data.progress - 10) * 80) / 90;
          setProgress(Math.round(mapped));
        });

        socketRef.current.on("complete", (data) => {
          setProgress(100);
          setProgressPhase("complete");
          setTimeout(() => {
            setProcessing(false);
            navigate("/publication-check/results", {
              state: {
                publications: data.result,
                originalFile: fileRef.current,
              },
            });
            setUploadedFile(null); // Clear the file after navigation
            fileRef.current = null; // Clear the file reference
          }, 1000);
        });

        socketRef.current.on("error", (data) => {
          setProcessing(false);
          setProgress(0);
          setUploadedFile(null); // Clear the file on error
          fileRef.current = null; // Clear the file reference
          setErrorInfo({
            message:
              data.error ||
              "An unexpected error occurred during CV verification.",
            retryable: data.retryable || false,
            code: data.code,
          });
        });
      } catch (error) {
        console.error("Error verifying CV:", error);
        setProcessing(false);
        setProgress(0);
        setUploadedFile(null); // Clear the file on error
        fileRef.current = null; // Clear the file reference
        setErrorInfo({
          message:
            error.response?.data?.error ||
            error.message ||
            "Failed to start verification.",
          retryable: false,
        });
      }
    },
    [navigate],
  );

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // const handleFileChange = (event) => {
  //   const file = event.target.files?.[0];
  //   if (file) {
  //     console.log("Selected file:", file.name);
  //     handleFileUpload(file);
  //   }
  // };

  const onDrop = useCallback(
    (acceptedFiles, rejectedFiles) => {
      // Check for rejected files first
      if (rejectedFiles && rejectedFiles.length > 0) {
        const rejectedFile = rejectedFiles[0];
        const errorMessage =
          rejectedFile.errors[0]?.code === "file-invalid-type"
            ? `Invalid file type. Only PDF files are allowed. You uploaded: ${
                rejectedFile.file.type || "unknown type"
              }`
            : `File rejected: ${
                rejectedFile.errors[0]?.message || "Unknown error"
              }`;

        setErrorInfo({
          message: errorMessage,
          retryable: false,
          code: "INVALID_FILE_TYPE",
        });
        setUploadedFile(null); // Clear any previous file
        return;
      }

      const file = acceptedFiles[0];

      if (file) {
        // Additional validation to ensure it's a PDF
        if (file.type !== "application/pdf") {
          setErrorInfo({
            message: `Invalid file type. Only PDF files are allowed. You uploaded: ${
              file.type || "unknown type"
            }`,
            retryable: false,
            code: "INVALID_FILE_TYPE",
          });
          setUploadedFile(null); // Clear any previous file
          return;
        }

        handleFileUpload(file);
      }
    },
    [handleFileUpload],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
    multiple: false,
    maxFiles: 1,
  });

  return (
    <div className="w-full min-h-screen">
      <Header />
      <div className="flex flex-col items-center w-full min-h-screen pt-20 pb-8 px-4">
        <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-7 text-center">
          Verify publications from uploaded CV
        </h2>

        <div className="w-full max-w-4xl mb-8 mx-4 rounded-2xl border border-blue-200 bg-blue-50/70 p-5 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                Batch verification
              </p>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                {user
                  ? "Upload once, keep verifying in the background"
                  : "Sign in to verify publication in batch"}
              </h3>
              <p className="text-sm sm:text-base text-slate-700 mt-2">
                {user
                  ? "Your batch jobs are saved to your account, so you can leave the page and come back later to check the status or results."
                  : "Account mode keeps your CV verification job running and saves the result history for later review."}
              </p>
            </div>

            {!user && !authLoading ? (
              <button
                className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                onClick={handleBatchLoginClick}
              >
                Sign in to start batch verification
              </button>
            ) : null}
          </div>

          {user ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
              <div className="rounded-xl border border-blue-200 bg-white p-4 sm:p-5">
                <label className="block text-sm font-semibold text-slate-800 mb-2">
                  Batch CV file
                </label>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
                  onChange={(event) => {
                    const selectedFiles = Array.from(event.target.files || []);
                    const invalidFile = selectedFiles.find(
                      (file) => file.type !== "application/pdf",
                    );

                    if (invalidFile) {
                      setBatchError(
                        "Only PDF files are allowed for batch verification.",
                      );
                      setBatchFiles([]);
                      return;
                    }

                    setBatchError(null);
                    setBatchFiles(selectedFiles);
                  }}
                />
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    className="inline-flex items-center justify-center rounded-full bg-[#000054] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                    disabled={batchFiles.length === 0 || batchSubmitting}
                    onClick={() => handleBatchUpload(batchFiles)}
                  >
                    {batchSubmitting
                      ? "Starting batch..."
                      : batchFiles.length > 1
                        ? `Start ${batchFiles.length} background verifications`
                        : "Start background verification"}
                  </button>
                  {batchFiles.length > 0 ? (
                    <span className="text-sm text-slate-600 break-all">
                      Selected: {batchFiles.map((file) => file.name).join(", ")}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-500">
                      Choose one or more PDFs to launch saved background jobs.
                    </span>
                  )}
                </div>
                {batchError && (
                  <p className="mt-3 text-sm text-red-600">{batchError}</p>
                )}
                {batchMessage && (
                  <p className="mt-3 text-sm text-green-700">{batchMessage}</p>
                )}
              </div>

              <div className="rounded-xl border border-blue-200 bg-white p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h4 className="text-sm font-semibold text-slate-800">
                    Recent batch jobs
                  </h4>
                  <button
                    className="text-xs font-medium text-blue-700 hover:underline"
                    onClick={loadBatchJobs}
                  >
                    Refresh
                  </button>
                </div>
                {batchLoading ? (
                  <p className="text-sm text-slate-500">Loading jobs...</p>
                ) : batchJobs.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No batch jobs yet. Upload a PDF to start one.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-auto pr-1">
                    {batchJobs.map((job) => (
                      <div
                        key={job.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-slate-900 break-all">
                              {job.originalFileName}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {job.status} • {job.progress}% • {job.stage}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <button
                              type="button"
                              className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap"
                              onClick={() =>
                                navigate(`/publication-check/results/${job.id}`)
                              }
                            >
                              Open
                            </button>
                            {job.status === "queued" ||
                            job.status === "processing" ? (
                              <button
                                className="text-xs font-semibold text-amber-700 hover:underline whitespace-nowrap"
                                onClick={() => handleRemoveBatchJob(job.id)}
                              >
                                Cancel
                              </button>
                            ) : null}
                            <button
                              className="text-xs font-semibold text-red-700 hover:underline whitespace-nowrap"
                              onClick={() => handleRemoveBatchJob(job.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <Dialog
          open={Boolean(removeConfirmJob)}
          onClose={cancelRemoveBatchJob}
          aria-labelledby="remove-batch-job-title"
          aria-describedby="remove-batch-job-description"
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle id="remove-batch-job-title">
            Remove batch job?
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="remove-batch-job-description">
              This will delete the saved job and its uploaded file. You cannot
              undo this action.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={cancelRemoveBatchJob}>Cancel</Button>
            <Button
              onClick={confirmRemoveBatchJob}
              color="error"
              variant="contained"
            >
              Remove
            </Button>
          </DialogActions>
        </Dialog>

        {errorInfo && (
          <div className="w-full max-w-2xl mb-6 p-4 rounded-xl border border-red-300 bg-red-50 text-red-700 text-sm mx-4">
            <p className="font-semibold mb-1">Verification Error</p>
            <p>{errorInfo.message}</p>
            {errorInfo.retryable && (
              <p className="mt-2 text-xs">
                The AI model was temporarily unavailable (code: {errorInfo.code}
                ). Please wait a moment and try uploading your CV again.
              </p>
            )}
            <button
              className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs"
              onClick={() => setErrorInfo(null)}
            >
              Dismiss
            </button>
          </div>
        )}
        <div
          className={`${
            isDragActive ? "bg-blue-100" : "bg-white"
          } border-dashed border-2 border-gray-400 rounded-2xl sm:rounded-[3vw] md:rounded-[5vw] flex flex-col items-center justify-center w-full max-w-4xl mx-4 min-h-[300px] sm:min-h-[400px] md:h-2/3 p-6 sm:p-8`}
          {...getRootProps()}
        >
          <input {...getInputProps()} />
          <img
            src={fileUploadIcon}
            alt="Upload Icon"
            className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 mb-6 sm:mb-8"
          />
          <span className="font-bold text-lg sm:text-xl md:text-2xl text-center mx-2 sm:mx-5">
            Drop your file here, or{" "}
            <span className="text-blue-400 underline cursor-pointer">
              Browse
            </span>
          </span>

          <p className="text-gray-400 mt-3 sm:mt-4 text-sm sm:text-base text-center">
            Accepted file formats: .pdf
          </p>
        </div>
      </div>

      {processing && uploadedFile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-6xl bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gray-50 px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-800">
                Processing Your CV
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {progressPhase === "upload" && "Uploading your file..."}
                {progressPhase === "processing" && "Analyzing CV content..."}
                {progressPhase === "complete" && "Finalizing results..."}
              </p>
            </div>

            {/* Content */}
            <div className="flex flex-col lg:flex-row h-[70vh]">
              {/* PDF Preview */}
              <div className="flex-1 p-6 bg-gray-50">
                <div className="h-full min-h-[600px] rounded border border-gray-200 overflow-hidden">
                  <SimplePDFViewer file={uploadedFile} className="h-full" />
                </div>
              </div>

              {/* Progress Panel */}
              <div className="lg:w-80 p-6 bg-white border-l flex flex-col justify-center">
                <div className="text-center">
                  {/* Large Circular Progress */}
                  <div className="relative w-32 h-32 mx-auto mb-6">
                    {/* Background circle with subtle animation */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 animate-pulse"></div>

                    <svg
                      className="w-full h-full transform -rotate-90 relative z-10"
                      viewBox="0 0 120 120"
                    >
                      <circle
                        className="text-gray-200"
                        strokeWidth="8"
                        stroke="currentColor"
                        fill="transparent"
                        r="52"
                        cx="60"
                        cy="60"
                      />
                      <circle
                        className="text-blue-500 transition-all duration-700 ease-out"
                        strokeWidth="8"
                        strokeDasharray={2 * Math.PI * 52}
                        strokeDashoffset={
                          2 * Math.PI * 52 * (1 - progress / 100)
                        }
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                        r="52"
                        cx="60"
                        cy="60"
                        style={{
                          filter:
                            "drop-shadow(0 0 6px rgba(59, 130, 246, 0.4))",
                        }}
                      />
                    </svg>

                    <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-gray-800 z-20">
                      <span className="animate-pulse">{progress}%</span>
                    </div>

                    {/* Rotating outer ring */}
                    <div className="absolute inset-0 border-2 border-transparent border-t-blue-300 rounded-full animate-spin opacity-30"></div>
                  </div>

                  {/* Status Text with animations */}
                  <div className="mb-6">
                    <h4 className="text-xl font-semibold text-gray-800 mb-2 transition-all duration-300">
                      {progressPhase === "upload" && (
                        <span className="inline-flex items-center">
                          <span className="animate-bounce mr-2">📤</span>
                          Uploading...
                        </span>
                      )}
                      {progressPhase === "processing" && (
                        <span className="inline-flex items-center">
                          <span className=" mr-2">🔍</span>
                          Analyzing...
                        </span>
                      )}
                      {progressPhase === "complete" && (
                        <span className="inline-flex items-center">
                          <span className="animate-pulse mr-2">✅</span>
                          Almost Done!
                        </span>
                      )}
                    </h4>
                    <p className="text-gray-600 transition-opacity duration-300">
                      {progressPhase === "upload" &&
                        "Preparing your CV for analysis"}
                      {progressPhase === "processing" &&
                        "Extracting and verifying publications"}
                      {progressPhase === "complete" && "Preparing your results"}
                    </p>
                  </div>

                  {/* Progress Steps with enhanced animations */}
                  <div className="space-y-3">
                    <div
                      className={`flex items-center text-sm transition-all duration-500 ${
                        progress >= 20
                          ? "text-green-600 transform translate-x-2"
                          : "text-gray-400"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full mr-3 transition-all duration-500 ${
                          progress >= 20
                            ? "bg-green-500 scale-110 shadow-lg shadow-green-500/30"
                            : "bg-gray-300"
                        }`}
                      >
                        {progress >= 20 && (
                          <div className="w-full h-full rounded-full bg-green-400 animate-ping opacity-75"></div>
                        )}
                      </div>
                      <span
                        className={`transition-all duration-300 ${
                          progress >= 20 ? "font-medium" : ""
                        }`}
                      >
                        File Upload Complete
                        {progress >= 20 && (
                          <span className="ml-2 text-xs">✓</span>
                        )}
                      </span>
                    </div>

                    <div
                      className={`flex items-center text-sm transition-all duration-500 ${
                        progress >= 50
                          ? "text-green-600 transform translate-x-2"
                          : "text-gray-400"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full mr-3 transition-all duration-500 ${
                          progress >= 50
                            ? "bg-green-500 scale-110 shadow-lg shadow-green-500/30"
                            : "bg-gray-300"
                        }`}
                      >
                        {progress >= 50 && (
                          <div className="w-full h-full rounded-full bg-green-400 animate-ping opacity-75"></div>
                        )}
                      </div>
                      <span
                        className={`transition-all duration-300 ${
                          progress >= 50 ? "font-medium" : ""
                        }`}
                      >
                        Text Extraction
                        {progress >= 50 && (
                          <span className="ml-2 text-xs">✓</span>
                        )}
                      </span>
                    </div>

                    <div
                      className={`flex items-center text-sm transition-all duration-500 ${
                        progress >= 80
                          ? "text-green-600 transform translate-x-2"
                          : "text-gray-400"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full mr-3 transition-all duration-500 ${
                          progress >= 80
                            ? "bg-green-500 scale-110 shadow-lg shadow-green-500/30"
                            : "bg-gray-300"
                        }`}
                      >
                        {progress >= 80 && (
                          <div className="w-full h-full rounded-full bg-green-400 animate-ping opacity-75"></div>
                        )}
                      </div>
                      <span
                        className={`transition-all duration-300 ${
                          progress >= 80 ? "font-medium" : ""
                        }`}
                      >
                        Publication Verification
                        {progress >= 80 && (
                          <span className="ml-2 text-xs">✓</span>
                        )}
                      </span>
                    </div>

                    <div
                      className={`flex items-center text-sm transition-all duration-500 ${
                        progress >= 100
                          ? "text-green-600 transform translate-x-2"
                          : "text-gray-400"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full mr-3 transition-all duration-500 ${
                          progress >= 100
                            ? "bg-green-500 scale-110 shadow-lg shadow-green-500/30"
                            : "bg-gray-300"
                        }`}
                      >
                        {progress >= 100 && (
                          <div className="w-full h-full rounded-full bg-green-400 animate-ping opacity-75"></div>
                        )}
                      </div>
                      <span
                        className={`transition-all duration-300 ${
                          progress >= 100 ? "font-medium" : ""
                        }`}
                      >
                        Results Ready
                        {progress >= 100 && (
                          <span className="ml-2 text-xs">✓</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {progressPhase === "processing" && (
                    <p className="text-gray-400 text-xs mt-6">
                      This may take up to 90 seconds for complex documents
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default CVUpload;
