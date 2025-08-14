// routes/authorRoute.js
//==================================================================
// Express Router: Author API (CRUD only)
//==================================================================
const express = require("express");
const router  = express.Router();

const {
  cache: cacheRedisInsight,
  flushAllCache,
  initRedisClient, // cần nếu bạn dùng inject client trong flush-redis
} = require("../middleware/cacheRedisInsight");

const {
  saveToDatabase,
  deleteFromDatabase,
} = require("../controllers/authorController");


// 1) Save author profile to MongoDB
router.post("/save-profile", saveToDatabase);

// 2) Delete author profile from MongoDB and Redis
router.delete("/delete-profile", deleteFromDatabase);

// 3) Flush all Redis cache manually
router.post("/flush-redis", async (req, res) => {
  try {
    const redis = req.app?.locals?.redisClient;
    if (!redis) throw new Error("Redis client not found in app.locals");
    initRedisClient(redis);
    await flushAllCache();
    res.json({ message: "Redis cache flushed successfully" });
  } catch (err) {
    console.error("❌ Redis flushAll error:", err);
    res.status(500).json({ error: "Failed to flush Redis" });
  }
});

module.exports = router;
