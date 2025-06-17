import React, { useState } from "react";
import axios from "axios";

const SearchPublications = () => {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState([]);

  const handleSearch = async () => {
    if (!keyword.trim()) return alert("Enter a keyword");

    try {
      const { data } = await axios.post("http://localhost:5000/api/publication/search", { keyword });
      setResults(data.data);
    } catch (err) {
      alert("Search failed: " + err.message);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Search Publications</h2>
      <input
        type="text"
        placeholder="Enter keyword like 'science'"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        style={{ padding: "5px", width: "300px" }}
      />
      <button onClick={handleSearch} style={{ marginLeft: "10px" }}>Search</button>

      <ul>
        {results.map((pub, i) => (
          <li key={i}>
            <strong>{pub.title}</strong><br />
            DOI: {pub.doi || "N/A"}<br />
            <a href={pub.link} target="_blank" rel="noreferrer">Open</a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SearchPublications;
