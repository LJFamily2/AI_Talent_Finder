const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getBookmarks,
  addBookmarks,
  removeBookmark,
} = require("../controllers/bookmarkController");

// Bookmark routes (all protected - require authentication)
router.get("/", protect, getBookmarks);
router.post("/", protect, addBookmarks);
router.delete("/:id", protect, removeBookmark);

module.exports = router;
