const express = require("express");
const multer = require("multer");
const { verifyCV } = require("../controllers/cvVerificationController");
const { v4: uuidv4 } = require("uuid");
const router = express.Router();

// Multer storage config
const upload = multer({ dest: "uploads/" });

// CV verification endpoint
router.post("/verify-cv", upload.single("cv"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    // Get priority source from request body, default to 'scopus'
    const prioritySource = req.body.prioritySource || "scopus";
    // Validate priority source
    const validSources = [
      "googleScholar",
      "scopus",
      "openalex",
      "pubmed",
      "crossref",
    ];
    if (!validSources.includes(prioritySource)) {
      return res.status(400).json({
        error: "Invalid priority source",
        message:
          "Priority source must be one of: googleScholar, scopus, openalex, pubmed, crossref",
        providedValue: prioritySource,
      });
    }

    // Generate a jobId for socket communication
    const jobId = uuidv4();
    const io = req.app.get("io");

    // Start verification and wait for the result
    try {
      const result = await verifyCV(req.file, prioritySource, { jobId, io });
      // Send both socket event and HTTP response
      io.to(jobId).emit("complete", { result });
      res.json({
        success: true,
        data: result,
        message: "CV verification completed successfully",
      }); // Remove when done testing
    } catch (error) {
      io.to(jobId).emit("error", { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message,
        message: "CV verification failed",
      }); // Remove when done testing
    }
  } catch (error) {
    res.status(500).json({
      error: "Error processing CV",
      details: error.message,
    });
  }
});

module.exports = router;
