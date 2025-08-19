import React, { useState } from "react";
import axios from "axios";

function JobDetect() {
  const [file, setFile] = useState(null);
  const [detectedPosition, setDetectedPosition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setDetectedPosition(null);
    setError("");
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please upload a file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);

      const res = await axios.post(
        "http://localhost:5000/api/ai/detect-position", // ✅ Fixed API URL
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      setDetectedPosition(res.data.position || "No position found.");
    } catch (err) {
      console.error(err);
      setError("Failed to detect job position.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-100 text-[#000054] px-8 py-20">
      <div className="max-w-xl mx-auto bg-white shadow-md rounded-lg p-10">
        <h1 className="text-3xl font-bold mb-6 text-center">Detect Job Position</h1>

        <input
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          className="w-full mb-4 border p-2 rounded"
        />

        <button
          onClick={handleUpload}
          className="w-full bg-[#000054] text-white py-3 rounded hover:bg-[#1a1a80]"
          disabled={loading}
        >
          {loading ? "Detecting..." : "Upload and Detect"}
        </button>

        {error && <p className="text-red-500 mt-4">{error}</p>}

        {detectedPosition && (
          <div className="mt-6 bg-green-100 text-green-800 p-4 rounded">
            <p className="font-semibold">Detected Position:</p>
            <p>{detectedPosition}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default JobDetect;
