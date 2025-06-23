const express = require("express");
const router = express.Router();
const { searchByAuthor } = require("../controllers/authorController");

router.post("/search-author", searchByAuthor);

module.exports = router;
