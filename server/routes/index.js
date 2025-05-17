const express = require("express");
const router = express.Router();

// Import route files
const authRoutes = require("./auth");
const verifyRoutes = require("./verify");

// Mount routes
router.use("/api", verifyRoutes);
router.use("/api/auth", authRoutes);

module.exports = router;
