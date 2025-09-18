import React, { useState, useEffect, useRef } from "react";

/**
 * SimplePDFViewer - A fallback PDF viewer that always works
 * Uses multiple strategies to ensure PDF display
 */
function SimplePDFViewer({ file, className = "" }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState(null);
  const [strategy, setStrategy] = useState("iframe"); // 'iframe', 'object', 'download'
  const objectUrlRef = useRef(null);

  useEffect(() => {
    // Cleanup previous blob URL
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    if (!file) {
      setBlobUrl(null);
      setError(null);
      return;
    }

    try {
      let url;
      if (typeof file === "string") {
        url = file;
      } else if (file instanceof File || file instanceof Blob) {
        url = URL.createObjectURL(file);
        objectUrlRef.current = url;
      } else {
        throw new Error("Invalid file type");
      }

      setBlobUrl(url);
      setError(null);
    } catch (err) {
      console.error("SimplePDFViewer: Error creating URL:", err);
      setError(err.message);
    }

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [file]);

  const handleOpenInNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleDownload = () => {
    if (blobUrl && file) {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = file.name || "document.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  if (error) {
    return (
      <div
        className={`flex items-center justify-center p-8 text-center ${className}`}
      >
        <div className="text-red-600">
          <p>Error loading PDF: {error}</p>
        </div>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-gray-500">
          {file ? "Loading PDF..." : "No PDF selected"}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Strategy 1: iframe */}
      {strategy === "iframe" && (
        <iframe
          src={blobUrl}
          className="w-full h-full border-0"
          title="PDF Viewer"
          onError={() => {
            setStrategy("object");
          }}
        />
      )}

      {/* Strategy 2: object */}
      {strategy === "object" && (
        <object data={blobUrl} type="application/pdf" className="w-full h-full">
          <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
            <p className="text-gray-600">
              Your browser cannot display this PDF directly.
            </p>
            <div className="space-x-4">
              <button
                onClick={handleOpenInNewTab}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Open in New Tab
              </button>
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Download PDF
              </button>
            </div>
          </div>
        </object>
      )}

      {/* Always show control buttons */}
      <div className="absolute top-2 right-2 space-x-2">
        <button
          onClick={handleOpenInNewTab}
          className="px-2 py-1 bg-white/80 hover:bg-white text-xs rounded shadow border"
          title="Open in new tab"
        >
          ↗️
        </button>
        <button
          onClick={handleDownload}
          className="px-2 py-1 bg-white/80 hover:bg-white text-xs rounded shadow border"
          title="Download"
        >
          ⬇️
        </button>
      </div>

      {/* Debug info */}
      <div className="absolute bottom-2 left-2 text-xs text-gray-500 bg-white/80 px-2 py-1 rounded">
        Strategy: {strategy} | URL: {blobUrl ? "OK" : "None"}
      </div>
    </div>
  );
}

export default SimplePDFViewer;
