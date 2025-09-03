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
    const validSources = ["googleScholar", "scopus", "openalex"];
    if (!validSources.includes(prioritySource)) {
      return res.status(400).json({
        error: "Invalid priority source",
        message:
          "Priority source must be one of: googleScholar, scopus, openalex",
        providedValue: prioritySource,
      });
    }

    // Generate a jobId and return it immediately
    const jobId = uuidv4();
    res.json({ jobId });

    // Start verification in the background, passing jobId and io
    const io = req.app.get("io");
    verifyCV(req.file, prioritySource, { jobId, io })
      .then((result) => {
        io.to(jobId).emit("complete", { result });
      })
      .catch((error) => {
        io.to(jobId).emit("error", { error: error.message });
      });
  } catch (error) {
    res.status(500).json({
      error: "Error processing CV",
      details: error.message,
    });
  }
});

module.exports = router;
