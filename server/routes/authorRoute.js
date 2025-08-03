//==================================================================
// Express Router: Author API
// Provides endpoints to search, fetch, save, delete author profiles
// Includes Redis caching middleware for efficient response reuse
//==================================================================

const express = require("express");
const router  = express.Router();

const {
  cache: cacheRedisInsight,
  flushAllCache
} = require("../middleware/cacheRedisInsight");

const {
  searchByCandidates,
  searchByFetch,
  saveToDatabase,
  deleteFromDatabase
} = require("../controllers/authorController");

//==================================================================
// 1. Search author in MongoDB
// - Uses Redis cache for name or ID-based lookup
//==================================================================
router.get(
  "/search-author",
  cacheRedisInsight(900, (req) => {
    const { id, name, page, limit } = req.query;
    if (id) return ["researcherProfiles", id];
    const nameKey = (name || "all").toLowerCase();
    return ["authorLists",  nameKey, `page=${req.query.page || 1}`, `limit=${req.query.limit || 25}`];
  }),
  searchByCandidates
);

//==================================================================
// 2. Fetch author profile from OpenAlex API
// - Also cached by ID or name-based listing
//==================================================================
router.get(
  "/fetch-author",
  cacheRedisInsight(900, (req) => {
    if (req.query.id) return ["researcherProfiles", req.query.id];
    const nameKey = (req.query.name || "unknown").toLowerCase();
    return ["openalexLists", nameKey, `page=${req.query.page || 1}`, `limit=${req.query.limit || 25}`];
  }),
  searchByFetch
);

//==================================================================
// 3. Save author profile to MongoDB
//==================================================================
router.post("/save-profile", saveToDatabase);

//==================================================================
// 4. Delete author profile from MongoDB and Redis
//==================================================================
router.delete("/delete-profile", deleteFromDatabase);

//==================================================================
// 5. Flush all Redis cache manually
// - Useful for admin reset operations
//==================================================================
router.post("/flush-redis", async (req, res) => {
  try {
    const redis = req.app?.locals?.redisClient;
    if (!redis) throw new Error("Redis client not found in app.locals");

    // Inject redis into internal cache module
    const { initRedisClient } = require("../middleware/cacheRedisInsight");
    initRedisClient(redis);

    await flushAllCache();
    res.json({ message: "Redis cache flushed successfully" });
  } catch (err) {
    console.error("❌ Redis flushAll error:", err);
    res.status(500).json({ error: "Failed to flush Redis" });
  }
});

//==================================================================
// Export the router module
//==================================================================
module.exports = router;
