import React, { useState, useRef } from "react";
import {
    Menu,
    MenuItem,
    IconButton,
    TextField,
    Snackbar,
    Alert,
} from "@mui/material";
import { MoreVert as MoreVertIcon, Add as AddIcon } from "@mui/icons-material";

function FolderSidebar({
    folders = [],
    currentFolderId = null,
    onSelectFolder = () => { },
    onRenameFolder = () => { },
    onDeleteFolder = () => { },
    onCreateFolder = () => { }, // Callback for creating a new folder
}) {
    const [menuAnchorEl, setMenuAnchorEl] = useState(null); // Anchor for the three-dot menu
    const [menuFolder, setMenuFolder] = useState(null); // Folder associated with the menu
    const [renameFolderId, setRenameFolderId] = useState(null); // Folder being renamed
    const [renameValue, setRenameValue] = useState(""); // New name for the folder
    const [deleteFolder, setDeleteFolder] = useState(null); // Folder to delete
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false); // Delete confirmation dialog
    const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false); // Create folder modal
    const [newFolderName, setNewFolderName] = useState(""); // New folder name
    const [toastOpen, setToastOpen] = useState(false); // State for the toast
    const [toastMessage, setToastMessage] = useState(""); // Message for the toast
    const renameInputRef = useRef(null); // Ref for the TextField

    // Open the three-dot menu
    const handleMenuOpen = (event, folder) => {
        setMenuAnchorEl(event.currentTarget);
        setMenuFolder(folder);
    };

    // Close the three-dot menu
    const handleMenuClose = () => {
        setMenuAnchorEl(null);
        setMenuFolder(null);
    };

    // Start renaming a folder (blocked for default "General")
    const handleRenameStart = (folder) => {
        if (!folder || folder.name === "General") return;
        setRenameFolderId(folder.name); // Set the folder being renamed
        setRenameValue(folder.name); // Initialize the rename value with the current name
        handleMenuClose();

        // Focus the input box after a short delay to ensure it is rendered
        setTimeout(() => {
            if (renameInputRef.current) {
                renameInputRef.current.focus();
            }
        }, 0);
    };

    // Save the renamed folder
    const handleRenameSave = () => {
        if (renameValue.trim() && renameValue !== renameFolderId) {
            onRenameFolder(renameFolderId, renameValue.trim()); // Call the parent function to rename the folder
        }
        setRenameFolderId(null); // Clear the rename state
        setRenameValue("");
    };

    // Cancel renaming
    const handleRenameCancel = () => {
        setRenameFolderId(null); // Clear the rename state
        setRenameValue("");
    };

    // Open the delete confirmation dialog (blocked for default "General")
    const handleDeleteStart = (folder) => {
        if (!folder || folder.name === "General") return;
        setDeleteFolder(folder);
        setDeleteDialogOpen(true);
        handleMenuClose();
    };

    // Confirm folder deletion
    const handleDeleteConfirm = () => {
        onDeleteFolder(deleteFolder.name);
        setDeleteDialogOpen(false);
        setDeleteFolder(null);
    };

    // Cancel folder deletion
    const handleDeleteCancel = () => {
        setDeleteDialogOpen(false);
        setDeleteFolder(null);
    };

    // Open the "Create Folder" modal
    const handleCreateFolderOpen = () => {
        setCreateFolderModalOpen(true);
    };

    // Close the "Create Folder" modal
    const handleCreateFolderClose = () => {
        setCreateFolderModalOpen(false);
        setNewFolderName(""); // Reset the input field
    };

    // Handle creating a new folder
    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return; // Prevent empty folder names
        try {
            await onCreateFolder(newFolderName.trim()); // Call the parent function to create the folder
            setToastMessage(`"${newFolderName.trim()}" is created.`); // Set the toast message
            setToastOpen(true); // Show the toast
            handleCreateFolderClose(); // Close the modal
        } catch (error) {
            console.error("Error creating folder:", error);
            setToastMessage("Failed to create folder. Please try again.");
            setToastOpen(true);
        }
    };

    return (
        <aside className="w-1/6 p-0 mt-16 text-black flex-shrink-0">
            <div className="px-3 flex items-center justify-between">
                <h3 className="font-semibold mb-0">Folders</h3>
                <IconButton
                    size="small"
                    onClick={handleCreateFolderOpen}
                    title="Create New Folder"
                >
                    <AddIcon />
                </IconButton>
            </div>
            <hr className="border-t border-gray-300 mt-3 mb-4" />

            <div className="flex flex-col gap-2 px-1">
                {folders.length === 0 && (
                    <div className="text-sm text-gray-500 px-3">No folders</div>
                )}
                {folders.map((f) => {
                    const isActive = currentFolderId === f.name;
                    const isRenaming = renameFolderId === f.name;

                    return (
                        <div key={f.name} className="relative">
                            <div
                                className={`flex items-center justify-between text-left px-3 py-2 rounded-md w-full transition
                  ${isActive
                                        ? "bg-gray-200 text-black"
                                        : "bg-transparent text-black hover:bg-gray-100"
                                    }`}
                                aria-current={isActive ? "true" : undefined}
                            >
                                {isRenaming ? (
                                    <TextField
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onBlur={(e) => {
                                            // Prevent onBlur from firing if the user is interacting with the TextField
                                            if (e.relatedTarget?.tagName === "BUTTON") return;
                                            handleRenameCancel();
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleRenameSave();
                                            if (e.key === "Escape") handleRenameCancel();
                                        }}
                                        size="small"
                                        inputRef={renameInputRef} // Attach the ref to the TextField
                                        variant="outlined"
                                        className="flex-grow"
                                    />
                                ) : (
                                    <button
                                        onClick={() => onSelectFolder(f.name)}
                                        className="truncate flex-grow text-left"
                                    >
                                        {f.name}
                                    </button>
                                )}
                                <span
                                    className={`text-sm ${isActive ? "text-black/80" : "text-gray-500"
                                        }`}
                                >
                                    {(f.researcherIds || []).length}
                                </span>
                                <IconButton
                                    size="small"
                                    onClick={(e) => handleMenuOpen(e, f)}
                                    className={`ml-2 ${f.name === "General" ? "invisible pointer-events-none" : ""}`}
                                    aria-hidden={f.name === "General"}
                                >
                                    <MoreVertIcon />
                                </IconButton>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Three-dot menu */}
            <Menu
                anchorEl={menuAnchorEl}
                open={Boolean(menuAnchorEl)}
                onClose={handleMenuClose}
            >
                <MenuItem
                    onClick={() => handleRenameStart(menuFolder)}
                    disabled={!menuFolder || menuFolder.name === "General"}
                >
                    Rename
                </MenuItem>
                <MenuItem
                    onClick={() => handleDeleteStart(menuFolder)}
                    disabled={!menuFolder || menuFolder.name === "General"}
                >
                    Delete
                </MenuItem>
            </Menu>

            {/* Delete confirmation modal (matches researcher delete style) */}
            {deleteDialogOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
                    role="dialog"
                    aria-modal="true"
                >
                    <div
                        className="absolute inset-0"
                        onClick={handleDeleteCancel}
                    />
                    <div className="relative bg-white p-6 rounded-2xl shadow-2xl z-60 w-fit max-w-full">
                        <p className="text-xl font-semibold text-gray-800 mb-4 text-center">
                            Delete folder
                            {" "}
                            <span className="text-gray-700 font-bold">"{deleteFolder?.name}"</span>
                            ?
                        </p>
                        <p className="text-sm text-gray-600 mb-6 text-center">
                            All researchers inside this folder will also be removed.
                        </p>
                        <div className="flex justify-center gap-4">
                            <button
                                onClick={handleDeleteConfirm}
                                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition"
                            >
                                Yes
                            </button>
                            <button
                                onClick={handleDeleteCancel}
                                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md transition"
                            >
                                No
                            </button>
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
                        onClick={handleCreateFolderClose}
                    />
                    <div className="relative bg-white p-6 rounded-2xl shadow-2xl z-60 w-[400px] max-w-full">
                        <h3 className="text-lg font-semibold mb-2 text-center">
                            Create New Folder
                        </h3>
                        <div className="text-center text-gray-500 text-sm mb-4">
                            Enter a name for your new folder:
                        </div>
                        <input
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="Folder name"
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex justify-end gap-3 mt-4">
                            <button
                                onClick={handleCreateFolderClose}
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

            {/* Toast for folder creation */}
            <Snackbar
                open={toastOpen}
                autoHideDuration={6000}
                onClose={() => setToastOpen(false)}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            >
                <Alert severity="success" onClose={() => setToastOpen(false)}>
                    {toastMessage}
                </Alert>
            </Snackbar>
        </aside>
    );
}

export default React.memo(FolderSidebar);
