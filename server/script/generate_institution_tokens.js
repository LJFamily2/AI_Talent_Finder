const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "../.env") });

// require model so mongoose.model('Institution') is registered
require(path.join(__dirname, "../models/Institution"));
const Institution = mongoose.model("Institution");

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/your_db_name";
const BATCH_SIZE = 1000;

function foldString(s = "") {
    try {
        return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    } catch (e) {
        return (s || "").toLowerCase();
    }
}

function tokenizeFolded(s = "") {
    // split on whitespace and non-word chars, remove empties and dedupe
    const toks = String(s)
        .split(/[\s\W_]+/u)
        .map(t => t.trim())
        .filter(Boolean);
    return Array.from(new Set(toks));
}

async function migrate() {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("Connected to", MONGO_URI);

    const cursor = Institution.find().select("_id display_name display_name_folded").lean().cursor();
    let ops = [];
    let processed = 0;

    try {
        for await (const doc of cursor) {
            const base = (doc && (doc.display_name_folded || doc.display_name)) || "";
            const folded = foldString(base);
            const tokens = tokenizeFolded(folded);

            ops.push({
                updateOne: {
                    filter: { _id: doc._id },
                    update: {
                        $set: {
                            display_name_folded: folded,
                            display_name_tokens: tokens
                        }
                    }
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
            console.log(`Final processed ${processed}`);
            ops = [];
        }

        console.log("Creating index on display_name_tokens (if not exists) ...");
        await Institution.collection.createIndex({ display_name_tokens: 1 });
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