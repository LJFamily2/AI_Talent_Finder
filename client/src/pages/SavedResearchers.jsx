import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaThLarge,
  FaBars,
  // FaBookmark,
  FaDownload,
  FaUserSlash,
  // FaRegBookmark,
  FaFilePdf,
} from "react-icons/fa";
import { FaSortUp, FaSortDown } from "react-icons/fa"; // Add these icons for sorting
import { FaTimes, FaFolderOpen } from "react-icons/fa";
import letterH from "../assets/letter-h.png";
import scholarHat from "../assets/scholar-hat.png";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  Snackbar,
  Alert,
  Menu,
  MenuItem,
  ButtonGroup,
  Button,
} from "@mui/material";
import { getBookmarks, removeBookmark } from "../services/bookmarkService";
import { exportResearchersToExcel } from "../services/exportService";
import { exportResearchersWithFullData } from "../services/pdfExportService";
import { sampleBookmarkData } from "./seed";

export default function SavedResearchers() {
  const navigate = useNavigate();
  const [savedResearchers, setSavedResearchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [targetResearcher, setTargetResearcher] = useState(null);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveTargetResearcher, setMoveTargetResearcher] = useState(null);

  // folders are unique by name; structure: { name, researcherIds: [] }
  const [folders, setFolders] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null); // holds folder.name

  const [selectMode, setSelectMode] = useState(false);
  const [selectedResearchers, setSelectedResearchers] = useState([]);

  const [viewMode, setViewMode] = useState("grid"); // 'grid' or 'list'

  // Export dropdown state
  const [exportAnchorEl, setExportAnchorEl] = useState(null);
  const exportMenuOpen = Boolean(exportAnchorEl);

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
      // For demo: use sample data. folders are unique by name.
      const foldersList = sampleBookmarkData?.folders || [];
      setFolders(foldersList);

      // default select first folder if available (use folder.name)
      if (foldersList.length > 0) {
        const first = foldersList[0];
        setCurrentFolderId(first.name);
        setSavedResearchers(first.researcherIds || []);
      } else {
        setCurrentFolderId(null);
        setSavedResearchers([]);
      }
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

  // folderName is the unique identifier (folder.name)
  const handleFolderSelect = (folderName) => {
    if (folderName === currentFolderId) return;
    setCurrentFolderId(folderName);
    const folder = folders.find((f) => f.name === folderName);
    setSavedResearchers(folder ? (folder.researcherIds || []) : []);
    // clear selections when switching folders
    setSelectedResearchers([]);
  };

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
        ? `Successfully exported ${result.count} selected researcher${result.count > 1 ? "s" : ""
        } to ${result.filename}`
        : `Successfully exported all ${result.count} researcher${result.count > 1 ? "s" : ""
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

  const handleExportMenuClick = (event) => {
    setExportAnchorEl(event.currentTarget);
  };

  const handleExportMenuClose = () => {
    setExportAnchorEl(null);
  };

  const handleExportPDF = async () => {
    handleExportMenuClose();
    try {
      const data = selectMode
        ? savedResearchers.filter((r) => selectedResearchers.includes(r.id))
        : savedResearchers;

      if (data.length === 0) {
        showToast("No researchers to export", "warning");
        return;
      }

      setLoading(true);

      await exportResearchersWithFullData(data);

      const message = selectMode
        ? `Successfully exported ${data.length} selected researcher${data.length > 1 ? "s" : ""
        } to PDF`
        : `Successfully exported all ${data.length} researcher${data.length > 1 ? "s" : ""
        } to PDF`;

      showToast(message, "success");

      // Clear selection after export if in select mode
      if (selectMode) {
        setSelectedResearchers([]);
      }
    } catch (error) {
      console.error("PDF export failed:", error);
      showToast(
        error.message || "PDF export failed. Please try again.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const confirmUnsave = (researcher) => {
    setTargetResearcher(researcher);
    setShowModal(true);
  };

  const openMoveModal = (researcher) => {
    setMoveTargetResearcher(researcher);
    setMoveModalOpen(true);
  };

  const closeMoveModal = () => {
    setMoveTargetResearcher(null);
    setMoveModalOpen(false);
  };

  const handleMoveToFolder = (folder) => {
    // placeholder: implement API call/mutation to move researcher between folders
    // For demo, update local sample data: remove from current folder and push to target folder
    const srcName = currentFolderId;
    const dstName = folder.name;
    if (!moveTargetResearcher) return;
    if (srcName === dstName) {
      showToast("Researcher already in the selected folder", "warning");
      closeMoveModal();
      return;
    }
    setFolders((prev) => {
      const next = prev
        .map((f) => {
          // remove from source
          if (f.name === srcName) {
            return { ...f, researcherIds: (f.researcherIds || []).filter(r => r.id !== moveTargetResearcher.id) };
          }
          return f;
        })
        .map((f) => {
          // add to dest
          if (f.name === dstName) {
            return { ...f, researcherIds: [...(f.researcherIds || []), moveTargetResearcher] };
          }
          return f;
        });
      return next;
    });
    // refresh current folder list
    if (currentFolderId === srcName) {
      setSavedResearchers(prev => prev.filter(r => r.id !== moveTargetResearcher.id));
    }
    showToast(`Moved "${moveTargetResearcher.name}" to "${folder.name}"`, "success");
    closeMoveModal();
  };

  const unsaveResearcher = async () => {
    if (targetResearcher) {
      try {
        await removeBookmark(targetResearcher.id);
        setSavedResearchers((prev) =>
          prev.filter((r) => r.id !== targetResearcher.id)
        );
        // also remove from folders state so counts update
        setFolders(prev => prev.map(f => ({ ...f, researcherIds: (f.researcherIds || []).filter(r => r.id !== targetResearcher.id) })));
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
        <div className="w-5/6 mx-auto flex gap-6">
          {/* Left: folders navigation (transparent background, subtle hover, active highlight) */}
          <aside className="w-64 p-0 mt-16 text-black flex-shrink-0">
            <div className="px-3">
              <h3 className="font-semibold mb-0">Folders</h3>
              <hr className="border-t border-gray-300 mt-3 mb-4" />
            </div>

            <div className="flex flex-col gap-2 px-1">
              {folders.length === 0 && <div className="text-sm text-gray-500 px-3">No folders</div>}
              {folders.map((f) => {
                const isActive = currentFolderId === f.name;
                return (
                  <button
                    key={f.name}
                    onClick={() => handleFolderSelect(f.name)}
                    className={`flex items-center justify-between text-left px-3 py-2 rounded-md w-full transition
                      ${isActive ? "bg-gray-200 text-black" : "bg-transparent text-black hover:bg-gray-100"}`}
                    aria-current={isActive ? "true" : undefined}
                  >
                    <span className="truncate">{f.name}</span>
                    <span className={`text-sm ${isActive ? "text-black/80" : "text-gray-500"}`}>{(f.researcherIds || []).length}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right: main content */}
          <main className="flex-1">
            <div className="w-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  {/* Saved Researchers */}
                  <div className="flex rounded-lg overflow-hidden border border-blue-200 ml-2">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`px-3 py-2 flex items-center justify-center transition
                                            ${viewMode === "grid"
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
                                            ${viewMode === "list"
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

                  <ButtonGroup variant="contained" color="primary">
                    <Button
                      onClick={handleExportMenuClick}
                      endIcon={<FaDownload />}
                      disabled={
                        loading || (selectMode && selectedResearchers.length === 0)
                      }
                    >
                      {loading
                        ? "Exporting..."
                        : selectMode
                          ? `Export Selected (${selectedResearchers.length})`
                          : "Export All"}
                    </Button>
                  </ButtonGroup>
                  <Menu
                    anchorEl={exportAnchorEl}
                    open={exportMenuOpen}
                    onClose={handleExportMenuClose}
                    anchorOrigin={{
                      vertical: "bottom",
                      horizontal: "right",
                    }}
                    transformOrigin={{
                      vertical: "top",
                      horizontal: "right",
                    }}
                  >
                    <MenuItem onClick={handleExport}>
                      <FaDownload className="mr-2" />
                      Export as Excel
                    </MenuItem>
                    <MenuItem onClick={handleExportPDF}>
                      <FaFilePdf className="mr-2" />
                      Export as PDF
                    </MenuItem>
                  </Menu>
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
                  <p className="text-lg">No Saved Researchers in this folder</p>
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {savedResearchers.map((person) => (
                    <div
                      key={person.id}
                      className={`relative flex flex-col justify-between border ${selectedResearchers.includes(person.id)
                        ? "border-blue-500"
                        : "border-[#D9D9D9]"
                        } bg-white rounded-md p-4 shadow-sm hover:shadow-md transition-all cursor-pointer`}
                      onClick={() => {
                        if (selectMode) {
                          toggleSelectResearcher(person.id);
                        } else if (person.slug) {
                          navigate(`/researcher-profile/${person.slug}`);
                        }
                      }}
                    >
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

                            {/* action icons inline with name */}
                            <div className="ml-auto flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openMoveModal(person);
                                }}
                                className="text-gray-500 hover:text-gray-700 p-1 rounded"
                                aria-label="Move"
                              >
                                <FaFolderOpen className="text-2xl" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  confirmUnsave(person);
                                }}
                                className="text-gray-500 hover:text-gray-700 p-1 rounded"
                                aria-label="Remove"
                              >
                                <FaTimes className="text-2xl" />
                              </button>
                            </div>
                          </div>
                          {person.institution.map((inst, idx) => (
                            <p key={idx} className="text-[#6A6A6A] text-sm">
                              {inst}
                            </p>
                          ))}
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

                        {person.fields.map((field, idx) => (
                          <div
                            key={idx} className="text-xs bg-[#4D8BC5] text-white px-3 py-1 rounded-md w-fit">
                            {field}
                          </div>
                        ))}
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
                      className="w-1/5 flex items-center gap-1 focus:outline-none"
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
                      className="flex-1 flex items-center gap-1 focus:outline-none"
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
                    {/* smaller, centered numeric columns */}
                    <button
                      className="w-20 flex items-center justify-center gap-2 focus:outline-none"
                      onClick={() => handleSort("hIndex")}
                    >
                      <span className="text-sm whitespace-nowrap">h-index</span>
                      {sortConfig.key === "hIndex" &&
                        (sortConfig.direction === "asc" ? (
                          <FaSortUp />
                        ) : (
                          <FaSortDown />
                        ))}
                    </button>
                    <button
                      className="w-20 flex items-center justify-center gap-2 focus:outline-none"
                      onClick={() => handleSort("i10Index")}
                    >
                      <span className="text-sm whitespace-nowrap">i10-index</span>
                      {sortConfig.key === "i10Index" &&
                        (sortConfig.direction === "asc" ? (
                          <FaSortUp />
                        ) : (
                          <FaSortDown />
                        ))}
                    </button>
                    <div className="w-28"></div>
                  </div>
                  {/* Data rows */}
                  {sortedResearchers.map((person) => (
                    <div
                      key={person.id}
                      className={`flex items-center border ${selectedResearchers.includes(person.id)
                        ? "border-blue-500"
                        : "border-[#D9D9D9]"
                        } bg-white rounded-md px-4 py-2 shadow-sm hover:shadow-md transition-all cursor-pointer text-md`}
                      onClick={() => {
                        if (selectMode) {
                          toggleSelectResearcher(person.id);
                        } else {
                          // prefer slug when available, fall back to id
                          const slugOrId = person.slug || person.id;
                          navigate(`/researcher-profile/${slugOrId}`);
                        }
                      }}
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
                      <div className="w-1/5 text-[#6A6A6A] text-sm">
                        {person.institution}
                      </div>
                      <div className="flex-1">
                        <span className="text-sm bg-[#4D8BC5] text-white px-3 py-1 rounded-md">
                          {person.field}
                        </span>
                      </div>
                      <div className="w-20 flex items-center justify-center text-[#6A6A6A]">
                        <span className="text-center">{person.hIndex}</span>
                      </div>
                      <div className="w-20 flex items-center justify-center text-[#6A6A6A]">
                        <span className="text-center">{person.i10Index}</span>
                      </div>

                      {/* action icons fixed at row end, closer to numeric columns */}
                      <div className="w-28 flex items-center justify-end gap-6">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openMoveModal(person);
                          }}
                          className="text-gray-600 hover:text-gray-800"
                          aria-label="Move"
                        >
                          <FaFolderOpen />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmUnsave(person);
                          }}
                          className="text-gray-600 hover:text-gray-800"
                          aria-label="Remove"
                        >
                          <FaTimes />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>
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

      {/* Move-to-folder Modal */}
      {moveModalOpen && moveTargetResearcher && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0" onClick={() => closeMoveModal()} />
          <div className="relative bg-white p-6 rounded-2xl shadow-2xl z-60 w-[400px] max-w-full">
            <h3 className="text-lg font-semibold mb-4">Move "{moveTargetResearcher.name}" to folder</h3>
            <div className="flex flex-col gap-3 max-h-60 overflow-y-auto mb-4">
              {folders.map((folder) => (
                <button
                  key={folder.name}
                  onClick={() => handleMoveToFolder(folder)}
                  className="text-left px-4 py-2 rounded hover:bg-gray-100 border"
                >
                  {folder.name}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={closeMoveModal} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
