import React, { useCallback, useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import Header from "../components/Header";
import fileUploadIcon from "../assets/document-upload.svg";
import { useDropzone } from "react-dropzone";
import api from "../config/api";
import { useNavigate } from "react-router-dom";
import Footer from "../components/Footer";
import SimplePDFViewer from "../components/SimplePDFViewer";

function CVUpload() {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressPhase, setProgressPhase] = useState("upload"); // 'upload', 'processing', 'complete'
  const [errorInfo, setErrorInfo] = useState(null); // {message, retryable, code}
  const [uploadedFile, setUploadedFile] = useState(null); // Store the uploaded file for preview
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const fileRef = useRef(null); // Store file reference for socket callbacks

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
    [handleFileUpload]
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
