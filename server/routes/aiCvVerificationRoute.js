/**
 * AI CV Verification Routes
 *
 * This module defines the routing endpoints for AI-based CV verification functionality.
 * It provides a focused alternative to traditional API-based verification that uses AI
 * to verify publication existence online and match authors.
 *
 * @module aiCvVerificationRoute
 * @author AI Talent Finder Team
 * @version 2.0.0
 */

const express = require("express");
const multer = require("multer");
const path = require("path");
const {
  verifyCVWithAI,
} = require("../controllers/geminiAICvVerificationController");
const {
  verifyCVWithChatGPT,
} = require("../controllers/chatGPTAICvVerificationController");
const {
  verifyCVWithClaude,
} = require("../controllers/claudeAICvVerificationController");
const {
  verifyCVWithGrok,
} = require("../controllers/grokAICvVerificationController");

const router = express.Router();

//=============================================================================
// MULTER CONFIGURATION FOR FILE UPLOADS
//=============================================================================

// Configure multer for PDF file uploads
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

// Multer upload configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

//=============================================================================
// ROUTE DEFINITIONS
//=============================================================================

/**
 * POST /api/ai-verify-cv
 *
 * Main endpoint for AI-based CV verification
 *
 * @body {File} cv - PDF file of the CV to be verified
 * @body {string} [prioritySource] - Priority source for analysis (default: "ai")
 *
 * @returns {Object} Verification results in traditional format
 * @returns {boolean} success - Whether verification was successful
 * @returns {string} candidateName - Extracted candidate name
 * @returns {number} total - Total number of publications found
 * @returns {number} verifiedPublications - Number of verified publications
 * @returns {number} verifiedWithAuthorMatch - Number of verified publications with author match
 * @returns {number} verifiedButDifferentAuthor - Number of verified publications but different author
 * @returns {Array} results - Detailed verification of each publication
 * @returns {Object} authorDetails - Author profile and metrics (if verified publications exist)
 */
router.post("/gemini-ai-verify-cv", upload.single("cv"), async (req, res) => {
  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No CV file uploaded. Please upload a PDF file.",
      });
    }

    // Extract priority source from request body
    const prioritySource = req.body.prioritySource;

    // Log verification attempt
    console.log(
      `[AI CV Verification] Starting verification for file: ${req.file.filename}`
    );
    console.log(`[AI CV Verification] Priority source: ${prioritySource}`);

    // Perform AI-based CV verification
    const verificationResult = await verifyCVWithAI(req.file, prioritySource);

    // Log successful verification
    console.log(`[AI CV Verification] Completed successfully`);
    console.log(
      `[AI CV Verification] Candidate: ${verificationResult.candidateName}`
    );
    console.log(
      `[AI CV Verification] Publications analyzed: ${verificationResult.total}`
    );
    console.log(
      `[AI CV Verification] Verified publications: ${verificationResult.verifiedPublications}`
    );

    // Return verification results
    res.json(verificationResult);
  } catch (error) {
    console.error("[AI CV Verification] Error:", error);

    // Clean up uploaded file if it exists
    if (req.file && req.file.path) {
      try {
        const fs = require("fs");
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error("[AI CV Verification] File cleanup error:", cleanupError);
      }
    }

    // Return error response
    res.status(500).json({
      success: false,
      error: "CV verification failed. Please try again.",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * POST /api/chatgpt-ai-verify-cv
 *
 * Main endpoint for ChatGPT-based CV verification
 *
 * @body {File} cv - PDF file of the CV to be verified
 * @body {string} [prioritySource] - Priority source for analysis (default: "chatgpt")
 *
 * @returns {Object} Verification results in traditional format
 * @returns {boolean} success - Whether verification was successful
 * @returns {string} candidateName - Extracted candidate name
 * @returns {number} total - Total number of publications found
 * @returns {number} verifiedPublications - Number of verified publications
 * @returns {number} verifiedWithAuthorMatch - Number of verified publications with author match
 * @returns {number} verifiedButDifferentAuthor - Number of verified publications but different author
 * @returns {Array} results - Detailed verification of each publication
 * @returns {Object} authorDetails - Author profile and metrics (if verified publications exist)
 */
router.post("/chatgpt-ai-verify-cv", upload.single("cv"), async (req, res) => {
  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No CV file uploaded. Please upload a PDF file.",
      });
    }

    // Extract priority source from request body
    const prioritySource = req.body.prioritySource;

    // Log verification attempt
    console.log(
      `[ChatGPT CV Verification] Starting verification for file: ${req.file.filename}`
    );
    console.log(`[ChatGPT CV Verification] Priority source: ${prioritySource}`);

    // Perform ChatGPT-based CV verification
    const verificationResult = await verifyCVWithChatGPT(
      req.file,
      prioritySource
    );

    // Log successful verification
    console.log(`[ChatGPT CV Verification] Completed successfully`);
    console.log(
      `[ChatGPT CV Verification] Candidate: ${verificationResult.candidateName}`
    );
    console.log(
      `[ChatGPT CV Verification] Publications analyzed: ${verificationResult.total}`
    );
    console.log(
      `[ChatGPT CV Verification] Verified publications: ${verificationResult.verifiedPublications}`
    );

    // Return verification results
    res.json(verificationResult);
  } catch (error) {
    console.error("[ChatGPT CV Verification] Error:", error);

    // Clean up uploaded file if it exists
    if (req.file && req.file.path) {
      try {
        const fs = require("fs");
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error(
          "[ChatGPT CV Verification] File cleanup error:",
          cleanupError
        );
      }
    }

    // Return error response
    res.status(500).json({
      success: false,
      error: "CV verification failed. Please try again.",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * POST /api/claude-ai-verify-cv
 *
 * Main endpoint for Claude-based CV verification
 *
 * @body {File} cv - PDF file of the CV to be verified
 * @body {string} [prioritySource] - Priority source for analysis (default: "claude")
 *
 * @returns {Object} Verification results in traditional format
 * @returns {boolean} success - Whether verification was successful
 * @returns {string} candidateName - Extracted candidate name
 * @returns {number} total - Total number of publications found
 * @returns {number} verifiedPublications - Number of verified publications
 * @returns {number} verifiedWithAuthorMatch - Number of verified publications with author match
 * @returns {number} verifiedButDifferentAuthor - Number of verified publications but different author
 * @returns {Array} results - Detailed verification of each publication
 * @returns {Object} authorDetails - Author profile and metrics (if verified publications exist)
 */
router.post("/claude-ai-verify-cv", upload.single("cv"), async (req, res) => {
  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No CV file uploaded. Please upload a PDF file.",
      });
    }

    // Extract priority source from request body
    const prioritySource = req.body.prioritySource;

    // Log verification attempt
    console.log(
      `[Claude CV Verification] Starting verification for file: ${req.file.filename}`
    );
    console.log(`[Claude CV Verification] Priority source: ${prioritySource}`);

    // Perform Claude-based CV verification
    const verificationResult = await verifyCVWithClaude(
      req.file,
      prioritySource
    );

    // Log successful verification
    console.log(`[Claude CV Verification] Completed successfully`);
    console.log(
      `[Claude CV Verification] Candidate: ${verificationResult.candidateName}`
    );
    console.log(
      `[Claude CV Verification] Publications analyzed: ${verificationResult.total}`
    );
    console.log(
      `[Claude CV Verification] Verified publications: ${verificationResult.verifiedPublications}`
    );

    // Return verification results
    res.json(verificationResult);
  } catch (error) {
    console.error("[Claude CV Verification] Error:", error);

    // Clean up uploaded file if it exists
    if (req.file && req.file.path) {
      try {
        const fs = require("fs");
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error(
          "[Claude CV Verification] File cleanup error:",
          cleanupError
        );
      }
    }

    // Return error response
    res.status(500).json({
      success: false,
      error: "CV verification failed. Please try again.",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * POST /api/grok-ai-verify-cv
 *
 * Main endpoint for Grok AI-based CV verification
 *
 * @body {File} cv - PDF file of the CV to be verified
 * @body {string} [prioritySource] - Priority source for analysis (default: "grok")
 *
 * @returns {Object} Verification results in traditional format
 * @returns {boolean} success - Whether verification was successful
 * @returns {string} candidateName - Extracted candidate name
 * @returns {number} total - Total number of publications found
 * @returns {number} verifiedPublications - Number of verified publications
 * @returns {number} verifiedWithAuthorMatch - Number of verified publications with author match
 * @returns {number} verifiedButDifferentAuthor - Number of verified publications but different author
 * @returns {Array} results - Detailed verification of each publication
 * @returns {Object} authorDetails - Author profile and metrics (if verified publications exist)
 */
router.post("/grok-ai-verify-cv", upload.single("cv"), async (req, res) => {
  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No CV file uploaded. Please upload a PDF file.",
      });
    }

    // Extract priority source from request body
    const prioritySource = req.body.prioritySource;

    // Log verification attempt
    console.log(
      `[Grok CV Verification] Starting verification for file: ${req.file.filename}`
    );
    console.log(`[Grok CV Verification] Priority source: ${prioritySource}`);

    // Perform Grok AI-based CV verification
    const verificationResult = await verifyCVWithGrok(req.file, prioritySource);

    // Log successful verification
    console.log(`[Grok CV Verification] Completed successfully`);
    console.log(
      `[Grok CV Verification] Candidate: ${verificationResult.candidateName}`
    );
    console.log(
      `[Grok CV Verification] Publications analyzed: ${verificationResult.total}`
    );
    console.log(
      `[Grok CV Verification] Verified publications: ${verificationResult.verifiedPublications}`
    );

    // Return verification results
    res.json(verificationResult);
  } catch (error) {
    console.error("[Grok CV Verification] Error:", error);

    // Clean up uploaded file if it exists
    if (req.file && req.file.path) {
      try {
        const fs = require("fs");
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error(
          "[Grok CV Verification] File cleanup error:",
          cleanupError
        );
      }
    }

    // Return error response
    res.status(500).json({
      success: false,
      error: "CV verification failed. Please try again.",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

//=============================================================================
// ERROR HANDLING MIDDLEWARE
//=============================================================================

// Handle multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: "File too large. Maximum size is 10MB.",
      });
    }
    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        error: "Unexpected file field. Please use 'cv' as the field name.",
      });
    }
  }

  if (error.message === "Only PDF files are allowed!") {
    return res.status(400).json({
      success: false,
      error: "Invalid file type. Only PDF files are accepted.",
    });
  }

  // Pass other errors to default error handler
  next(error);
});

module.exports = router;
