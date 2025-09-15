const Country = require("../models/Country");
const Institution = require("../models/Institution");
const Field = require("../models/Field");
const Topic = require("../models/Topic");
const { foldString, toSafeRegex } = require("../utils/queryHelpers");

// Get all countries to build filter
async function getCountriesFilter(req, res) {
    try {
        // fetch all countries, sorted by name
        const allCountries = await Country.find().sort({ name: 1 });
        return res.status(200).json({ allCountries });
    } catch (error) {
        console.error("getCountriesFilter error:", error);
        return res.status(500).json({ error: "Failed to fetch countries" });
    }
}

async function getInstitutionsFilter(req, res) {
    try {
        const q = (req.query.q || "").trim();
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
        const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

        if (q) {
            const qfold = foldString(q);
            const terms = qfold.split(/\s+/).filter(Boolean);

            // 1) Primary: full-name prefix matches (high priority)
            const primaryLimit = Math.min(limit, 10); // tuneable
            const primaryRegex = toSafeRegex(qfold, { anchor: true, flags: "" });
            let primaryDocs = await Institution.find({ display_name_folded: { $regex: primaryRegex } })
                .limit(primaryLimit)
                .select("_id display_name display_name_folded")
                .lean();

            // sort primary results by: earliest match (indexOf), then shorter name
            primaryDocs.sort((a, b) => {
                const ai = a.display_name_folded.indexOf(qfold);
                const bi = b.display_name_folded.indexOf(qfold);
                if (ai !== bi) return ai - bi;
                return a.display_name.length - b.display_name.length;
            });

            const primaryIds = primaryDocs.map(d => d._id);

            // 2) Secondary: token-AND matches to fill the rest (excludes primary results)
            let results = primaryDocs;
            if (results.length < limit) {
                const tokenConditions = terms.map(t => ({ display_name_tokens: { $regex: toSafeRegex(t, { anchor: true, flags: "" }) } }));
                const remaining = limit - results.length;
                const tokenDocs = await Institution.find({ $and: tokenConditions, _id: { $nin: primaryIds } })
                    .sort({ display_name_folded: 1 })
                    .limit(remaining)
                    .select("_id display_name")
                    .lean();
                results = results.concat(tokenDocs);
            }

            // strip fold field if present
            results = results.map(r => ({ _id: r._id, display_name: r.display_name }));

            return res.json({ institutions: results });
        }

        // browse (no q)
        const docs = await Institution.find()
            .sort({ display_name_folded: 1 })
            .skip(offset)
            .limit(limit)
            .select("_id display_name")
            .lean();
        return res.json({ institutions: docs });
    } catch (error) {
        console.error("getInstitutionsFilter error:", error);
        return res.status(500).json({ error: "Failed to fetch institutions" });
    }
}

// new: return a single field (by offset) with all topics for lazy one-at-a-time loading
// GET /api/search-filters/fields/one?offset=0
async function getSingleFieldWithTopics(req, res) {
    try {
        const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

        // fetch one field by alphabetical order
        const fields = await Field.find()
            .sort({ display_name: 1 })
            .skip(offset)
            .limit(1)
            .lean();

        if (!fields.length) {
            return res.json({ field: null, done: true });
        }

        const f = fields[0];

        // load all topics for this field (if you want batching per-field later, add offset/limit here)
        const topics = await Topic.find({ field_id: f._id })
            .sort({ display_name: 1 })
            .select("_id display_name")
            .lean();

        const totalTopics = await Topic.countDocuments({ field_id: f._id });

        return res.json({
            field: {
                _id: f._id,
                display_name: f.display_name,
                topics,
                topics_count: totalTopics
            },
            done: false
        });
    } catch (error) {
        console.error("getSingleFieldWithTopics error:", error);
        return res.status(500).json({ error: "Failed to fetch field with topics" });
    }
}

// return all fields (small: ~26 docs) with topic counts
async function getAllFields(req, res) {
  try {
    // load fields
    const fields = await Field.find()
      .sort({ display_name: 1 })
      .select("_id display_name")
      .lean();

    // aggregate topic counts grouped by field_id (null for uncategorized)
    const counts = await Topic.aggregate([
      {
        $group: {
          _id: { $ifNull: ["$field_id", null] },
          count: { $sum: 1 }
        }
      }
    ]);

    const countMap = {};
    counts.forEach(c => {
      const key = c._id === null ? "null" : String(c._id);
      countMap[key] = c.count;
    });

    // attach counts to fields
    const fieldsWithCounts = fields.map(f => ({
      _id: f._id,
      display_name: f.display_name,
      topics_count: countMap[String(f._id)] || 0
    }));

    // include uncategorized bucket if any uncategorized topics exist
    const uncCount = countMap["null"] || 0;
    if (uncCount > 0) {
      fieldsWithCounts.unshift({
        _id: null,
        display_name: "Uncategorized",
        topics_count: uncCount
      });
    }

    return res.json({ fields: fieldsWithCounts });
  } catch (err) {
    console.error("getAllFields error:", err);
    return res.status(500).json({ error: "Failed to fetch fields" });
  }
}

// return topics for a single field (supports pagination & optional q)
// GET /api/search-filters/fields/:fieldId/topics?offset=0&limit=500&q=...
async function getTopicsForField(req, res) {
    try {
        const rawId = req.params.fieldId;
        const fieldId = rawId === "null" ? null : rawId;
        const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
        const limit = Math.min(parseInt(req.query.limit, 10) || 1000, 5000);
        const q = (req.query.q || "").trim();

        const cond = {};
        if (fieldId === null) cond.$or = [{ field_id: null }, { field_id: { $exists: false } }];
        else cond.field_id = fieldId;

        if (q) {
            const qfold = foldString(q);
            cond.display_name = { $regex: toSafeRegex(qfold, { anchor: false, flags: "i" }) };
        }

        const [topics, total] = await Promise.all([
            Topic.find(cond).sort({ display_name: 1 }).skip(offset).limit(limit).select("_id display_name").lean(),
            Topic.countDocuments(cond)
        ]);

        return res.json({ topics, total });
    } catch (err) {
        console.error("getTopicsForField error:", err);
        return res.status(500).json({ error: "Failed to fetch topics for field" });
    }
}

module.exports = {
    getCountriesFilter,
    getInstitutionsFilter,
    getSingleFieldWithTopics,
    getAllFields,
    getTopicsForField
};