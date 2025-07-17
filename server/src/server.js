const express        = require("express");
const mongoose       = require("mongoose");
const cors           = require("cors");
const dotenv         = require("dotenv");
const path           = require("path");
const { createClient } = require("redis");

// Route modules
const routes                = require("../routes");
const cvVerificationRoutes = require("../routes/cvVerificationRoute");
const authorRoutes          = require("../routes/authorRoutes");
const searchFiltersRoutes   = require("../routes/searchFilters");

// Load environment variables
dotenv.config({ path: path.join(__dirname, ".env") });

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Mount routes
app.use("/api/author", authorRoutes);
app.use("/api/cv", cvVerificationRoutes);
app.use("/api/search-filters", searchFiltersRoutes);
app.use(routes); // fallback/default routes if any

// Redis client setup
const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.on("error", err => console.error("❌ Redis Client Error", err));

redisClient
  .connect()
  .then(() => console.log("✅ Redis connected"))
  .catch(err => console.error("❌ Redis connection failed:", err));

app.locals.redisClient = redisClient; // make redis available in controllers

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/academic_profiles", {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Unhandled Error:", err.stack);
  res.status(500).json({ success: false, message: "Internal Server Error" });
});

// Start server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
