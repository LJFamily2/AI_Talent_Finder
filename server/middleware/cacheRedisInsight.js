/**
 * Redis cache middleware + utility functions for CLI and server routes.
 */

let redisClient; // Will be initialized in app.js or server.js

function initRedisClient(client) {
  redisClient = client;
}

// ─── TTL Formatter ────────────────────────────────────────────────
function fmtTTL(sec) {
  if (sec % 3600 === 0) {
    const h = sec / 3600;
    return h > 1 ? `${h} hours` : `${h} hour`;
  }
  return `${sec} seconds`;
}

// ─── Main Middleware ──────────────────────────────────────────────
function cacheRedisInsight(ttlSeconds, keyBuilder) {
  const humanTTL = fmtTTL(ttlSeconds);

  return async (req, res, next) => {
    const redis = req.app?.locals?.redisClient || redisClient;
    if (!redis) return next();

    const segments = keyBuilder(req);
    const key = segments.join(":");

    // 1) Try to serve from cache
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

    // 2) Wrap response to set cache on success
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

// ─── Delete a Specific Cache Key ──────────────────────────────────
async function deleteCacheKey(key) {
  try {
    if (!redisClient) throw new Error("Redis client not initialized");
    const result = await redisClient.del(key);
    if (result > 0) {
      console.log(`🔴 [CACHE DEL] ${key}`);
    }
  } catch (err) {
    console.error(`❌ Redis DEL error for ${key}:`, err);
  }
}

// ─── Flush All Cache ──────────────────────────────────────────────
async function flushAllCache() {
  try {
    if (!redisClient) throw new Error("Redis client not initialized");
    await redisClient.flushAll();
    console.log(`🔄 [CACHE RESET] Redis FLUSHALL completed`);
  } catch (err) {
    console.error("❌ Redis flushAll error:", err);
  }
}

module.exports = {
  cache: cacheRedisInsight,
  flushAllCache,
  deleteCacheKey,
  initRedisClient
};