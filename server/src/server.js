// Express Server Entry Point
// Sets up API routes, connects MongoDB and Redis, and starts server
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const path = require("path");
const routes = require("../routes");
const { createClient } = require("redis");

// Load env vars
dotenv.config({ path: path.join(__dirname, "../.env") });

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.VITE_API_URL || "http://localhost:3000",
    credentials: true, // Allow cookies to be sent
  })
);

// Mount routes
app.use(routes);

// Redis Client Setup
const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.on("error", (err) => console.error("Redis Client Error", err));

(async () => {
  try {
    await redisClient.connect();
    // Initialize Redis client for manual cache deletion
    const { initRedisClient } = require("../middleware/cacheRedisInsight");
    initRedisClient(redisClient);
  } catch (err) {
    console.error("Redis connection failed:", err);
  }
})();

// Make Redis client accessible in request lifecycle
app.locals.redisClient = redisClient;

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => console.log("MongoDB Connected"));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Server Error" });
});

// Start the HTTP Server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
