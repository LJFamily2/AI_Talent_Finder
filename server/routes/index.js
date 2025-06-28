const express = require("express");
const router = express.Router();

// Import route files
const authRoutes = require("./auth");
const cvVerificationRoutes = require("./cvVerification");
const authorRoutes = require("./authorRoutes");

// Mount routes
router.use("/api/cv", cvVerificationRoutes);
router.use("/api/auth", authRoutes);
router.use("/api/author", authorRoutes);

// Export router
module.exports = router;
