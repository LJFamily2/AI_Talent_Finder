import React, { useState } from 'react';

function CVUpload() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedText, setParsedText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('cv', selectedFile);

    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/parse-cv', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      setParsedText(data.text);
    } catch (error) {
      console.error('Error uploading file:', error);
      setParsedText('Error parsing the file.');
    }

    setLoading(false);
  };

  return (
    <div>
      <h2>Upload CV (PDF)</h2>
      <input type="file" accept=".pdf" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload & Parse</button>

      {loading && <p>Parsing...</p>}

      {parsedText && (
        <div>
          <h3>Parsed Text:</h3>
          <pre>{parsedText}</pre>
        </div>
      )}
    </div>
  );
}

export default CVUpload;
