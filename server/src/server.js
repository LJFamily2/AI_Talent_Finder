const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const { createClient } = require('redis');
const routes = require("../routes");
const cvVerificationRoutes = require("../routes/cvVerificationRoute");
const authorRoutes = require("../routes/authorRoutes");
const searchByTopicRoute = require("../routes/searchByTopic");


// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use("/api/author", authorRoutes);
app.use("/api/cv", cvVerificationRoutes);
app.use("/api/search-by-topic", searchByTopicRoute);
app.use(routes);

// Redis client setup
const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.connect()
  .then(() => console.log('Redis Connected'))
  .catch((err) => console.error('Redis Connection Error:', err));
// Make Redis client accessible to controllers via app.locals
app.locals.redisClient = redisClient;

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Server Error" });
});

// Start server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));