import React, { useState } from "react";
import axios from "axios";

function SearchAuthor() {
  const [name, setName] = useState("");
  const [result, setResult] = useState(null);

  const handleSearch = async () => {
    try {
      const res = await axios.post("http://localhost:5000/api/author/search-author", { name });
      setResult(res.data);
    } catch (err) {
      console.error("Error:", err.response?.data || err.message);
    }
  };

  return (
    <div>
      <h2>Search Author</h2>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Author name" />
      <button onClick={handleSearch}>Search</button>

      {result && (
        <div>
          <h3>Author: {result.profile.basic_info.name}</h3>
          <p>Email: {result.profile.basic_info.email}</p>
          <h4>Publications</h4>
          <ul>
            {result.works.map((w, idx) => (
              <li key={idx}>Publication ID: {w.workID[0]}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default SearchAuthor;
