const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getBookmarks,
  addBookmarks,
  removeBookmark,
  deleteFolder,
  createFolder,
  renameFolder,
  replaceResearchersInFolder,
  updateResearchersInFolder,
  moveResearchersBetweenFolders,
} = require("../controllers/bookmarkController");

// Bookmark routes (all protected - require authentication)
router.get("/", protect, getBookmarks);
router.post("/", protect, addBookmarks);
router.delete("/:id", protect, removeBookmark);
router.delete("/folders/:folderName", protect, deleteFolder);

router.post("/folders", protect, createFolder);
router.patch("/folders/:folderName", protect, renameFolder);
router.put("/folders/:folderName/researchers", protect, replaceResearchersInFolder);
router.patch("/folders/:folderName/researchers", protect, updateResearchersInFolder);
router.post("/folders/move", protect, moveResearchersBetweenFolders);

module.exports = router;
