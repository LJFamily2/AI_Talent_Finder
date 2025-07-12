const express = require("express");
const router = express.Router();
const { searchByAuthor, saveToDatabase } = require("../controllers/authorController");
const { searchByTopic } = require("../controllers/searchFiltersController");

router.get("/search-author", searchByAuthor); 
router.post("/save-profile", saveToDatabase);
router.get("/search-filters", searchByTopic);
module.exports = router;
