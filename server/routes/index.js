const express = require("express");
const router = express.Router();
const parseRoutes = require('./parse'); 

// Import route files
const authRoutes = require("./auth");
<<<<<<< Updated upstream
const verifyRoutes = require("./verify");
=======
const cvVerificationRoutes = require("./cvVerification");
const publicationRoutes = require("./publication");


>>>>>>> Stashed changes

// Mount routes
router.use('/api/auth', authRoutes);
router.use('/parse-cv', parseRoutes);
router.use("/api", verifyRoutes);
router.use("/api/auth", authRoutes);
router.use("/api/publication", publicationRoutes);


module.exports = router;
