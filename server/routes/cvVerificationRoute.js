const express = require("express");
const multer = require("multer");
const path = require("path");
const { verifyCV } = require("../controllers/cvVerificationController");
const { v4: uuidv4 } = require("uuid");
const router = express.Router();

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../uploads/"));
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "cv-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter to accept only PDF files
const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed!"), false);
  }
};

// Multer upload configuration with file validation
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// CV verification endpoint
router.post("/verify-cv", (req, res) => {
  upload.single("cv")(req, res, async (err) => {
    // Handle multer errors (including file type validation)
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          error: "File too large",
          message: "File size must be less than 10MB",
        });
      }
      return res.status(400).json({
        error: "File upload error",
        message: err.message,
      });
    } else if (err) {
      // Handle custom file filter errors
      return res.status(400).json({
        error: "Invalid file type",
        message: "Only PDF files are allowed",
      });
    }

    // Check if file was uploaded
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
          const result = await verifyCV(req.file, prioritySource, {
            jobId,
            io,
          });

          // Detect structured AI failure response
          if (
            result &&
            result.success === false &&
            (result.code === "AI_PUBLICATION_EXTRACTION_FAILED" ||
              result.code === "AI_NAME_EXTRACTION_FAILED")
          ) {
            io.to(jobId).emit("error", {
              error: result.error,
              code: result.code,
              retryable: true,
              stage: result.stage,
            });
            return; // Do not emit complete
          }

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
});

module.exports = router;
