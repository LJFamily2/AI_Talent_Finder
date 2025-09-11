import React, { useState, useEffect } from "react";
import { FaRegBookmark, FaBookmark } from "react-icons/fa";
import {
    Snackbar,
    Alert,
    Button,
    Checkbox,
    FormControlLabel,
    TextField,
} from "@mui/material";
import { addBookmarks, removeBookmark, getBookmarkIds, createFolder } from "../services/bookmarkService";

const BookmarkIcon = ({ researcherId, researcherName, onBookmarkChange }) => {
    const [isBookmarked, setIsBookMarked] = useState(false);
    const [bookmarkLoading, setBookmarkLoading] = useState(true);
    const [moveFolderModalOpen, setMoveFolderModalOpen] = useState(false);
    const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false); // State for the "Create Folder" modal
    const [folders, setFolders] = useState([]); // State to store folder names and researcher IDs
    const [selectedFolders, setSelectedFolders] = useState([]);
    const [newFolderName, setNewFolderName] = useState(""); // State for the new folder name
    const [snackbarOpenSave, setSnackbarOpenSave] = useState(false); // State for Snackbar
    const [snackbarOpen, setSnackbarOpen] = useState(false); // State for Snackbar
    const [snackbarMessage, setSnackbarMessage] = useState(""); // Message for Snackbar

    // Fetch folder names and researcher IDs
    const fetchFolderIds = async () => {
        try {
            const bookmarks = await getBookmarkIds(); // Fetch only folder names and researcher IDs
            const fetchedFolders = bookmarks?.data || [];
            setFolders(fetchedFolders);

            // Check if the researcher is bookmarked in any folder
            const isBookmarkedInAnyFolder = fetchedFolders.some((folder) =>
                folder.researcherIds.includes(researcherId)
            );
            setIsBookMarked(isBookmarkedInAnyFolder);

            // Pre-select folders where the researcher is bookmarked
            const bookmarkedFolders = fetchedFolders
                .filter((folder) => folder.researcherIds.includes(researcherId))
                .map((folder) => folder.name);
            setSelectedFolders(bookmarkedFolders);
        } catch (error) {
            console.error("Error fetching folder IDs or checking bookmark status:", error);
        } finally {
            setBookmarkLoading(false);
        }
    };

    // Toggle bookmark status
    const toggleBookmark = async () => {
        if (isBookmarked) {
            // Open the modal to allow the user to manage bookmarks
            setMoveFolderModalOpen(true);
        } else {
            try {
                // Save the profile to the default folder
                await addBookmarks([researcherId], "General");
                setIsBookMarked(true);
                if (onBookmarkChange) onBookmarkChange(true);

                // Pre-select "General" in the modal
                setSelectedFolders(["General"]);

                // Show the Snackbar with the "Add to other folders?" link
                setSnackbarOpenSave(true);
            } catch (error) {
                console.error("Error saving bookmark:", error);
            }
        }
    };

    // Handle folder selection in the modal
    const handleToggleFolder = (folderName) => {
        setSelectedFolders((prev) =>
            prev.includes(folderName)
                ? prev.filter((name) => name !== folderName)
                : [...prev, folderName]
        );
    };

    // Save changes to folders
    const handleSaveToFolders = async () => {
        try {
            // Remove the researcher from folders that were unchecked
            const foldersToRemove = folders
                .filter((folder) => folder.researcherIds.includes(researcherId))
                .map((folder) => folder.name)
                .filter((folderName) => !selectedFolders.includes(folderName));
            await Promise.all(
                foldersToRemove.map((folderName) =>
                    removeBookmark(researcherId, folderName)
                )
            );

            // Add the researcher to folders that were newly checked
            const foldersToAdd = selectedFolders.filter(
                (folderName) =>
                    !folders
                        .filter((folder) => folder.researcherIds.includes(researcherId))
                        .map((folder) => folder.name)
                        .includes(folderName)
            );
            await Promise.all(
                foldersToAdd.map((folderName) =>
                    addBookmarks([researcherId], folderName)
                )
            );

            // Update the bookmark status
            const stillBookmarked = selectedFolders.length > 0;
            setIsBookMarked(stillBookmarked);
            if (onBookmarkChange) onBookmarkChange(stillBookmarked);

            // Set the appropriate message for the Snackbar
            if (selectedFolders.length === 0) {
                setSnackbarMessage(`"${researcherName}" is no longer bookmarked.`);
            } else {
                setSnackbarMessage(
                    `"${researcherName}" has been updated in the following folders: ${selectedFolders.join(
                        ", "
                    )}.`
                );
            }
            setSnackbarOpen(true);

            console.log("Folder changes saved successfully.");
        } catch (error) {
            console.error("Error saving folder changes:", error);
        } finally {
            setMoveFolderModalOpen(false);
        }
    };

    // Handle creating a new folder
    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return; // Prevent empty folder names
        try {
            await createFolder(newFolderName.trim());
            setFolders((prev) => [...prev, { name: newFolderName.trim(), researcherIds: [] }]); // Add the new folder to the list
            setNewFolderName(""); // Reset the input field
            setCreateFolderModalOpen(false); // Close the "Create Folder" modal
        } catch (error) {
            console.error("Error creating folder:", error);
        }
    };

    useEffect(() => {
        fetchFolderIds(); // Fetch folder IDs when the component mounts
    }, [researcherId]);

    return (
        <>
            {/* Bookmark Icon */}
            <button
                onClick={() => toggleBookmark()}
                className="text-yellow-500 hover:text-yellow-600 transition"
                aria-label="Bookmark"
                title={isBookmarked ? "Unsave Profile" : "Save Profile"}
                disabled={bookmarkLoading}
            >
                {bookmarkLoading ? (
                    <span></span>
                ) : isBookmarked ? (
                    <FaBookmark className="w-6 h-6" />
                ) : (
                    <FaRegBookmark className="w-6 h-6" />
                )}
            </button>

            {/* Snackbar for "Saved to General" */}
            <Snackbar
                open={snackbarOpenSave}
                autoHideDuration={6000}
                onClose={() => setSnackbarOpenSave(false)}
                anchorOrigin={{ vertical: "top", horizontal: "center" }}
            >
                <Alert severity="success">
                    <span>
                        Saved to "General".{" "}
                        <Button
                            color="inherit"
                            size="small"
                            onClick={() => {
                                setSnackbarOpen(false); // Close the Snackbar
                                setMoveFolderModalOpen(true); // Open the modal
                            }}
                            sx={{
                                textTransform: "none", // Disable uppercase
                                padding: 0, // Remove padding to make it inline
                                minWidth: "unset", // Remove default button width
                                fontWeight: "bold", // Make it stand out
                                textDecoration: "underline", // Make it look like a link
                            }}
                        >
                            Add to other folders?
                        </Button>
                    </span>
                </Alert>
            </Snackbar>

            {/* Snackbar for actions */}
            <Snackbar
                open={snackbarOpen}
                autoHideDuration={6000}
                onClose={() => setSnackbarOpen(false)}
                anchorOrigin={{ vertical: "top", horizontal: "center" }}
            >
                <Alert severity="success" onClose={() => setSnackbarOpen(false)}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>

            {/* Move Folder Modal */}
            {moveFolderModalOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
                    role="dialog"
                    aria-modal="true"
                >
                    <div
                        className="absolute inset-0"
                        onClick={() => setMoveFolderModalOpen(false)}
                    />
                    <div className="relative bg-white p-6 rounded-2xl shadow-2xl z-60 w-[400px] max-w-full">
                        <h3 className="text-lg font-semibold mb-2 text-center">
                            Manage Folders
                        </h3>
                        <div className="text-center text-gray-500 text-sm mb-4">
                            Check or uncheck folders to manage bookmarks
                        </div>
                        <div className="flex flex-col gap-3 max-h-60 overflow-y-auto mb-4">
                            {folders.map((folder) => (
                                <FormControlLabel
                                    key={folder.name}
                                    control={
                                        <Checkbox
                                            checked={selectedFolders.includes(folder.name)}
                                            onChange={() => handleToggleFolder(folder.name)}
                                        />
                                    }
                                    label={folder.name}
                                />
                            ))}
                        </div>
                        <div className="flex justify-between items-center gap-3">
                            {/* Create New Folder Button */}
                            <Button
                                onClick={() => setCreateFolderModalOpen(true)}
                                sx={{
                                    textTransform: "none",
                                    padding: "8px 16px",
                                    border: "1px dashed #ccc",
                                    borderRadius: "8px",
                                }}
                            >
                                + Create New Folder
                            </Button>
                            <div className="flex gap-3">
                                {/* Cancel Button */}
                                <button
                                    onClick={() => setMoveFolderModalOpen(false)}
                                    className="px-4 py-2 bg-gray-200 rounded"
                                >
                                    Cancel
                                </button>
                                {/* Save Button */}
                                <button
                                    onClick={handleSaveToFolders}
                                    className="px-4 py-2 bg-blue-600 text-white rounded"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Folder Modal */}
            {createFolderModalOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
                    role="dialog"
                    aria-modal="true"
                >
                    <div
                        className="absolute inset-0"
                        onClick={() => setCreateFolderModalOpen(false)}
                    />
                    <div className="relative bg-white p-6 rounded-2xl shadow-2xl z-60 w-[400px] max-w-full">
                        <h3 className="text-lg font-semibold mb-2 text-center">
                            Create New Folder
                        </h3>
                        <TextField
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="Enter folder name"
                            fullWidth
                            variant="outlined"
                            size="small"
                        />
                        <div className="flex justify-end gap-3 mt-4">
                            <button
                                onClick={() => setCreateFolderModalOpen(false)}
                                className="px-4 py-2 bg-gray-200 rounded"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateFolder}
                                className="px-4 py-2 bg-blue-600 text-white rounded"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default BookmarkIcon;
