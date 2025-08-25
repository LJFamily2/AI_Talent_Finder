//==================================================================
// Redis Caching Middleware for CLI and Server
// Provides unified GET/SET cache logic for Express responses, along
// with manual cache deletion and global cache flush utilities
//==================================================================

let redisClient; // Redis client instance (set externally in app or server)

//==================================================================
// Initialize the Redis client (called from server.js or app.js)
//==================================================================
function initRedisClient(client) {
  redisClient = client;
}

//==================================================================
// Format TTL (time-to-live) seconds into human-readable strings
// Example: 3600 → '1 hour', 7200 → '2 hours', 75 → '75 seconds'
//==================================================================
function fmtTTL(sec) {
  if (sec % 3600 === 0) {
    const h = sec / 3600;
    return h > 1 ? `${h} hours` : `${h} hour`;
  }
  return `${sec} seconds`;
}

//==================================================================
// Express Middleware: Redis Cache Wrapper for GET APIs
// - Automatically checks for cached response before hitting DB/API
// - If not found, caches successful response body with TTL
// - Key is generated dynamically via keyBuilder(req)
//==================================================================
function cacheRedisInsight(ttlSeconds, keyBuilder) {
  const humanTTL = fmtTTL(ttlSeconds);

  return async (req, res, next) => {
    const redis = req.app?.locals?.redisClient || redisClient;
    if (!redis) return next();

    const segments = keyBuilder(req);
    const key = segments.join(":");

    // Try to fetch from Redis cache first
    try {
      const cached = await redis.get(key);
      if (cached != null) {
        console.log(`🔵 [CACHE HIT] ${key}`);
        return res.status(200).json(JSON.parse(cached));
      } else {
        console.log(`🟠 [CACHE MISS] ${key}`);
      }
    } catch (err) {
      console.error(`❌ Redis GET error for ${key}:`, err);
    }

    // Wrap the response method to intercept .json and cache result
    const originalJson = res.json.bind(res);
    res.json = async (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          await redis.setEx(key, ttlSeconds, JSON.stringify(body));
          console.log(`🟢 [CACHE SET] ${key} (ttl=${humanTTL})`);
        } catch (err) {
          console.error(`❌ Redis SET error for ${key}:`, err);
        }
      }
      return originalJson(body);
    };

    next();
  };
}

//==================================================================
// Exports
//==================================================================
module.exports = {
  cache: cacheRedisInsight,
  initRedisClient
};
