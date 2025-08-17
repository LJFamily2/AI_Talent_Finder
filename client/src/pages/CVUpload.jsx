import React, { useCallback, useState } from "react";
import Header from "../components/Header";
import fileUploadIcon from "../assets/document-upload.svg";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Footer from "../components/Footer";

function CVUpload() {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate()

  const handleFileUpload = async (file) => {
    setProcessing(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append("cv", file);

      const response = await axios.post("http://localhost:8000/api/cv/verify-cv", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (e) => {
          const uploadPercent = Math.round((e.loaded * 100) / e.total);
          setProgress(Math.min(uploadPercent, 80)); // cap at 80%
        },
      });

      let current = 80;
      const timer = setInterval(() => {
        current += 2;
        setProgress(current);

        if (current >= 100) {
          clearInterval(timer);
          setProcessing(false); // End processing when progress hits 100
          navigate("/cv-verification", {
            state: { publications: response.data },
          });
        }
      }, 50);
    } catch (error) {
      console.error("Error verifying CV:", error);
      setProcessing(false);
    }
  };

  // const handleFileChange = (event) => {
  //   const file = event.target.files?.[0];
  //   if (file) {
  //     console.log("Selected file:", file.name);
  //     handleFileUpload(file);
  //   }
  // };

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];

    if (file) {
      handleFileUpload(file);
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

  return (
    <div className="w-full h-screen">
      <Header />
      <div className="flex flex-col items-center w-full h-lvh mt-15">
        <h2 className="text-3xl font-bold mb-7">Verify Candidate CV</h2>
        <div
          className={`${isDragActive ? "bg-blue-100" : "bg-white"} border-dashed border-2 border-gray-400 rounded-[5vw] flex flex-col items-center justify-center w-2/3 h-2/3`} {...getRootProps()}
        >
          <input {...getInputProps()} />
          <img src={fileUploadIcon} alt="Upload Icon" className="w-24 h-24 mb-8" />
          <span className="font-bold text-2xl">Drop your file here, or {" "}
            <span className="text-blue-400 underline cursor-pointer">Browse</span>
          </span>

          <p className="text-gray-400 mt-4">Accepted file formats: .doc, .docx, .pdf</p>

        </div>
      </div>

      {processing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-1/3 min-w-[300px] bg-white rounded-lg p-8 shadow-lg flex flex-col items-center">

            {/* Circular Progress Bar */}
            <div className="relative w-24 h-24">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  className="text-gray-200"
                  strokeWidth="8"
                  stroke="currentColor"
                  fill="transparent"
                  r="44"
                  cx="48"
                  cy="48"
                />
                <circle
                  className="text-blue-500 transition-all duration-200 ease-linear"
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 44}
                  strokeDashoffset={2 * Math.PI * 44 * (1 - progress / 100)}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="44"
                  cx="48"
                  cy="48"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-lg font-semibold">
                {progress}%
              </div>
            </div>

            <span className="text-gray-500 mt-4 text-xl">Processing your file...</span>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}

export default CVUpload;
