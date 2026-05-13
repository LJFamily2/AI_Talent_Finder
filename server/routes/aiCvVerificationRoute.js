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
const { uploadToSupabase, deleteFromSupabase } = require("../utils/supabaseStorage");

const router = express.Router();

//=============================================================================
// MULTER CONFIGURATION FOR FILE UPLOADS
//=============================================================================

// Configure multer for PDF file uploads - using memory storage for Supabase
const storage = multer.memoryStorage();

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

// Helper function to generate a unique stored filename
const generateStoredFileName = (originalname) => {
  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  return "cv-" + uniqueSuffix + path.extname(originalname);
};

//=============================================================================
// ROUTE DEFINITIONS
//=============================================================================

/**
 * POST /api/ai-verify-cv
 *
 * Main endpoint for AI-based CV verification
 */
router.post("/gemini-ai-verify-cv", upload.single("cv"), async (req, res) => {
  let storedFileName = null;
  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No CV file uploaded. Please upload a PDF file.",
      });
    }

    // Upload to Supabase
    storedFileName = generateStoredFileName(req.file.originalname);
    const { error: uploadError } = await uploadToSupabase(
      req.file.buffer,
      storedFileName,
      req.file.mimetype
    );

    if (uploadError) {
      console.error("[Gemini AI] Supabase Upload Error:", uploadError);
      return res.status(500).json({
        success: false,
        error: "Upload failed",
        message: "Failed to upload file to cloud storage",
      });
    }

    // Attach storedFileName to req.file for the controller
    req.file.storedFileName = storedFileName;

    // Extract priority source from request body
    const prioritySource = req.body.prioritySource;

    // Log verification attempt
    console.log(
      `[AI CV Verification] Starting verification for file: ${storedFileName}`
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

    // Clean up uploaded file from Supabase if it exists
    if (storedFileName) {
      try {
        await deleteFromSupabase(storedFileName);
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
 */
router.post("/chatgpt-ai-verify-cv", upload.single("cv"), async (req, res) => {
  let storedFileName = null;
  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No CV file uploaded. Please upload a PDF file.",
      });
    }

    // Upload to Supabase
    storedFileName = generateStoredFileName(req.file.originalname);
    const { error: uploadError } = await uploadToSupabase(
      req.file.buffer,
      storedFileName,
      req.file.mimetype
    );

    if (uploadError) {
      console.error("[ChatGPT AI] Supabase Upload Error:", uploadError);
      return res.status(500).json({
        success: false,
        error: "Upload failed",
        message: "Failed to upload file to cloud storage",
      });
    }

    // Attach storedFileName to req.file for the controller
    req.file.storedFileName = storedFileName;

    // Extract priority source from request body
    const prioritySource = req.body.prioritySource;

    // Log verification attempt
    console.log(
      `[ChatGPT CV Verification] Starting verification for file: ${storedFileName}`
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

    // Clean up uploaded file from Supabase if it exists
    if (storedFileName) {
      try {
        await deleteFromSupabase(storedFileName);
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
 */
router.post("/claude-ai-verify-cv", upload.single("cv"), async (req, res) => {
  let storedFileName = null;
  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No CV file uploaded. Please upload a PDF file.",
      });
    }

    // Upload to Supabase
    storedFileName = generateStoredFileName(req.file.originalname);
    const { error: uploadError } = await uploadToSupabase(
      req.file.buffer,
      storedFileName,
      req.file.mimetype
    );

    if (uploadError) {
      console.error("[Claude AI] Supabase Upload Error:", uploadError);
      return res.status(500).json({
        success: false,
        error: "Upload failed",
        message: "Failed to upload file to cloud storage",
      });
    }

    // Attach storedFileName to req.file for the controller
    req.file.storedFileName = storedFileName;

    // Extract priority source from request body
    const prioritySource = req.body.prioritySource;

    // Log verification attempt
    console.log(
      `[Claude CV Verification] Starting verification for file: ${storedFileName}`
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

    // Clean up uploaded file from Supabase if it exists
    if (storedFileName) {
      try {
        await deleteFromSupabase(storedFileName);
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
 */
router.post("/grok-ai-verify-cv", upload.single("cv"), async (req, res) => {
  let storedFileName = null;
  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No CV file uploaded. Please upload a PDF file.",
      });
    }

    // Upload to Supabase
    storedFileName = generateStoredFileName(req.file.originalname);
    const { error: uploadError } = await uploadToSupabase(
      req.file.buffer,
      storedFileName,
      req.file.mimetype
    );

    if (uploadError) {
      console.error("[Grok AI] Supabase Upload Error:", uploadError);
      return res.status(500).json({
        success: false,
        error: "Upload failed",
        message: "Failed to upload file to cloud storage",
      });
    }

    // Attach storedFileName to req.file for the controller
    req.file.storedFileName = storedFileName;

    // Extract priority source from request body
    const prioritySource = req.body.prioritySource;

    // Log verification attempt
    console.log(
      `[Grok CV Verification] Starting verification for file: ${storedFileName}`
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

    // Clean up uploaded file from Supabase if it exists
    if (storedFileName) {
      try {
        await deleteFromSupabase(storedFileName);
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
