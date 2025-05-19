const express = require("express");
const router = express.Router();
const parseRoutes = require('./parse'); 

// Import route files
const authRoutes = require("./auth");
const verifyRoutes = require("./verify");

// Mount routes
router.use('/api/auth', authRoutes);
router.use('/parse-cv', parseRoutes);
router.use("/api", verifyRoutes);
router.use("/api/auth", authRoutes);


module.exports = router;
