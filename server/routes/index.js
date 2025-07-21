const express = require("express");
const router = express.Router();

// Import route files
const authRoutes = require("./auth");
const cvVerificationRoutes = require("./cvVerificationRoute");
const exportRoutes = require("./exportRoute");

// Mount routes
router.use("/api/cv", cvVerificationRoutes);
router.use("/api/auth", authRoutes);
router.use("/api/export", exportRoutes);

// Export router
module.exports = router;
