/**
 * Contact Finder Routes
 *
 * Routes for finding researcher contact information using GPT
 */

const express = require("express");
const router = express.Router();
const {
  findResearcherContact,
} = require("../controllers/gptContactFinderController");

/**
 * POST /api/contact/find
 * Find contact information for a researcher
 */
router.post("/find", findResearcherContact);

module.exports = router;
