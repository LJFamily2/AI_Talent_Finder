const express = require("express");
const router = express.Router();
const { getResearcherProfile } = require("../controllers/researcherController");

// Researcher routes
router.get("/:id", getResearcherProfile);

module.exports = router;
