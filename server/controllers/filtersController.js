const Country = require("../models/Country");
const Institution = require("../models/Institution");
const Field = require("../models/Field");
const Topic = require("../models/Topic");
const Researcher = require("../models/Researcher");
const { foldString, toSafeRegex } = require("../utils/queryHelpers");

// Suggest researchers by name using Atlas Search (if enabled) or regex fallback
async function suggestResearchersByName(req, res) {
    try {
        const q = (req.query.q || "").trim();
        const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
        if (!q) return res.json({ suggestions: [] });

        // Auto-detect Atlas Search: try $search unless explicitly disabled
        if (process.env.USE_ATLAS_SEARCH !== "false") {
            try {
                const docs = await Researcher.aggregate([
                    {
                        $search: {
                            index: "name_autocomplete",
                            autocomplete: {
                                query: q,
                                path: "name",
                                tokenOrder: "sequential",
                                fuzzy: { maxEdits: 1, prefixLength: 2 }
                            }
                        }
                    },
                    { $limit: limit },
                    { $project: { id: "$_id", name: "$name", _id: 0 } }
                ]);
                res.set('X-Search-Source', 'atlas');
                console.log(`[name-suggest] atlas hit q="${q}" -> ${docs.length} results`);
                return res.json({ suggestions: docs });
            } catch (atlasErr) {
                // Fall through to regex if $search is unavailable or index missing
                console.warn("Atlas $search unavailable (name), falling back:", atlasErr?.message || atlasErr);
                if (process.env.REQUIRE_ATLAS_SEARCH === 'true') {
                    return res.status(500).json({ error: "Atlas Search required but unavailable for name suggestions" });
                }
            }
        }

        // Fallback: two-stage regex search
        const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const qlow = q.toLowerCase();

        // 1) Primary prefix matches
        const primaryLimit = Math.min(limit, 10);
        const prefixRe = new RegExp("^" + escapeRegex(q), "i");
        let primary = await Researcher.find({ name: { $regex: prefixRe } }, { _id: 1, name: 1 })
            .limit(primaryLimit)
            .lean();

        // Sort: earliest match (should be 0 for prefix), then shorter name
        primary.sort((a, b) => {
            const ai = (a.name || "").toLowerCase().indexOf(qlow);
            const bi = (b.name || "").toLowerCase().indexOf(qlow);
            if (ai !== bi) return ai - bi;
            return (a.name || "").length - (b.name || "").length;
        });

        const primaryIds = primary.map(d => d._id);

        // 2) Secondary token-AND contains to fill remaining
        let results = primary;
        if (results.length < limit) {
            const terms = q.trim().split(/\s+/).filter(Boolean).map(escapeRegex);
            const tokenConds = terms.map(t => ({ name: { $regex: new RegExp(t, "i") } }));
            const remaining = limit - results.length;
            const secondary = await Researcher.find({ $and: tokenConds, _id: { $nin: primaryIds } }, { _id: 1, name: 1 })
                .sort({ name: 1 })
                .limit(remaining)
                .lean();
            results = results.concat(secondary);
        }

        res.set('X-Search-Source', 'fallback');
        console.log(`[name-suggest] fallback hit q="${q}" -> ${results.length} results`);
        return res.json({ suggestions: results.map(d => ({ id: d._id, name: d.name || "" })) });
    } catch (err) {
        console.error("suggestResearchersByName error:", err);
        return res.status(500).json({ error: "Failed to fetch name suggestions" });
    }
}

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
            const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
            try {
                const docs = await Institution.aggregate([
                    {
                        $search: {
                            index: "inst_autocomplete",
                            autocomplete: {
                                query: q,
                                path: "display_name",
                                tokenOrder: "sequential",
                                fuzzy: { maxEdits: 1, prefixLength: 2 }
                            }
                        }
                    },
                    { $limit: limit },
                    { $project: { _id: 1, display_name: 1, score: { $meta: "searchScore" } } }
                ]);
                res.set('X-Search-Source', 'atlas');
                console.log(`[inst-suggest] atlas hit q="${q}" -> ${docs.length} results`);
                return res.json({ institutions: docs.map(d => ({ _id: d._id, display_name: d.display_name })) });
            } catch (e) {
                console.error("Atlas $search (institutions) failed:", e?.message || e);
                if (process.env.REQUIRE_ATLAS_SEARCH === 'true') {
                    return res.status(500).json({ error: "Atlas Search required but unavailable for institutions" });
                }
                // Minimal fallback: prefix regex on display_name
                const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const prefix = new RegExp('^' + escapeRegex(q), 'i');
                const docs = await Institution.find({ display_name: { $regex: prefix } }, { _id: 1, display_name: 1 })
                    .sort({ display_name: 1 })
                    .limit(limit)
                    .lean();
                res.set('X-Search-Source', 'fallback');
                console.log(`[inst-suggest] fallback hit q="${q}" -> ${docs.length} results`);
                return res.json({ institutions: docs });
            }
        }

        // browse (no q)
        const docs = await Institution.find()
            .sort({ display_name: 1 })
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

// Returns total number of institutions in database
async function getInstitutionsCount(req, res) {
    try {
        const total = await Institution.countDocuments();
        return res.json({ total });
    } catch (error) {
        console.error("getInstitutionsCount error:", error);
        return res.status(500).json({ error: "Failed to fetch institutions count" });
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

// Autocomplete topics across all fields using Atlas Search with minimal fallback
// GET /api/search-filters/topics?q=...&limit=50[&fieldId=...]
async function searchTopicsAutocomplete(req, res) {
    try {
        const q = (req.query.q || "").trim();
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
        const rawFieldId = req.query.fieldId;
        if (!q) return res.json({ topics: [] });

        // Helper to build fieldId match condition
        const fieldMatch = (() => {
            if (rawFieldId == null) return null;
            if (rawFieldId === "null") return { $or: [{ field_id: null }, { field_id: { $exists: false } }] };
            return { field_id: rawFieldId };
        })();

        // Try Atlas Search first (auto-detect unless explicitly disabled)
        if (process.env.USE_ATLAS_SEARCH !== "false") {
            try {
                const pipeline = [
                    {
                        $search: {
                            index: "topic_autocomplete",
                            autocomplete: {
                                query: q,
                                path: "display_name",
                                tokenOrder: "sequential",
                                fuzzy: { maxEdits: 1, prefixLength: 2 }
                            }
                        }
                    }
                ];
                if (fieldMatch) pipeline.push({ $match: fieldMatch });
                pipeline.push(
                    { $limit: limit },
                    {
                        $lookup: {
                            from: "fields",
                            localField: "field_id",
                            foreignField: "_id",
                            as: "_field"
                        }
                    },
                    {
                        $addFields: {
                            field_display_name: {
                                $ifNull: [{ $arrayElemAt: ["$_field.display_name", 0] }, "Uncategorized"]
                            }
                        }
                    },
                    { $project: { _id: 1, display_name: 1, field_id: 1, field_display_name: 1 } }
                );
                const docs = await Topic.aggregate(pipeline);
                res.set('X-Search-Source', 'atlas');
                console.log(`[topic-suggest] atlas hit q="${q}" -> ${docs.length} results`);
                return res.json({ topics: docs });
            } catch (atlasErr) {
                console.warn("Atlas $search (topics) unavailable, fallback:", atlasErr?.message || atlasErr);
                if (process.env.REQUIRE_ATLAS_SEARCH === 'true') {
                    return res.status(500).json({ error: "Atlas Search required but unavailable for topics" });
                }
            }
        }

        // Minimal fallback: prefix regex on display_name
        const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const prefix = new RegExp('^' + escapeRegex(q), 'i');
        const matchStage = { display_name: { $regex: prefix } };
        if (fieldMatch) Object.assign(matchStage, fieldMatch);
        const docs = await Topic.aggregate([
            { $match: matchStage },
            { $sort: { display_name: 1 } },
            { $limit: limit },
            { $lookup: { from: 'fields', localField: 'field_id', foreignField: '_id', as: '_field' } },
            {
                $addFields: {
                    field_display_name: { $ifNull: [{ $arrayElemAt: ["$_field.display_name", 0] }, "Uncategorized"] }
                }
            },
            { $project: { _id: 1, display_name: 1, field_id: 1, field_display_name: 1 } }
        ]);
        res.set('X-Search-Source', 'fallback');
        console.log(`[topic-suggest] fallback hit q="${q}" -> ${docs.length} results`);
        return res.json({ topics: docs });
    } catch (err) {
        console.error("searchTopicsAutocomplete error:", err);
        return res.status(500).json({ error: "Failed to fetch topic suggestions" });
    }
}

module.exports = {
    getCountriesFilter,
    getInstitutionsFilter,
    getInstitutionsCount,
    getSingleFieldWithTopics,
    getAllFields,
    getTopicsForField,
    suggestResearchersByName,
    searchTopicsAutocomplete
};
