import React, { useState, useEffect, useCallback } from "react";
import {
  FaThLarge,
  FaBars,
  FaBookmark,
  FaDownload,
  FaUserSlash,
  FaRegBookmark,
} from "react-icons/fa";
import { FaSortUp, FaSortDown } from "react-icons/fa"; // Add these icons for sorting
import letterH from "../assets/letter-h.png";
import scholarHat from "../assets/scholar-hat.png";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Snackbar, Alert } from "@mui/material";
import { getBookmarks, removeBookmark } from "../services/bookmarkService";
import { exportResearchersToExcel } from "../services/exportService";

export default function SavedResearchers() {
  const [savedResearchers, setSavedResearchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [targetResearcher, setTargetResearcher] = useState(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedResearchers, setSelectedResearchers] = useState([]);

  const [viewMode, setViewMode] = useState("grid"); // 'grid' or 'list'

  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  function showToast(message, severity = "success") {
    setToast({ open: true, message, severity });
  }

  const fetchBookmarks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getBookmarks();

      // Transform API data to match component's expected format
      const transformedData = response.data.map((researcher) => ({
        id: researcher._id,
        name: researcher.basic_info?.name || "Unknown",
        institution:
          researcher.current_affiliation?.display_name ||
          researcher.basic_info?.affiliations?.[0]?.institution?.display_name ||
          "Unknown Institution",
        hIndex: researcher.research_metrics?.h_index || 0,
        i10Index: researcher.research_metrics?.i10_index || 0,
        field:
          researcher.research_areas?.fields?.[0]?.display_name ||
          researcher.research_areas?.topics?.[0]?.display_name ||
          "Unknown Field",
      }));

      setSavedResearchers(transformedData);
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
      showToast("Failed to load bookmarked researchers", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch bookmarks when component mounts
  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  const handleExport = async () => {
    try {
      const data = selectMode
        ? savedResearchers.filter((r) => selectedResearchers.includes(r.id))
        : savedResearchers;

      if (data.length === 0) {
        showToast("No researchers to export", "warning");
        return;
      }

      // Show loading state
      setLoading(true);

      const result = await exportResearchersToExcel(data);

      const message = selectMode
        ? `Successfully exported ${result.count} selected researcher${
            result.count > 1 ? "s" : ""
          } to ${result.filename}`
        : `Successfully exported all ${result.count} researcher${
            result.count > 1 ? "s" : ""
          } to ${result.filename}`;

      showToast(message, "success");

      // Clear selection after export if in select mode
      if (selectMode) {
        setSelectedResearchers([]);
      }
    } catch (error) {
      console.error("Export failed:", error);
      showToast(error.message || "Export failed. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const confirmUnsave = (researcher) => {
    setTargetResearcher(researcher);
    setShowModal(true);
  };

  const unsaveResearcher = async () => {
    if (targetResearcher) {
      try {
        await removeBookmark(targetResearcher.id);
        setSavedResearchers((prev) =>
          prev.filter((r) => r.id !== targetResearcher.id)
        );
        showToast(`${targetResearcher.name} has been removed`, "error");
      } catch (error) {
        console.error("Error removing bookmark:", error);
        showToast("Failed to remove bookmark", "error");
      }
    }
    setShowModal(false);
  };

  const toggleSelectMode = () => {
    setSelectMode((prev) => !prev);
    setSelectedResearchers([]); // clear selection when toggling
  };

  const toggleSelectResearcher = (id) => {
    setSelectedResearchers((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]
    );
  };

  // Sorting logic
  const sortedResearchers = React.useMemo(() => {
    let sortable = [...savedResearchers];
    if (sortConfig.key) {
      sortable.sort((a, b) => {
        if (
          sortConfig.key === "name" ||
          sortConfig.key === "institution" ||
          sortConfig.key === "field"
        ) {
          if (a[sortConfig.key] < b[sortConfig.key])
            return sortConfig.direction === "asc" ? -1 : 1;
          if (a[sortConfig.key] > b[sortConfig.key])
            return sortConfig.direction === "asc" ? 1 : -1;
          return 0;
        } else {
          // hIndex or i10Index
          return sortConfig.direction === "asc"
            ? a[sortConfig.key] - b[sortConfig.key]
            : b[sortConfig.key] - a[sortConfig.key];
        }
      });
    }
    return sortable;
  }, [savedResearchers, sortConfig]);

  // Handler for sorting
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="w-full flex-grow mx-auto py-10 bg-gray-100">
        <div className="w-4/5 mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              Saved Researchers
              <div className="flex rounded-lg overflow-hidden border border-blue-200 ml-2">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`px-3 py-2 flex items-center justify-center transition
                                        ${
                                          viewMode === "grid"
                                            ? "bg-blue-600 text-white"
                                            : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                                        }
                                        border-r border-blue-200`}
                  style={{
                    borderTopLeftRadius: "0.5rem",
                    borderBottomLeftRadius: "0.5rem",
                  }}
                  title="Grid view"
                >
                  <FaThLarge className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-3 py-2 flex items-center justify-center transition
                                        ${
                                          viewMode === "list"
                                            ? "bg-blue-600 text-white"
                                            : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                                        }`}
                  style={{
                    borderTopRightRadius: "0.5rem",
                    borderBottomRightRadius: "0.5rem",
                  }}
                  title="List view"
                >
                  <FaBars className="w-5 h-5" />
                </button>
              </div>
            </h2>
            <div className="flex items-center gap-4">
              <button
                onClick={toggleSelectMode}
                className="rounded-xl bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium px-4 py-2 transition"
              >
                {selectMode ? "Cancel" : "Select"}
              </button>

              <button
                onClick={handleExport}
                disabled={
                  loading || (selectMode && selectedResearchers.length === 0)
                }
                className={`flex items-center gap-2 rounded-xl font-medium px-4 py-2 shadow transition-all ${
                  loading || (selectMode && selectedResearchers.length === 0)
                    ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                <FaDownload className="text-current" />
                {loading
                  ? "Exporting..."
                  : selectMode
                  ? `Export Selected (${selectedResearchers.length})`
                  : "Export All"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center mt-20 text-gray-500 flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              <p className="text-lg">Loading saved researchers...</p>
            </div>
          ) : savedResearchers.length === 0 ? (
            <div className="text-center mt-20 text-gray-500 flex flex-col items-center gap-4">
              <FaUserSlash className="text-5xl text-gray-300" />
              <p className="text-lg">No Saved Researchers</p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {savedResearchers.map((person, index) => (
                <div
                  key={index}
                  className={`relative flex flex-col justify-between border ${
                    selectedResearchers.includes(person.id)
                      ? "border-blue-500"
                      : "border-[#D9D9D9]"
                  } bg-white rounded-md p-4 shadow-sm hover:shadow-md transition-all cursor-pointer`}
                  onClick={() =>
                    selectMode && toggleSelectResearcher(person.id)
                  }
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmUnsave(person);
                    }}
                    className="absolute top-0 right-5"
                  >
                    <FaBookmark className="text-yellow-400 text-2xl" />
                  </button>

                  <div>
                    <div className="mb-2">
                      <div className="flex items-center gap-2">
                        {selectMode && (
                          <div className="w-5 h-5 rounded-full border-2 border-gray-400 bg-white flex items-center justify-center pointer-events-none">
                            {selectedResearchers.includes(person.id) && (
                              <div className="w-3 h-3 bg-blue-500 rounded-full" />
                            )}
                          </div>
                        )}

                        <p className="font-bold text-md">{person.name}</p>
                      </div>
                      <p className="text-[#6A6A6A] text-sm">
                        {person.institution}
                      </p>
                    </div>

                    <div className="mb-2">
                      <div className="text-sm text-[#6A6A6A] flex items-center gap-1">
                        <img src={letterH} alt="H" className="w-3 h-3" />{" "}
                        h-index: {person.hIndex}
                      </div>
                      <div className="text-sm text-[#6A6A6A] flex items-center gap-1">
                        <img
                          src={scholarHat}
                          alt="Scholar"
                          className="w-3 h-3"
                        />{" "}
                        i10-index: {person.i10Index}
                      </div>
                    </div>

                    <div className="text-xs bg-[#4D8BC5] text-white px-3 py-1 rounded-md w-fit">
                      {person.field}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Header row */}
              <div className="flex items-center bg-blue-50 border border-blue-200 rounded-md px-4 py-2 font-semibold text-gray-700 text-sm">
                <button
                  className="w-1/4 flex items-center gap-1 focus:outline-none"
                  onClick={() => handleSort("name")}
                >
                  Name
                  {sortConfig.key === "name" &&
                    (sortConfig.direction === "asc" ? (
                      <FaSortUp />
                    ) : (
                      <FaSortDown />
                    ))}
                </button>
                <button
                  className="w-1/4 flex items-center gap-1 focus:outline-none"
                  onClick={() => handleSort("institution")}
                >
                  Institution
                  {sortConfig.key === "institution" &&
                    (sortConfig.direction === "asc" ? (
                      <FaSortUp />
                    ) : (
                      <FaSortDown />
                    ))}
                </button>
                <button
                  className="w-1/6 flex items-center gap-1 focus:outline-none"
                  onClick={() => handleSort("field")}
                >
                  Field
                  {sortConfig.key === "field" &&
                    (sortConfig.direction === "asc" ? (
                      <FaSortUp />
                    ) : (
                      <FaSortDown />
                    ))}
                </button>
                <button
                  className="w-1/6 flex items-center gap-1 focus:outline-none"
                  onClick={() => handleSort("hIndex")}
                >
                  h-index
                  {sortConfig.key === "hIndex" &&
                    (sortConfig.direction === "asc" ? (
                      <FaSortUp />
                    ) : (
                      <FaSortDown />
                    ))}
                </button>
                <button
                  className="w-1/6 flex items-center gap-1 focus:outline-none"
                  onClick={() => handleSort("i10Index")}
                >
                  i10-index
                  {sortConfig.key === "i10Index" &&
                    (sortConfig.direction === "asc" ? (
                      <FaSortUp />
                    ) : (
                      <FaSortDown />
                    ))}
                </button>
                <div className="w-12 text-center"></div>
              </div>
              {/* Data rows */}
              {sortedResearchers.map((person, index) => (
                <div
                  key={index}
                  className={`flex items-center border ${
                    selectedResearchers.includes(person.id)
                      ? "border-blue-500"
                      : "border-[#D9D9D9]"
                  } bg-white rounded-md px-4 py-2 shadow-sm hover:shadow-md transition-all cursor-pointer text-md`}
                  onClick={() =>
                    selectMode && toggleSelectResearcher(person.id)
                  }
                >
                  <div className="w-1/4 flex items-center">
                    {selectMode && (
                      <div className="w-6 h-6 rounded-full border-2 border-gray-400 bg-white flex items-center justify-center mr-3 pointer-events-none">
                        {selectedResearchers.includes(person.id) && (
                          <div className="w-4 h-4 bg-blue-500 rounded-full" />
                        )}
                      </div>
                    )}
                    <span className="font-bold">{person.name}</span>
                  </div>
                  <div className="w-1/4 text-[#6A6A6A] text-sm">
                    {person.institution}
                  </div>
                  <div className="w-1/6">
                    <span className="text-sm bg-[#4D8BC5] text-white px-3 py-1 rounded-md">
                      {person.field}
                    </span>
                  </div>
                  <div className="w-1/6 flex items-center gap-2 text-[#6A6A6A]">
                    {person.hIndex}
                  </div>
                  <div className="w-1/6 flex items-center gap-2 text-[#6A6A6A]">
                    {person.i10Index}
                  </div>
                  <div className="w-12 flex justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmUnsave(person);
                      }}
                    >
                      <FaBookmark className="text-yellow-400 text-xl" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />

      {/* Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setToast({ ...toast, open: false })}
          severity={toast.severity}
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>

      {/* Confirmation Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0"
            onClick={() => setShowModal(false)}
          />

          <div className="relative bg-white p-6 rounded-2xl shadow-2xl z-60 w-[320px] max-w-full">
            <p className="text-xl font-semibold text-gray-800 mb-6">
              Remove this researcher?
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={unsaveResearcher}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition"
              >
                Yes
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md transition"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
