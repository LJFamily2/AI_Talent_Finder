import React, { useState, useRef } from "react";
import {
    Menu,
    MenuItem,
    IconButton,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Button,
    TextField,
} from "@mui/material";
import { MoreVert as MoreVertIcon } from "@mui/icons-material";

function FolderSidebar({
    folders = [],
    currentFolderId = null,
    onSelectFolder = () => { },
    onRenameFolder = () => { },
    onDeleteFolder = () => { },
}) {
    const [menuAnchorEl, setMenuAnchorEl] = useState(null); // Anchor for the three-dot menu
    const [menuFolder, setMenuFolder] = useState(null); // Folder associated with the menu
    const [renameFolderId, setRenameFolderId] = useState(null); // Folder being renamed
    const [renameValue, setRenameValue] = useState(""); // New name for the folder
    const [deleteFolder, setDeleteFolder] = useState(null); // Folder to delete
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false); // Delete confirmation dialog
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

    // Start renaming a folder
    const handleRenameStart = (folder) => {
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

    // Open the delete confirmation dialog
    const handleDeleteStart = (folder) => {
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

    return (
        <aside className="w-1/6 p-0 mt-16 text-black flex-shrink-0">
            <div className="px-3">
                <h3 className="font-semibold mb-0">Folders</h3>
                <hr className="border-t border-gray-300 mt-3 mb-4" />
            </div>

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
                                    className="ml-2"
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
                <MenuItem onClick={() => handleRenameStart(menuFolder)}>Rename</MenuItem>
                <MenuItem onClick={() => handleDeleteStart(menuFolder)}>Delete</MenuItem>
            </Menu>

            {/* Delete confirmation dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={handleDeleteCancel}
                aria-labelledby="delete-folder-dialog-title"
            >
                <DialogTitle id="delete-folder-dialog-title">Delete Folder</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete the folder{" "}
                        <strong>{deleteFolder?.name}</strong>? All researchers inside this
                        folder will also be deleted.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDeleteCancel} color="primary">
                        No
                    </Button>
                    <Button onClick={handleDeleteConfirm} color="secondary">
                        Yes
                    </Button>
                </DialogActions>
            </Dialog>
        </aside>
    );
}

export default React.memo(FolderSidebar);