const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

require("../models/Topic");
const Topic = mongoose.model("Topic");

async function ensureTopicDisplayNameIndex() {
  const indexes = await Topic.collection.indexes();
  const hasIdx = indexes.some(ix => ix.key && ix.key.display_name === 1);
  if (!hasIdx) {
    console.log("Creating index { display_name: 1 } on topics (background)...");
    await Topic.collection.createIndex({ display_name: 1 }, { background: true });
    console.log("Index created.");
  } else {
    console.log("Index { display_name: 1 } already exists on topics.");
  }
}

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("Missing MONGODB_URI env var.");
    process.exit(1);
  }
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("Connected to", uri);
    await ensureTopicDisplayNameIndex();
  } catch (e) {
    console.error("Failed:", e);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

run();

