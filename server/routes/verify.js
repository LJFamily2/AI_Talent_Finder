const express = require("express");
const router = express.Router();
const { verifyPublication } = require("../controllers/verify");

// POST /api/verify-publication
router.post("/verify-publication", verifyPublication);

module.exports = router;
