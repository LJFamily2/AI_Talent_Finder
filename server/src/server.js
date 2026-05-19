// Express Server Entry Point
// Sets up API routes, connects MongoDB and Redis, and starts server
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const path = require("path");
const morgan = require("morgan");
const routes = require("../routes");
const { createClient } = require("redis");

// Load env vars
dotenv.config({ path: path.join(__dirname, "../.env") });

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

const allowedOrigins = [
  "https://www.talentfinder.solutions",
  "https://talentfinder.solutions",
  "http://localhost:5173",
  "http://localhost:3000",
];

if (process.env.CLIENT_URL) {
  const envOrigins = process.env.CLIENT_URL.split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  allowedOrigins.push(...envOrigins);
}

// Remove duplicates and trailing slashes
const uniqueOrigins = [...new Set(allowedOrigins.map(origin => origin.replace(/\/$/, "")))];

const corsOriginHelper = (origin, callback) => {
  if (!origin) return callback(null, true);
  const normalizedOrigin = origin.replace(/\/$/, "");
  if (uniqueOrigins.includes(normalizedOrigin)) {
    return callback(null, true);
  }
  try {
    const hostname = new URL(origin).hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".talentfinder.solutions") ||
      hostname === "talentfinder.solutions"
    ) {
      return callback(null, true);
    }
  } catch (err) {
    console.error("Error parsing origin URL in CORS dynamic matching:", err);
  }
  return callback(new Error("Not allowed by CORS"));
};

app.use(
  cors({
    origin: corsOriginHelper,
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // Allow cookies to be sent
    optionsSuccessStatus: 200,
  }),
);

// Mount routes
app.use(routes);

// Redis Client Setup
const redisClient = process.env.REDIS_URL
  ? createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 5000,
      },
    })
  : null;

if (redisClient) {
  redisClient.on("error", (err) => console.error("Redis Client Error", err));
}

(async () => {
  try {
    if (!redisClient) {
      console.warn("Redis is disabled because REDIS_URL is not set.");
      return;
    }

    await redisClient.connect();
    // Initialize Redis client for manual cache deletion
    const { initRedisClient } = require("../middleware/cacheRedisInsight");
    initRedisClient(redisClient);
  } catch (err) {
    console.warn(
      "Redis connection failed; continuing without cache:",
      err.message,
    );
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

// --- Socket.io Setup ---
const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOriginHelper,
    credentials: true,
  },
});

// Make io accessible in controllers
app.set("io", io);

io.on("connection", (socket) => {
  socket.on("joinJob", (jobId) => {
    socket.join(jobId);
  });
});

// Start the HTTP Server
const PORT = process.env.PORT || 8000;
server.listen(PORT, "0.0.0.0", () =>
  console.log(`Server running on port ${PORT}`),
);
