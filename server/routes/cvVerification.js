const express = require("express");
const multer = require("multer");
const { verifyCV } = require("../controllers/cvVerification");
const router = express.Router();

// Multer storage config
const upload = multer({ dest: "uploads/" });

// CV verification endpoint
router.post("/verify-cv", upload.single("cv"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    // Get priority source from request body, default to 'googleScholar'
    const prioritySource = req.body.prioritySource || "googleScholar";

    // Validate priority source
    const validSources = ["googleScholar", "scopus", "openalex"];
    if (!validSources.includes(prioritySource)) {
      return res.status(400).json({
        error: "Invalid priority source",
        message:
          "Priority source must be one of: googleScholar, scopus, openalex",
        providedValue: prioritySource,
      });
    }

    const result = await verifyCV(req.file, prioritySource);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: "Error processing CV",
      details: error.message,
    });
  }
});

module.exports = router;
