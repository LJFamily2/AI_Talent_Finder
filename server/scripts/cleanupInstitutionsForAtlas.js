const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Load env from server/.env
dotenv.config({ path: path.join(__dirname, "../.env") });

// Register model
require("../models/Institution");
const Institution = mongoose.model("Institution");

async function ensureDisplayNameIndex() {
  const indexes = await Institution.collection.indexes();
  const hasDisplayNameIdx = indexes.some((ix) => ix.key && ix.key.display_name === 1);
  if (!hasDisplayNameIdx) {
    console.log("Creating index { display_name: 1 } (background) ...");
    await Institution.collection.createIndex({ display_name: 1 }, { background: true });
    console.log("Index created.");
  } else {
    console.log("Index { display_name: 1 } already exists.");
  }
}

async function dropLegacyIndexes() {
  const indexes = await Institution.collection.indexes();
  for (const ix of indexes) {
    const keys = ix.key || {};
    const name = ix.name;
    const hasFolded = Object.prototype.hasOwnProperty.call(keys, "display_name_folded");
    const hasTokens = Object.prototype.hasOwnProperty.call(keys, "display_name_tokens");
    if (hasFolded || hasTokens) {
      try {
        console.log(`Dropping legacy index ${name} ...`);
        await Institution.collection.dropIndex(name);
        console.log(`Dropped index ${name}`);
      } catch (e) {
        console.warn(`Could not drop index ${name}:`, e.message || e);
      }
    }
  }
}

async function unsetLegacyFields() {
  console.log("Unsetting legacy fields display_name_folded, display_name_tokens ...");
  const res = await Institution.collection.updateMany(
    {},
    { $unset: { display_name_folded: "", display_name_tokens: "" } }
  );
  console.log(`Modified ${res.modifiedCount || res.nModified || 0} documents.`);
}

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("Missing MONGODB_URI in environment.");
    process.exit(1);
  }
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("Connected to", uri);

    await ensureDisplayNameIndex();
    await dropLegacyIndexes();
    await unsetLegacyFields();

    console.log("Cleanup complete. You can now rely on Atlas Search + minimal fallback.");
  } catch (err) {
    console.error("Cleanup failed:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

run();

