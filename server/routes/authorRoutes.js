const express = require("express");
const router = express.Router();
const { searchByAuthor, saveToDatabase } = require("../controllers/authorController");

router.get("/search-author", searchByAuthor); // <- Fix here
router.post("/save-profile", saveToDatabase);

module.exports = router;
