const express = require("express");
const router = express.Router();

// Import route files
const authRoutes = require("./auth");
const cvVerificationRoutes = require("./cvVerificationRoute");
const exportRoutes = require("./exportRoute");
const researcherRoutes = require("./researcherRoute");
const bookmarkRoutes = require("./bookmarkRoute");

// Mount routes
router.use("/api/cv", cvVerificationRoutes);
router.use("/api/auth", authRoutes);
router.use("/api/export", exportRoutes);
router.use("/api/researcher", researcherRoutes);
router.use("/api/bookmarks", bookmarkRoutes);

// Export router
module.exports = router;
