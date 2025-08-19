// server/routes/aiDetectionRoute.js

const express = require("express");
const multer = require("multer");
const { extractTextFromPDF, detectJobPositionUsingGemini } = require("../utils/pdfUtils");
const fs = require("fs");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// POST /api/ai/detect-position
router.post("/detect-position", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;
    const text = await extractTextFromPDF(filePath);
    const position = await detectJobPositionUsingGemini(text);

    // Optionally delete uploaded file after processing
    fs.unlink(filePath, (err) => {
      if (err) console.warn("Failed to delete uploaded file:", err);
    });

    res.json({ success: true, position });
  } catch (err) {
    console.error("Job detection failed:", err);
    res.status(500).json({ success: false, message: "Failed to detect job position" });
  }
});

module.exports = router;
