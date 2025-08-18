//==================================================================
// Express Server Entry Point
// Sets up API routes, connects MongoDB and Redis, and starts server
//==================================================================
const express  = require("express");
const mongoose = require("mongoose");
const cors     = require("cors");
const dotenv   = require("dotenv");
const path     = require("path");
const { createClient } = require("redis");

//==================================================================
// Load environment variables from .env
//==================================================================
dotenv.config({ path: path.join(__dirname, ".env") });

//==================================================================
// Initialize Express app
//==================================================================
const app = express();

//==================================================================
// Global Middleware
//==================================================================
app.use(express.json());
app.use(cors());

//==================================================================
// Route Modules (import once)
//==================================================================
const rootRoutes           = require("../routes"); // default/fallback routes if any
const authorRoutes         = require("../routes/authorRoute");
const searchFiltersRoutes  = require("../routes/searchFiltersRoute");

//==================================================================
// Mount Route Handlers
//==================================================================
app.use("/api/author", authorRoutes);
app.use("/api/search-filters", searchFiltersRoutes);
app.use(rootRoutes); // keep last as fallback

//==================================================================
// Redis Client Setup
//==================================================================
const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.on("error", (err) => console.error("❌ Redis Client Error", err));

(async () => {
  try {
    await redisClient.connect();
    console.log("✅ Redis connected");

    // Initialize Redis client for cache helpers
    const { initRedisClient } = require("../middleware/cacheRedisInsight");
    initRedisClient(redisClient);
  } catch (err) {
    console.error("❌ Redis connection failed:", err);
  }
})();

// Make Redis client accessible in request lifecycle
app.locals.redisClient = redisClient;

//==================================================================
// MongoDB Connection
//==================================================================
mongoose
  .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log("✅ MongoDB Connected");

    // In ra thông tin DB đã connect
    const conn = mongoose.connection;
    console.log(`📌 Connected to: ${conn.host}:${conn.port}/${conn.name}`);
    // hoặc in ra nguyên URI (ẩn mật khẩu cho an toàn)
    console.log(`🔗 MONGODB_URI = ${process.env.MONGODB_URI}`);
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));


//==================================================================
// Global Error Handler Middleware
//==================================================================
app.use((err, req, res, next) => {
  console.error("❌ Unhandled Error:", err.stack);
  res.status(500).json({ success: false, message: "Internal Server Error" });
});

//==================================================================
// Start the HTTP Server
//==================================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));