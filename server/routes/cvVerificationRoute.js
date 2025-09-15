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

    // Return jobId immediately so frontend can join the room
    res.json({
      success: true,
      jobId: jobId,
      message: "CV upload successful, verification started",
    });

    // Start verification asynchronously
    (async () => {
      try {
        const result = await verifyCV(req.file, prioritySource, { jobId, io });
        // Send completion event via socket
        io.to(jobId).emit("complete", { result });
      } catch (error) {
        console.error("[CV Verification Route] Error:", error);
        io.to(jobId).emit("error", { error: error.message });
      }
    })();
  } catch (error) {
    res.status(500).json({
      error: "Error processing CV",
      details: error.message,
    });
  }
});

module.exports = router;
