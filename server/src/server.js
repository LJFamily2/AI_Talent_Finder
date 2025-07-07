const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const routes = require("../routes");
const cvVerificationRoutes = require("../routes/cvVerification");
const authorRoutes = require("../routes/authorRoutes");

// Load env vars
dotenv.config({ path: path.join(__dirname, "../.env") });

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use("/api/author", authorRoutes);

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

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));