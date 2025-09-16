import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaThLarge,
  FaBars,
  FaDownload,
  FaUserSlash,
  FaFilePdf,
  FaSortUp,
  FaSortDown,
  FaTimes,
} from "react-icons/fa";
import { RiFolderSharedFill } from "react-icons/ri";
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
import { getBookmarks, removeBookmark, moveResearchersBetweenFolders, renameFolder, deleteFolder, createFolder, updateResearchersInFolder } from "../services/bookmarkService";
import { exportResearchersToExcel } from "../services/exportService";
import { exportResearchersWithFullData } from "../services/pdfExportService";
import SavedResearchCard from '../components/SavedResearchCard';
import SavedResearchRow from '../components/SavedResearchRow';
import FolderSidebar from '../components/FolderSidebar';

export default function SavedResearchers() {
  const navigate = useNavigate();
  const [savedResearchers, setSavedResearchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [targetResearcher, setTargetResearcher] = useState(null);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveTargetResearcher, setMoveTargetResearcher] = useState(null);
  // Bulk actions state
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // folders are unique by name; structure: { name, researcherIds: [] }
  const [folders, setFolders] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null); // holds folder.name

  const [selectMode, setSelectMode] = useState(false);
  const [selectedResearchers, setSelectedResearchers] = useState([]);

  const [viewMode, setViewMode] = useState("list"); // 'list' or 'grid' (show list first)

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

      // Get all folders data
      const res = await getBookmarks();
      const foldersList = res?.data || [];

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
        ? savedResearchers.filter((r) => selectedResearchers.includes(r._id))
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
        setSelectMode(false);
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
        ? savedResearchers.filter((r) => selectedResearchers.includes(r._id))
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
        setSelectMode(false);
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

  // Helper to normalize id
  const getIdStr = (obj) => {
    if (!obj) return null;
    return (
      (obj._id && obj._id.toString && obj._id.toString()) ||
      (obj.id && obj.id.toString && obj.id.toString()) ||
      obj.slug ||
      (typeof obj === 'string' ? obj : null)
    );
  };

  const openBulkMove = () => {
    if (selectedResearchers.length === 0) return;
    setBulkMoveOpen(true);
  };

  const openBulkDelete = () => {
    if (selectedResearchers.length === 0) return;
    setBulkDeleteOpen(true);
  };

  const performBulkMoveToFolder = async (dstFolderName) => {
    try {
      const ids = selectedResearchers.map((id) => String(id));
      if (!ids.length) return;
      if (!currentFolderId || currentFolderId === dstFolderName) {
        showToast('Please choose a different destination folder', 'warning');
        return;
      }
      // Determine which IDs already exist in destination and skip them
      const dstFolder = folders.find(f => f.name === dstFolderName);
      const dstSet = new Set((dstFolder?.researcherIds || []).map((item) => {
        const val = (item && typeof item === 'object')
          ? ((item._id && item._id.toString && item._id.toString()) || item.id || item.slug)
          : item;
        return String(val);
      }));
      const toMove = ids.filter(id => !dstSet.has(String(id)));
      const skipped = ids.filter(id => dstSet.has(String(id)));
      const idToName = new Map(savedResearchers.map(r => {
        const rid = (r._id && r._id.toString && r._id.toString()) || r.id || r.slug || (r.__raw && (r.__raw._id || r.__raw.id));
        const nm = r.basic_info?.name || r.name || r.display_name || r.slug || String(rid);
        return [String(rid), nm];
      }));
      const movedNames = toMove.map(id => idToName.get(String(id)) || String(id));
      const skippedNames = skipped.map(id => idToName.get(String(id)) || String(id));

      if (!toMove.length) {
        // Nothing to move: only skipped
        const msg = skippedNames.length
          ? `${skippedNames.join(', ')} already exist in "${dstFolderName}" and were not moved.`
          : 'Nothing to move.';
        showToast(msg, skippedNames.length ? 'warning' : 'info');
        setBulkMoveOpen(false);
        return;
      }

      setLoading(true);
      await moveResearchersBetweenFolders(currentFolderId, dstFolderName, toMove);
      // Refresh folders and selection
      await fetchBookmarks();
      setSelectedResearchers([]);
      setSelectMode(false);
      // Combined message for moved + skipped (if any)
      const movedPart = `Moved ${movedNames.join(', ')} to "${dstFolderName}".`;
      const skippedPart = skippedNames.length ? ` ${skippedNames.join(', ')} already exist in "${dstFolderName}" and were not moved.` : '';
      showToast(`${movedPart}${skippedPart}`, 'success');
    } catch (err) {
      console.error('Bulk move failed:', err);
      showToast('Failed to move selected researchers', 'error');
    } finally {
      setLoading(false);
      setBulkMoveOpen(false);
    }
  };

  const performBulkDelete = async () => {
    try {
      const ids = selectedResearchers.map((id) => String(id));
      const idToName = new Map(savedResearchers.map(r => {
        const rid = (r._id && r._id.toString && r._id.toString()) || r.id || r.slug || (r.__raw && (r.__raw._id || r.__raw.id));
        const nm = r.basic_info?.name || r.name || r.display_name || r.slug || String(rid);
        return [String(rid), nm];
      }));
      const names = ids.map(id => idToName.get(String(id)) || String(id));
      if (!ids.length) return;
      setLoading(true);
      // Use bulk remove endpoint for efficiency
      await updateResearchersInFolder(currentFolderId, { remove: ids });
      await fetchBookmarks();
      setSelectedResearchers([]);
      setSelectMode(false);
      showToast(`Removed ${names.join(', ')} from "${currentFolderId}"`, 'success');
    } catch (err) {
      console.error('Bulk remove failed:', err);
      showToast('Failed to remove selected researchers', 'error');
    } finally {
      setLoading(false);
      setBulkDeleteOpen(false);
    }
  };

  const handleMoveToFolder = async (folder) => {
    if (!moveTargetResearcher) return;

    const srcName = currentFolderId;
    const dstName = folder.name;

    // Check if the source and destination folders are the same
    if (srcName === dstName) {
      showToast("Researcher already in the selected folder", "warning");
      closeMoveModal();
      return;
    }

    const idStr =
      (moveTargetResearcher._id && moveTargetResearcher._id.toString && moveTargetResearcher._id.toString()) ||
      (moveTargetResearcher.id && moveTargetResearcher.id.toString && moveTargetResearcher.id.toString()) ||
      moveTargetResearcher.slug ||
      null;

    if (!idStr) {
      console.error("Cannot determine researcher id for move", moveTargetResearcher);
      showToast("Failed to move researcher", "error");
      closeMoveModal();
      return;
    }

    // Check if the researcher already exists in the target folder
    const targetFolder = folders.find((f) => f.name === dstName);
    const alreadyExists = targetFolder?.researcherIds.some((item) => {
      const val =
        (item._id && item._id.toString && item._id.toString()) ||
        (item.id && item.id.toString && item.id.toString()) ||
        item.slug ||
        item.toString();
      return String(val) === String(idStr);
    });

    if (alreadyExists) {
      showToast(`Researcher already exists in the folder "${dstName}"`, "warning");
      closeMoveModal();
      return;
    }

    try {
      setLoading(true);
      await moveResearchersBetweenFolders(srcName, dstName, [idStr]);

      // Update local folders: remove from source, add to destination
      setFolders((prev) =>
        prev.map((f) => {
          if (f.name === srcName) {
            const nextIds = (f.researcherIds || []).filter((item) => {
              const val =
                (item._id && item._id.toString && item._id.toString()) ||
                (item.id && item.id.toString && item.id.toString()) ||
                item.slug ||
                item.toString();
              return String(val) !== String(idStr);
            });
            return { ...f, researcherIds: nextIds };
          }
          if (f.name === dstName) {
            const storesObjects = (f.researcherIds || []).some((it) => it && typeof it === "object" && (it._id || it.id));
            const toAdd = storesObjects ? moveTargetResearcher : idStr;
            return { ...f, researcherIds: [...(f.researcherIds || []), toAdd] };
          }
          return f;
        })
      );

      // If the current view was the source folder, remove from displayed list
      if (currentFolderId === srcName) {
        setSavedResearchers((prev) =>
          prev.filter((r) => {
            const rid =
              (r._id && r._id.toString && r._id.toString()) ||
              r.id ||
              r.slug ||
              (r.__raw && (r.__raw._id || r.__raw.id));
            return String(rid) !== String(idStr);
          })
        );
      }

      showToast(`Moved "${moveTargetResearcher.basic_info?.name || moveTargetResearcher.name || idStr}" to "${folder.name}"`, "success");
    } catch (err) {
      console.error("Move failed:", err);
      showToast("Failed to move researcher. Please try again.", "error");
    } finally {
      setLoading(false);
      closeMoveModal();
    }
  };

  const unsaveResearcher = async () => {
    if (!targetResearcher) {
      setShowModal(false);
      return;
    }

    const idStr =
      (targetResearcher._id && targetResearcher._id.toString && targetResearcher._id.toString()) ||
      (targetResearcher.id && targetResearcher.id.toString && targetResearcher.id.toString()) ||
      targetResearcher.slug ||
      null;

    if (!idStr) {
      console.error("Cannot determine researcher id for removal", targetResearcher);
      showToast("Failed to remove bookmark", "error");
      setShowModal(false);
      return;
    }

    try {
      // Pass current folder to ensure removal from the right folder on server
      await removeBookmark(idStr, currentFolderId);

      // Update displayed list (savedResearchers) for the current folder
      if (currentFolderId) {
        setSavedResearchers((prev) =>
          prev.filter((r) => {
            const rid = (r._id && r._id.toString && r._id.toString()) || r.id || r.slug || (r.__raw && (r.__raw._id || r.__raw.id));
            return String(rid) !== String(idStr);
          })
        );
      }

      // Update folder counts/local lists for the specific folder
      setFolders((prev) =>
        prev.map((f) => {
          if (f.name === currentFolderId) {
            const nextIds = (f.researcherIds || []).filter((item) => {
              if (!item) return false;
              const val =
                (item._id && item._id.toString && item._id.toString()) ||
                (item.id && item.id.toString && item.id.toString()) ||
                item.slug ||
                item.toString();
              return String(val) !== String(idStr);
            });
            return { ...f, researcherIds: nextIds };
          }
          return f;
        })
      );

      const displayName =
        targetResearcher.basic_info?.name ||
        targetResearcher.name ||
        targetResearcher.display_name ||
        targetResearcher.slug ||
        idStr;

      showToast(`${displayName} has been removed from "${currentFolderId}"`, "success");
    } catch (error) {
      console.error("Error removing bookmark:", error);
      showToast("Failed to remove bookmark", "error");
    } finally {
      setShowModal(false);
    }
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
  const getSortValue = (person, key) => {
    // string fields
    if (key === "name") {
      return (
        person.basic_info?.name ||
        person.name ||
        person.display_name ||
        person.__raw?.name ||
        ""
      ).toString().toLowerCase();
    }
    if (key === "institution") {
      return (
        person.current_affiliations?.[0]?.display_name ||
        person.institution ||
        (Array.isArray(person.institutions) && person.institutions[0]) ||
        ""
      ).toString().toLowerCase();
    }

    // numeric fields: be tolerant of different shapes/names
    // metrics may live at person.research_metrics, person.__raw.research_metrics, or at root
    const metrics = person.research_metrics || person.__raw?.research_metrics || person;

    const totalCitations = Number(
      metrics?.total_citations ?? 0
    );

    const totalWorks = Number(
      metrics?.total_works ?? 0
    );

    const hIndex = Number(
      metrics?.h_index ?? 0
    );

    const i10Index = Number(
      metrics?.i10_index ?? 0
    );

    switch (key) {
      case "total_citations":
        return totalCitations;
      case "total_works":
        return totalWorks;
      case "hIndex":
        return hIndex;
      case "i10Index":
        return i10Index;
      default:
        return 0;
    }
  };

  const sortedResearchers = React.useMemo(() => {
    const sortable = [...savedResearchers];
    if (!sortConfig.key) return sortable;
    const key = sortConfig.key;
    sortable.sort((a, b) => {
      const va = getSortValue(a, key);
      const vb = getSortValue(b, key);
      if (typeof va === "string" && typeof vb === "string") {
        if (va < vb) return sortConfig.direction === "asc" ? -1 : 1;
        if (va > vb) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      }
      // numeric compare
      return sortConfig.direction === "asc" ? va - vb : vb - va;
    });
    return sortable;
  }, [savedResearchers, sortConfig]);

  // Handler for sorting
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleDeleteFolder = async (folderName) => {
    if (folderName === "General") {
      showToast("Cannot delete the default 'General' folder", "warning");
      return;
    }
    try {
      // Call the deleteFolder service to delete the folder on the backend
      await deleteFolder(folderName);

      // Update the folders state to remove the deleted folder
      setFolders((prevFolders) => prevFolders.filter((f) => f.name !== folderName));

      // If the deleted folder is the currently selected folder, reset the current folder
      if (currentFolderId === folderName) {
        setCurrentFolderId(null);
        setSavedResearchers([]);
      }

      showToast(`Folder "${folderName}" has been deleted`, "success");
    } catch (error) {
      console.error("Error deleting folder:", error);
      showToast("Failed to delete folder. Please try again.", "error");
    }
  };

  const handleRenameFolder = async (oldName, newName) => {
    if (oldName === "General") {
      showToast("Cannot rename the default 'General' folder", "warning");
      return;
    }
    try {
      // Call the renameFolder service to update the folder name on the backend
      await renameFolder(oldName, newName);

      // Update the folders state to reflect the new name
      setFolders((prevFolders) =>
        prevFolders.map((f) =>
          f.name === oldName ? { ...f, name: newName } : f
        )
      );

      // If the renamed folder is the currently selected folder, update the currentFolderId
      if (currentFolderId === oldName) {
        setCurrentFolderId(newName);
      }

      showToast(`Folder renamed to "${newName}"`, "success");
    } catch (error) {
      console.error("Error renaming folder:", error);
      showToast("Failed to rename folder. Please try again.", "error");
    }
  };

  const handleCreateFolder = async (newFolderName) => {
    if (!newFolderName.trim()) {
      showToast("Folder name cannot be empty", "warning");
      return;
    }

    try {
      // Call the createFolder service to create the folder on the backend
      await createFolder(newFolderName.trim());

      // Update the folders state to include the new folder
      setFolders((prevFolders) => [
        ...prevFolders,
        { name: newFolderName, researcherIds: [] },
      ]);

      showToast(`Folder "${newFolderName}" has been created`, "success");
    } catch (error) {
      console.error("Error creating folder:", error);
      showToast("Failed to create folder. Please try again.", "error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <div className="w-full bg-[#000054] fixed top-0 left-0 z-10">
        <Header />
      </div>
      <div className="w-full flex-grow mx-auto py-10 pt-24">
        <div className="w-7/8 mx-auto flex gap-6">
          {/* Left: folders navigation (transparent background, subtle hover, active highlight) */}
          <FolderSidebar
            folders={folders}
            currentFolderId={currentFolderId}
            onSelectFolder={handleFolderSelect}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onCreateFolder={handleCreateFolder}
          />

          {/* Right: main content */}
          <main className="flex-1">
            <div className="w-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  {/* Saved Researchers */}
                  <div className="flex rounded-lg overflow-hidden border border-blue-200 ml-2">
                    <button
                      onClick={() => setViewMode("list")}
                      className={`px-3 py-2 flex items-center justify-center transition
                                            ${viewMode === "list"
                          ? "bg-blue-600 text-white"
                          : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                        }
                                            border-r border-blue-200`}
                      style={{
                        borderTopLeftRadius: "0.5rem",
                        borderBottomLeftRadius: "0.5rem",
                      }}
                      title="List view"
                    >
                      <FaBars className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`px-3 py-2 flex items-center justify-center transition
                                            ${viewMode === "grid"
                          ? "bg-blue-600 text-white"
                          : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                        }`}
                      style={{
                        borderTopRightRadius: "0.5rem",
                        borderBottomRightRadius: "0.5rem",
                      }}
                      title="Grid view"
                    >
                      <FaThLarge className="w-5 h-5" />
                    </button>
                  </div>
                </h2>
                <div className="flex items-center gap-4">
                  <button
                    onClick={toggleSelectMode}
                    className="rounded-md bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium px-4 py-2 transition"
                  >
                    {selectMode ? "Cancel" : "Select"}
                  </button>

                  {selectMode && (
                    <>
                      <button
                        onClick={openBulkMove}
                        disabled={selectedResearchers.length === 0}
                        className={`rounded-md font-medium px-4 py-2 transition flex items-center gap-2 ${selectedResearchers.length === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                      >
                        <RiFolderSharedFill />
                        Move
                      </button>
                      <button
                        onClick={openBulkDelete}
                        disabled={selectedResearchers.length === 0}
                        className={`rounded-md font-medium px-4 py-2 transition flex items-center gap-2 ${selectedResearchers.length === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                      >
                        <FaTimes />
                        Delete
                      </button>
                    </>
                  )}

                  <button
                    onClick={(e) => handleExportMenuClick(e)}
                    disabled={loading || (selectMode && selectedResearchers.length === 0)}
                    className={`rounded-md font-medium px-4 py-2 transition flex items-center gap-2 ${
                      loading || (selectMode && selectedResearchers.length === 0)
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                    title="Export"
                  >
                    <FaDownload />
                    {loading
                      ? "Exporting..."
                      : selectMode
                        ? `Export Selected (${selectedResearchers.length})`
                        : "Export All"}
                  </button>
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
                  {savedResearchers.map(person => (
                    <SavedResearchCard
                      key={person._id}
                      person={person}
                      selectMode={selectMode}
                      selectedResearchers={selectedResearchers}
                      toggleSelectResearcher={toggleSelectResearcher}
                      openMoveModal={openMoveModal}
                      confirmUnsave={confirmUnsave}
                      onNavigate={(slugOrId) => navigate(`/researcher-profile/${slugOrId}`)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {/* Header row */}
                  <div className="flex items-center bg-blue-50 border border-blue-200 rounded-md px-4 py-2 font-semibold text-gray-700 text-sm">
                    <button
                      className="w-1/4 flex items-center gap-1 focus:outline-none cursor-pointer"
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
                      className="w-1/3 flex items-center gap-1 focus:outline-none cursor-pointer"
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
                      className="w-1/7 flex items-center justify-center gap-1 focus:outline-none cursor-pointer"
                      onClick={() => handleSort("total_citations")}
                    >
                      Total citations
                      {sortConfig.key === "total_citations" &&
                        (sortConfig.direction === "asc" ? (
                          <FaSortUp />
                        ) : (
                          <FaSortDown />
                        ))}
                    </button>
                    <button
                      className="w-1/8 flex items-center justify-center gap-1 focus:outline-none cursor-pointer"
                      onClick={() => handleSort("total_works")}
                    >
                      Total works
                      {sortConfig.key === "total_works" &&
                        (sortConfig.direction === "asc" ? (
                          <FaSortUp />
                        ) : (
                          <FaSortDown />
                        ))}
                    </button>

                    {/* smaller, centered numeric columns */}
                    <button
                      className="w-1/11 flex items-center justify-center gap-2 focus:outline-none cursor-pointer"
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
                      className="w-1/11 flex items-center justify-center gap-2 focus:outline-none cursor-pointer"
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
                    <div className="w-1/12"></div>
                  </div>
                  {/* Data rows */}
                  {sortedResearchers.map((person) => (
                    <SavedResearchRow
                      key={person._id}
                      person={person}
                      selectMode={selectMode}
                      selectedResearchers={selectedResearchers}
                      toggleSelectResearcher={toggleSelectResearcher}
                      openMoveModal={openMoveModal}
                      confirmUnsave={confirmUnsave}
                      onNavigate={(slugOrId) => navigate(`/researcher-profile/${slugOrId}`)}
                    />
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

          <div className="relative bg-white p-6 rounded-2xl shadow-2xl z-60 w-fit max-w-full">
            <p className="text-xl font-semibold text-gray-800 mb-6 text-center">
              Remove
              {" "}
              <span className="text-gray-700 font-bold">
                "{targetResearcher?.basic_info?.name || targetResearcher?.name || targetResearcher?.display_name || targetResearcher?.slug || ""}"
              </span>
              {" "}
              from
              {" "}
              <span className="text-blue-700 font-bold">
                "{currentFolderId}"
              </span>
              ?
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

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0" onClick={() => setBulkDeleteOpen(false)} />
          <div className="relative bg-white p-6 rounded-2xl shadow-2xl z-60 w-fit max-w-full">
            {(() => {
              const idToName = new Map(savedResearchers.map(r => {
                const rid = (r._id && r._id.toString && r._id.toString()) || r.id || r.slug || (r.__raw && (r.__raw._id || r.__raw.id));
                const nm = r.basic_info?.name || r.name || r.display_name || r.slug || String(rid);
                return [String(rid), nm];
              }));
              const names = selectedResearchers.map(id => idToName.get(String(id)) || String(id));
              return (
                <p className="text-xl font-semibold text-gray-800 mb-6 text-center">
                  Remove {names.join(', ')} from <span className="text-blue-700 font-bold">"{currentFolderId}"</span>?
                </p>
              );
            })()}
            <div className="flex justify-center gap-4">
              <button onClick={performBulkDelete} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition">Yes</button>
              <button onClick={() => setBulkDeleteOpen(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md transition">No</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Move Modal */}
      {bulkMoveOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0" onClick={() => setBulkMoveOpen(false)} />
          <div className="relative bg-white p-6 rounded-2xl shadow-2xl z-60 w-[400px] max-w-full">
            <h3 className="text-lg font-semibold mb-2 text-center">Move {selectedResearchers.length} selected {selectedResearchers.length > 1 ? 'researchers' : 'researcher'}</h3>
            <div className="text-center text-gray-500 text-sm mb-4">
              Current Folder: <span className="font-semibold text-blue-700">"{currentFolderId}"</span>
            </div>
            <div className="flex flex-col gap-3 max-h-60 overflow-y-auto mb-4">
              {folders.filter(f => f.name !== currentFolderId).map(folder => (
                <button key={folder.name} onClick={() => performBulkMoveToFolder(folder.name)} className="text-left px-4 py-2 rounded hover:bg-gray-100 border">
                  {folder.name}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setBulkMoveOpen(false)} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
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
            <h3 className="text-lg font-semibold mb-2 text-center">
              Move
              {" "}
              <span className="text-gray-700 font-bold">
                "{moveTargetResearcher.basic_info.name}"
              </span>
            </h3>
            <div className="text-center text-gray-500 text-sm mb-4">
              Current Folder: <span className="font-semibold text-blue-700">"{currentFolderId}"</span>
            </div>
            <div className="flex flex-col gap-3 max-h-60 overflow-y-auto mb-4">
              {folders
                .filter((f) => f.name !== currentFolderId)
                .map((folder) => (
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
