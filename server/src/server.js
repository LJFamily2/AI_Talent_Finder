// server.js

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const { createClient } = require("redis");

// Route modules
const routes = require("../routes");
const cvVerificationRoutes = require("../routes/cvVerificationRoute");
const authorRoutes = require("../routes/authorRoutes");
const searchFilters = require("../routes/searchFilters");
// const searchFiltersController = require("../controllers/searchFiltersController");


// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Mount application routes
app.use("/api/author", authorRoutes);
app.use("/api/cv", cvVerificationRoutes);
app.use("/api/search-filters", searchFilters);
app.use(routes);

// Redis client setup
const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.on("error", err => console.error("Redis Client Error", err));
redisClient
  .connect()
  .then(() => console.log("Redis Connected"))
  .catch(err => console.error("Redis Connection Error:", err));

// Expose Redis client to controllers
app.locals.redisClient = redisClient;

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/your_db_name", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// Global error-handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Server Error" });
});

// Start server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
