const express = require("express");
const router = express.Router();

// Import route files
const authRoutes = require("./auth");
const cvVerificationRoutes = require("./cvVerificationRoute");

// Mount routes
router.use("/api/cv", cvVerificationRoutes);
router.use("/api/auth", authRoutes);

// Export router
module.exports = router;
