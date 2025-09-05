const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
const Institution = require("../models/Institution")
dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGO_URI = process.env.MONGODB_URI;
const BATCH_SIZE = 1000;

function foldString(s = "") {
  try {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  } catch (e) {
    return (s || "").toLowerCase();
  }
}

async function migrate() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log("Connected to", MONGO_URI);

  const cursor = Institution.find().select("_id display_name").lean().cursor();
  let ops = [];
  let processed = 0;

  try {
    for await (const doc of cursor) {
      const folded = foldString(doc.display_name || "");
      ops.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { display_name_folded: folded } }
        }
      });

      if (ops.length >= BATCH_SIZE) {
        await Institution.bulkWrite(ops, { ordered: false });
        processed += ops.length;
        console.log(`Processed ${processed}`);
        ops = [];
      }
    }

    if (ops.length) {
      await Institution.bulkWrite(ops, { ordered: false });
      processed += ops.length;
      console.log(`Processed ${processed}`);
      ops = [];
    }

    console.log("Creating index on display_name_folded (if not exists) ...");
    // create index in background to reduce impact (Mongo versions differ)
    await Institution.collection.createIndex({ display_name_folded: 1 }, { background: true });
    console.log("Index created.");

  } catch (err) {
    console.error("Migration error:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected. Migration complete.");
  }
}

migrate().catch(err => {
  console.error("Unhandled migration error:", err);
  process.exit(1);
});