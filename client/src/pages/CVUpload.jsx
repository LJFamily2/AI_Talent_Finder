import React, { useCallback, useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import Header from "../components/Header";
import fileUploadIcon from "../assets/document-upload.svg";
import { useDropzone } from "react-dropzone";
import api from "../config/api";
import { useNavigate } from "react-router-dom";
import Footer from "../components/Footer";

function CVUpload() {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressPhase, setProgressPhase] = useState("upload"); // 'upload', 'processing', 'complete'
  const [errorInfo, setErrorInfo] = useState(null); // {message, retryable, code}
  const navigate = useNavigate();
  const socketRef = useRef(null);

  const handleFileUpload = useCallback(
    async (file) => {
      setProcessing(true);
      setProgress(0);
      setProgressPhase("upload");
      setErrorInfo(null); // Clear any previous error

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
            setProgress(Math.min(uploadPercent * 0.2, 20)); // Scale to 0-20%
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
            navigate("/verify-cv/results", {
              state: { publications: data.result },
            });
          }, 1000);
        });

        socketRef.current.on("error", (data) => {
          setProcessing(false);
          setProgress(0);
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
        setErrorInfo({
          message:
            error.response?.data?.error ||
            error.message ||
            "Failed to start verification.",
          retryable: false,
        });
      }
    },
    [navigate]
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
    (acceptedFiles) => {
      const file = acceptedFiles[0];

      if (file) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div className="w-full min-h-screen">
      <Header />
      <div className="flex flex-col items-center w-full min-h-screen pt-20 pb-8 px-4">
        <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-7 text-center">Verify Candidate CV</h2>
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

          <p className="text-gray-400 mt-3 sm:mt-4 text-sm sm:text-base text-center">Accepted file formats: .pdf</p>
        </div>
      </div>

      {processing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm sm:max-w-md bg-white rounded-lg p-6 sm:p-8 shadow-lg flex flex-col items-center">
            {/* Circular Progress Bar */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24">
              <svg
                className="w-full h-full transform -rotate-90 origin-center"
                viewBox="0 0 80 80"
                preserveAspectRatio="xMidYMid meet"
              >
                <circle
                  className="text-gray-200"
                  strokeWidth="6"
                  stroke="currentColor"
                  fill="transparent"
                  r="36"
                  cx="40"
                  cy="40"
                />
                <circle
                  className="text-blue-500 transition-all duration-300 ease-out"
                  strokeWidth="6"
                  strokeDasharray={2 * Math.PI * 36}
                  strokeDashoffset={2 * Math.PI * 36 * (1 - progress / 100)}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="36"
                  cx="40"
                  cy="40"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-base sm:text-lg font-semibold">
                {progress}%
              </div>
            </div>

            <span className="text-gray-500 mt-4 text-lg sm:text-xl text-center">
              {progressPhase === "upload" && "Uploading your file..."}
              {progressPhase === "processing" && "Analyzing CV content..."}
              {progressPhase === "complete" && "Finalizing results..."}
            </span>

            {progressPhase === "processing" && (
              <p className="text-gray-400 text-xs sm:text-sm mt-2 text-center px-2">
                This may take up to 90 seconds for complex documents
              </p>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default CVUpload;
