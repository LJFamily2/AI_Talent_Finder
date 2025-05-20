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
    const result = await verifyCV(req.file);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: "Error processing CV",
      details: error.message,
    });
  }
});

module.exports = router;
