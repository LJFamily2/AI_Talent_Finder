const express = require("express");
const router = express.Router();
const {
  getResearcherProfile,
  getResearcherWorks,
} = require("../controllers/researcherController");

// Researcher routes
router.get("/:id", getResearcherProfile);
router.get("/:id/works", getResearcherWorks);

module.exports = router;
