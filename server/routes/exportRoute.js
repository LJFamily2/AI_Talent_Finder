const express = require("express");
const router = express.Router();
const { exportResearchersToExcel } = require("../controllers/exportController");

// Export routes
router.post("/excel", exportResearchersToExcel);

module.exports = router;
