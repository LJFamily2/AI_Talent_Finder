const express = require('express');
const router = express.Router();
const parseRoutes = require('./parse'); 

// Import route files
const authRoutes = require('./auth');

// Mount routes
router.use('/api/auth', authRoutes);
router.use('/parse-cv', parseRoutes);

module.exports = router;
