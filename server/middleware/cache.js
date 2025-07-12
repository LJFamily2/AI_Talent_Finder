// server/middlewares/cache.js

/**
 * Read-through cache middleware for Redis, with hit/miss logging.
 *
 * @param {number} ttlSeconds   How long to keep a result in Redis
 * @param {Function} keyBuilder (req) => string  Builds a unique key per request
 */
module.exports = function cache(ttlSeconds, keyBuilder) {
  return async (req, res, next) => {
    const redis = req.app.locals.redisClient;
    const key   = keyBuilder(req);

    // 1) Try reading from cache
    try {
      const cached = await redis.get(key);
      if (cached) {
        console.log(`CACHE HIT: ${key}`);
        return res.status(200).json(JSON.parse(cached));
      } else {
        console.log(`CACHE MISS: ${key}`);
      }
    } catch (err) {
      console.error(`REDIS READ ERROR for key ${key}:`, err);
      // fall through to DB
    }

    // 2) On miss, wrap res.json to write to cache
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      try {
        redis.setEx(key, ttlSeconds, JSON.stringify(body));
        console.log(`CACHE SET: ${key} (ttl=${ttlSeconds}s)`);
      } catch (err) {
        console.error(`REDIS WRITE ERROR for key ${key}:`, err);
      }
      return originalJson(body);
    };

    next();
  };
};
