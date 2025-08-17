import { useState } from "react";
import axios from "axios";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function SearchAuthor() {
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState(null);
  const [publications, setPublications] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query) return;

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // Step 1: Fetch author data
      const res = await axios.get(`http://localhost:5000/api/author/search-author?name=${encodeURIComponent(query)}`);
      const fetchedProfile = res.data.profile;
      const fetchedPublications = res.data.publications;

      setProfile(fetchedProfile);
      setPublications(fetchedPublications);

      // Step 2: Save data to MongoDB
      const saveRes = await axios.post("http://localhost:5000/api/author/save-profile", {
        profile: fetchedProfile,
        publications: fetchedPublications,
      });

      if (saveRes.status === 200) {
        setSuccess("✅ Profile and publications saved successfully.");
      } else {
        setError("⚠️ Data fetched but failed to save.");
      }
    } catch (err) {
      console.error("❌ Error during author search or save:", err.message);
      setProfile(null);
      setPublications([]);
      setError(err.response?.data?.error || "❌ Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <div className="p-4 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold mb-4">Search Author</h1>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Enter author name..."
            className="border px-3 py-2 flex-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className={`px-4 py-2 text-white ${loading ? "bg-gray-400" : "bg-blue-600"}`}
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        {error && <p className="text-red-500">{error}</p>}
        {success && <p className="text-green-600">{success}</p>}

        {profile && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold">{profile.basic_info.name}</h2>
            <p>{profile.basic_info.affiliations?.[0]?.institution?.display_name || "No affiliation"}</p>
          </div>
        )}

        {publications.length > 0 && (
          <div>
            <h3 className="text-md font-semibold mb-2">Publications:</h3>
            <ul className="list-disc pl-5">
              {publications.map((pub) => (
                <li key={pub.id}>{pub.title}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}
