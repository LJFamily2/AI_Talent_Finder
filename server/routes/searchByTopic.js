const express = require("express");
const router = express.Router();
const { searchByTopic } = require("../controllers/searchByTopicController");

router.get("/", searchByTopic);

module.exports = router;