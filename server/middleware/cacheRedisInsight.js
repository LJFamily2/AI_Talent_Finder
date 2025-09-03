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

// Helper to stable-stringify objects for keys
function stableStringify(obj) {
  if (obj === null) return "null";
  if (typeof obj !== "object") return String(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(",")}]`;
  const keys = Object.keys(obj).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
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

    // allow keyBuilder to return string | array | object | Promise<...>
    let segments = await Promise.resolve().then(() => keyBuilder(req));
    let key;
    if (Array.isArray(segments)) {
      key = segments.join(":");
    } else if (typeof segments === "string") {
      key = segments;
    } else {
      // object or other -> stable stringify
      key = stableStringify(segments);
    }

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
// Manually delete a Redis cache key (for CLI deletion workflows)
// Logs cache deletion status for clarity
//==================================================================
async function deleteCacheKey(key) {
  try {
    if (!redisClient) throw new Error("Redis client not initialized");
    const result = await redisClient.del(key);
    if (result > 0) {
      console.log(`🔴 [CACHE DEL] ${key}`);
    } else {
      console.log(`⚪ [CACHE NOT FOUND] ${key}`);
    }
  } catch (err) {
    console.error(`❌ Redis DEL error for ${key}:`, err);
  }
}


//==================================================================
// Flush all Redis keys (dangerous operation, use only in dev/test)
//==================================================================
async function flushAllCache() {
  try {
    if (!redisClient) throw new Error("Redis client not initialized");
    await redisClient.flushAll();
    console.log(`🔄 [CACHE RESET] Redis FLUSHALL completed`);
  } catch (err) {
    console.error("❌ Redis flushAll error:", err);
  }
}

//==================================================================
// Exports
//==================================================================
module.exports = {
  cache: cacheRedisInsight,
  flushAllCache,
  deleteCacheKey,
  initRedisClient
};
