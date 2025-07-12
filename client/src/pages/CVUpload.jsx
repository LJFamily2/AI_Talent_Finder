import React, { useCallback, useState } from "react";
import Header from "../components/Header";
import fileUploadIcon from "../assets/document-upload.svg";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Footer from "../components/Footer";

function CVUpload() {
  const [processing, setProcessing] = useState(false);
  const navigate = useNavigate()

  const handleFileUpload = async (file) => {
    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append("cv", file);

      const response = await axios.post("http://localhost:5000/api/cv/verify-cv", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // console.log("Verification result:", response.data);
      navigate("/cv-verification", { state: { publications: response.data } });
    } catch (error) {
      console.error("Error verifying CV:", error);
    } finally {
      setProcessing(false);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log("Selected file:", file.name);
      handleFileUpload(file);
    }
  };

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
        <div className="fixed inset-0 bg-black/50 backdrop-invert backdrop-opacity-10 flex items-center justify-center z-50">
          <div className="w-1/3 h-1/2 min-w-120 bg-white rounded-lg p-8 shadow-lg flex flex-col items-center justify-evenly p-15">
            <div className="loader border-4 border-blue-500 border-t-transparent rounded-full w-20 h-20 animate-spin"></div>
            <span className="text-xl font-semibold mb-4">File processing in progress...</span>
          </div>
        </div>
      )}
      {/* Loader CSS */}
      <style>
        {`
          .loader {
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>

      <Footer />
    </div>
  )
}

export default CVUpload;
