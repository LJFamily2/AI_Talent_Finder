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
  const showSingleUpload = !authLoading && !user;
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressPhase, setProgressPhase] = useState("upload"); // 'upload', 'processing', 'complete'
  const [errorInfo, setErrorInfo] = useState(null); // {message, retryable, code}
  const [uploadedFile, setUploadedFile] = useState(null); // Store the uploaded file for preview
  const [batchFiles, setBatchFiles] = useState([]);
  const [batchJobs, setBatchJobs] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
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

  const joinedJobsRef = useRef(new Set());

  // Establish socket connection for batch job updates
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

    return () => {
      socket.off("progress", onProgress);
      socket.off("complete", onComplete);
      socket.off("error", onError);
    };
  }, [user]);

  // Handle joining job rooms when new jobs are loaded
  useEffect(() => {
    if (!socketRef.current || !Array.isArray(batchJobs)) return;

    const socket = socketRef.current;

    batchJobs.forEach((job) => {
      if (!joinedJobsRef.current.has(job.id)) {
        try {
          socket.emit("joinJob", job.id);
          joinedJobsRef.current.add(job.id);
        } catch (err) {
          console.warn("Failed to join job room:", err);
        }
      }
    });
  }, [batchJobs]);

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

      try {
        const formData = new FormData();
        filesToUpload.forEach((file) => {
          formData.append("cv", file);
        });
        formData.append("prioritySource", "scopus");

        await api.post("/api/cv/batch-verify", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        await loadBatchJobs();
        setBatchFiles([]);
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

  const { getRootProps, getInputProps } = useDropzone({
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
      <div className="flex flex-col items-center w-full min-h-screen pt-20 pb-16 px-4 bg-[#f8fafc]">
        <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-7 text-center">
          Verify CV Publications
        </h2>

        {/* Redesigned Batch Verification Section */}
        <div className="w-full max-w-6xl mb-12 mx-4 bg-white/90 backdrop-blur-xl rounded-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)] border border-slate-200/60 overflow-hidden transition-all duration-500">
          <div className="bg-[#000054] p-8 sm:p-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-100 mb-2 px-3 py-1 bg-[#E60028] rounded-none w-max">
                  Batch Verification
                </p>
                <h3 className="text-3xl font-extrabold text-white tracking-tight mb-2">
                  {user
                    ? "Scale your verification"
                    : "Sign in for batch processing"}
                </h3>
                <p className="text-slate-100/80 mt-1 max-w-md leading-relaxed">
                  {user
                    ? "Upload multiple CVs and let our AI process them in the background while you work."
                    : "Create an account to verify up to 10 CVs simultaneously and track their progress."}
                </p>
              </div>
              {!user && !authLoading && (
                <button
                  className="inline-flex items-center justify-center rounded-none bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg  hover:bg-blue-700 hover:-translate-y-0.5 transition-all cursor-pointer"
                  onClick={handleBatchLoginClick}
                >
                  Get Started with Batch
                </button>
              )}
            </div>
          </div>

          {user && (
            <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 bg-white">
              {/* Left Column: Upload Zone */}
              <div className="p-8 sm:p-10 flex flex-col h-full">
                <div className="flex flex-col h-full">
                  <div className="mb-6 flex items-start justify-between">
                    <div>
                      <h4 className="text-xl font-bold text-[#000054] mb-1">
                        Upload CVs
                      </h4>
                      <p className="text-sm text-slate-500">
                        Drag and drop your PDF files to start
                      </p>
                    </div>
                    <span className="bg-[#E60028] w-8 h-1 rounded-none mt-2"></span>
                  </div>

                  <div className="relative group">
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      multiple
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      onChange={(event) => {
                        const selectedFiles = Array.from(
                          event.target.files || [],
                        );
                        const invalidFile = selectedFiles.find(
                          (file) => file.type !== "application/pdf",
                        );

                        if (invalidFile) {
                          setBatchError(
                            "Only PDF files are allowed for batch verification.",
                          );
                          event.target.value = "";
                          return;
                        }

                        setBatchFiles((prev) => {
                          const merged = [...prev];
                          selectedFiles.forEach((file) => {
                            const exists = merged.some(
                              (f) =>
                                f.name === file.name &&
                                f.size === file.size &&
                                f.lastModified === file.lastModified,
                            );
                            if (!exists) merged.push(file);
                          });

                          if (merged.length > 10) {
                            setBatchError(
                              "Maximum 10 files allowed per batch.",
                            );
                            return merged.slice(0, 10);
                          }

                          setBatchError(null);
                          return merged;
                        });
                        event.target.value = "";
                      }}
                    />
                    <div className="flex flex-col items-center justify-center py-10 px-6 border-2 border-dashed border-slate-200 rounded-none bg-slate-50/30 group-hover:bg-white group-hover:border-blue-500 group-hover:shadow-md transition-all duration-300">
                      <div className="w-16 h-16 mb-4 rounded-none bg-blue-50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <svg
                          className="w-8 h-8 text-blue-600 animate-bounce-slow"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                      </div>
                      <p className="text-base font-bold text-slate-700 group-hover:text-blue-600 transition-colors">
                        Drop CVs here or{" "}
                        <span className="text-blue-600">click to browse</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-2">
                        Supports PDF, Max 10 files
                      </p>
                    </div>
                  </div>

                  {batchFiles.length > 0 && (
                    <div className="mt-6 flex-grow">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Ready to Verify ({batchFiles.length})
                        </span>
                        <button
                          type="button"
                          className="text-xs font-semibold text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                          onClick={() => {
                            setBatchFiles([]);
                            setBatchError(null);
                          }}
                        >
                          Clear all
                        </button>
                      </div>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                        {batchFiles.map((file, index) => (
                          <div
                            key={`${file.name}-${index}`}
                            className="flex items-center justify-between p-3 rounded-none bg-slate-50 border border-slate-100 group/item"
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <svg
                                className="w-5 h-5 text-blue-400 shrink-0"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <span
                                className="text-sm font-medium text-slate-700 truncate"
                                title={file.name}
                              >
                                {file.name}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="text-slate-300 hover:text-rose-500 p-1 transition-colors cursor-pointer"
                              onClick={() =>
                                setBatchFiles((prev) =>
                                  prev.filter((_, i) => i !== index),
                                )
                              }
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-8">
                    <button
                      className="w-full inline-flex items-center justify-center rounded-none bg-blue-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-blue-100 hover:bg-blue-700 hover:-translate-y-0.5 hover:shadow-blue-200 transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none disabled:cursor-not-allowed"
                      disabled={batchFiles.length === 0 || batchSubmitting}
                      onClick={() => handleBatchUpload(batchFiles)}
                    >
                      {batchSubmitting ? (
                        <>
                          <svg
                            className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Starting Verification...
                        </>
                      ) : (
                        `Start Verification (${batchFiles.length})`
                      )}
                    </button>
                    {batchError && (
                      <p className="mt-3 text-sm font-medium text-[#E60028] text-center">
                        {batchError}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Job Status List */}
              <div className="p-8 sm:p-10 flex flex-col h-full bg-slate-100">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h4 className="text-xl font-bold text-[#000054] mb-1">
                      Recent Batch Jobs
                    </h4>
                    <p className="text-sm text-slate-500">
                      Track your background processes
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      className="p-2 rounded-none hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-all cursor-pointer group"
                      onClick={loadBatchJobs}
                      title="Refresh status"
                    >
                      <svg
                        className={`w-5 h-5 ${batchLoading ? "animate-spin" : "group-active:rotate-180 transition-transform"}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                    <span className="bg-[#E60028] w-8 h-1 rounded-none mt-2"></span>
                  </div>
                </div>


                <div className="space-y-4 max-h-[460px] overflow-y-auto pr-2 custom-scrollbar">
                  {batchLoading && batchJobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                      <div className="animate-pulse space-y-4 w-full">
                        <div className="h-16 bg-slate-100 rounded-none"></div>
                        <div className="h-16 bg-slate-100 rounded-none"></div>
                        <div className="h-16 bg-slate-100 rounded-none"></div>
                      </div>
                    </div>
                  ) : batchJobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 mb-4 rounded-none bg-slate-100 flex items-center justify-center">
                        <svg
                          className="w-8 h-8 text-slate-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-slate-500">
                        No batch jobs yet
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Upload files to see them here
                      </p>
                    </div>
                  ) : (
                    batchJobs.map((job) => (
                      <div
                        key={job.id}
                        className="group relative flex items-center gap-4 p-5 rounded-none bg-white border border-slate-200 hover:border-blue-300/50 hover:shadow-[0_10px_30px_rgba(0,0,0,0.04)] transition-all duration-500"
                      >
                        <div className="w-10 h-10 rounded-none bg-slate-50 flex items-center justify-center shrink-0 group-hover:bg-blue-50 transition-colors">
                          <svg
                            className="w-5 h-5 text-slate-400 group-hover:text-blue-500"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>

                        <div className="flex-grow min-w-0">
                          <p
                            className="text-sm font-extrabold text-slate-800 truncate pr-8 group-hover:text-blue-700 transition-colors"
                            title={job.originalFileName}
                          >
                            {job.originalFileName}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {String(job.status).toLowerCase() === "completed" ||
                            String(job.stage).toLowerCase() === "done" ? (
                              <span className="flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-none border border-emerald-100">
                                <span className="w-1.5 h-1.5 rounded-none bg-emerald-500"></span>
                                Completed
                              </span>
                            ) : String(job.status).toLowerCase() ===
                              "failed" ? (
                              <span className="flex items-center gap-1.5 text-[10px] font-extrabold text-rose-600 uppercase tracking-widest bg-rose-50 px-2 py-0.5 rounded-none border border-rose-100">
                                <span className="w-1.5 h-1.5 rounded-none bg-rose-500"></span>
                                Failed
                              </span>
                            ) : (
                              <div className="flex flex-col gap-1.5 w-full">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="flex items-center gap-1.5 text-[10px] font-extrabold text-blue-600 uppercase tracking-widest">
                                    <span className="w-1.5 h-1.5 rounded-none bg-blue-500 animate-pulse"></span>
                                    {job.stage || "Processing"}
                                  </span>
                                  <span className="text-[10px] font-bold text-blue-600/60">
                                    {job.progress || 0}%
                                  </span>
                                </div>
                                <div className="h-1.5 w-full bg-blue-100/50 rounded-none overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500 transition-all duration-500 ease-out shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                                    style={{ width: `${job.progress || 0}%` }}
                                  ></div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="hidden group-hover:flex items-center px-3 py-1.5 rounded-none bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-600 hover:text-white transition-all cursor-pointer whitespace-nowrap"
                            onClick={() =>
                              navigate(`/publication-check/results/${job.id}`)
                            }
                          >
                            View Results
                          </button>
                          <button
                            type="button"
                            className="p-1.5 rounded-none text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                            onClick={() => handleRemoveBatchJob(job.id)}
                            title="Remove job"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <style
          dangerouslySetInnerHTML={{
            __html: `
          @keyframes bounce-slow {
            0%, 100% { transform: translateY(-5%); animation-timing-function: cubic-bezier(0.8,0,1,1); }
            50% { transform: none; animation-timing-function: cubic-bezier(0,0,0.2,1); }
          }
          .animate-bounce-slow {
            animation: bounce-slow 2s infinite;
          }
          .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #e2e8f0;
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #cbd5e1;
          }
        `,
          }}
        />

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

        {showSingleUpload && errorInfo && (
          <div className="w-full max-w-2xl mb-6 p-4 rounded-none border border-red-300 bg-red-50 text-red-700 text-sm mx-4">
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
        {showSingleUpload && (
          <div
            className={`$
              isDragActive ? "bg-blue-100" : "bg-white"
            } border-dashed border-2 border-gray-400 rounded-none sm:rounded-[3vw] md:rounded-[5vw] flex flex-col items-center justify-center w-full max-w-4xl mx-4 min-h-[300px] sm:min-h-[400px] md:h-2/3 p-6 sm:p-8`}
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
        )}
      </div>

      {showSingleUpload && processing && uploadedFile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-6xl bg-white rounded-none shadow-lg overflow-hidden">
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
                    <div className="absolute inset-0 rounded-none bg-gradient-to-r from-blue-100 to-purple-100 animate-pulse"></div>

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
                    <div className="absolute inset-0  border-transparent border-t-blue-300 rounded-none animate-spin opacity-30"></div>
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
                        className={`w-4 h-4 rounded-none mr-3 transition-all duration-500 ${
                          progress >= 20
                            ? "bg-green-500 scale-110 shadow-lg shadow-green-500/30"
                            : "bg-gray-300"
                        }`}
                      >
                        {progress >= 20 && (
                          <div className="w-full h-full rounded-none bg-green-400 animate-ping opacity-75"></div>
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
                        className={`w-4 h-4 rounded-none mr-3 transition-all duration-500 ${
                          progress >= 50
                            ? "bg-green-500 scale-110 shadow-lg shadow-green-500/30"
                            : "bg-gray-300"
                        }`}
                      >
                        {progress >= 50 && (
                          <div className="w-full h-full rounded-none bg-green-400 animate-ping opacity-75"></div>
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
                        className={`w-4 h-4 rounded-none mr-3 transition-all duration-500 ${
                          progress >= 80
                            ? "bg-green-500 scale-110 shadow-lg shadow-green-500/30"
                            : "bg-gray-300"
                        }`}
                      >
                        {progress >= 80 && (
                          <div className="w-full h-full rounded-none bg-green-400 animate-ping opacity-75"></div>
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
                        className={`w-4 h-4 rounded-none mr-3 transition-all duration-500 ${
                          progress >= 100
                            ? "bg-green-500 scale-110 shadow-lg shadow-green-500/30"
                            : "bg-gray-300"
                        }`}
                      >
                        {progress >= 100 && (
                          <div className="w-full h-full rounded-none bg-green-400 animate-ping opacity-75"></div>
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
