const express = require("express");
const router = express.Router();
const {
  getResearcherProfile,
  getResearcherWorks,
} = require("../controllers/researcherController");

// Researcher routes
router.get("/:slug", getResearcherProfile);
router.get("/:slug/works", getResearcherWorks);

module.exports = router;
