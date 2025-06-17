const express = require("express");
const router = express.Router();
const { searchAndSavePublications } = require("../controllers/publicationController");

router.post("/search", searchAndSavePublications);

module.exports = router;
