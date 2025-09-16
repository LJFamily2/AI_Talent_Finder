const express = require("express");
const router = express.Router();

// Import route files
const authRoutes = require("./auth");
const authorRoutes = require("./authorRoute");
const cvVerificationRoutes = require("./cvVerificationRoute");
const aiCvVerificationRoutes = require("./aiCvVerificationRoute");
const exportRoutes = require("./exportRoute");
const researcherRoutes = require("./researcherRoute");
const bookmarkRoutes = require("./bookmarkRoute");
const searchFiltersRoutes = require("./searchFiltersRoute");

// Mount routes
router.use("/api/cv", cvVerificationRoutes);
router.use("/api", aiCvVerificationRoutes);
router.use("/api/auth", authRoutes);
router.use("/api/search-filters", searchFiltersRoutes);

router.use("/api/export", exportRoutes);
router.use("/api/researcher", researcherRoutes);
router.use("/api/bookmarks", bookmarkRoutes);
router.use("/api/author", authorRoutes);

// Export router
module.exports = router;
