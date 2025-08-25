// ================================================================
// Search Filters Controller — Handles author search with multiple filters
// Route: [GET] /api/search-filters/search
// ================================================================

const ResearcherProfile = require("../models/researcherProfileModel");

// Helpers for query parsing and metric conditions (from utils/queryHelpers)
const qh = require("../utils/queryHelpers");
const { parseMultiOr, toSafeRegex, buildMetricCond, chooseOp, clampPageLimit } = qh;
const normalizeAuthorId = qh.normalizeAuthorId;
const ensureAIdField = qh.ensureAIdField;

// Fallback to OpenAlex if no results are found in the database
const authorController = require("./authorController");

// Unified search handler (runtime behavior unchanged).
exports.searchFilters = async (req, res) => {
  // Destructure known query parameters; apply defaults for page/limit.
  const {
    id,
    name,
    country, // OR across affiliation countries
    topic, // OR across topics or fields
    hindex,
    i10index,
    op, // global fallback operator (eq|gt|gte|lt|lte)
    op_hindex, // optional override for hindex
    op_i10, // optional override for i10index
    identifier, // identifiers.<key> must exist and be non-empty (supports multi)
    affiliation, // affiliation name (regex, supports multi)
    year_from, // inclusive lower bound
    year_to, // inclusive upper bound
    page = 1,
    limit = 20,
  } = req.query;

  try {
    // ------------------------------------------------------------------
    // 1) Direct detail lookup by ID (short-circuit)
    //    Accepts raw id (Axxxxx), normalized id, or full OpenAlex URL.
    //    If not found in DB, fall back to OpenAlex immediately.
    // ------------------------------------------------------------------
    if (id) {
      const norm = normalizeAuthorId(id);
      const candidates = Array.from(
        new Set(
          [String(id).trim(), norm ? norm : null, norm ? `https://openalex.org/${norm}` : null].filter(Boolean)
        )
      );

      // Avoid CastError by NOT forcing ObjectId; _id is treated as string here.
      const profileDoc = await ResearcherProfile.findOne({
        $or: [
          { _id: { $in: candidates } },
          { "identifiers.openalex": { $in: candidates } },
        ],
      }).lean();

      if (!profileDoc) {
        // Fallback to OpenAlex if the DB does not contain this profile
        return authorController.searchOpenalexFilters(req, res);
      }

      // Return a normalized/sanitized profile document
      return res.json({ profile: ensureAIdField(profileDoc) });
    }

    // ------------------------------------------------------------------
    // 2) Pagination (safe bounds)
    //    Clamp page/limit to keep queries predictable and protect the DB.
    //    Max limit = 100; default limit = 20; page is 1-based.
    // ------------------------------------------------------------------
    const { page: pageNum, limit: limNum } = clampPageLimit(page, limit, 100, 20);
    const skip = (pageNum - 1) * limNum;

    // ------------------------------------------------------------------
    // 3) Build query conditions (assembled into AND parts)
    //    Each recognized filter contributes a condition into `andParts`.
    // ------------------------------------------------------------------
    const query = {};
    const andParts = [];

    // NAME (case-insensitive substring on basic_info.name)
    // Example: name=jane -> /jane/i
    if (name) {
      andParts.push({ "basic_info.name": toSafeRegex(name) });
    }

    // COUNTRY (include_any / OR across the entire affiliation history)
    // Example: country=US|CN -> { country_code: { $in: ["US","CN"] } }
    const countries = parseMultiOr(country).map((c) => c.toUpperCase());
    if (countries.length === 1) {
      andParts.push({ "basic_info.affiliations.institution.country_code": countries[0] });
    } else if (countries.length > 1) {
      andParts.push({ "basic_info.affiliations.institution.country_code": { $in: countries } });
    }

    // TOPIC & FIELDS (include_any / OR)
    // Each topic term is compiled into a safe, case-insensitive regex and
    // matched against two fields: topics.display_name and fields.display_name.
    const topics = parseMultiOr(topic);
    if (topics.length > 0) {
      const topicOrs = [];
      for (const t of topics) {
        const rx = toSafeRegex(t);
        topicOrs.push({ "research_areas.topics.display_name": rx });
        topicOrs.push({ "research_areas.fields.display_name": rx });
      }
      andParts.push({ $or: topicOrs });
    }

    // METRICS (each metric can have its own op; fallback to global op; default eq)
    // Supported ops: eq|gt|gte|lt|lte
    const opH = chooseOp(op_hindex, op, "eq");
    const opI = chooseOp(op_i10, op, "eq");

    const hCond = buildMetricCond("research_metrics.h_index", opH, hindex);
    if (hCond) andParts.push(hCond);

    const iCond = buildMetricCond("research_metrics.i10_index", opI, i10index);
    if (iCond) andParts.push(iCond);

    // IDENTIFIER (exists & non-empty) — supports multi OR
    // Example: identifier=orcid|scopus -> $or on identifiers.orcid / identifiers.scopus
    const idents = parseMultiOr(identifier).map((x) => x.toLowerCase());
    if (idents.length === 1) {
      andParts.push({ [`identifiers.${idents[0]}`]: { $exists: true, $ne: "" } });
    } else if (idents.length > 1) {
      andParts.push({ $or: idents.map((k) => ({ [`identifiers.${k}`]: { $exists: true, $ne: "" } })) });
    }

    // AFFILIATION + YEAR RANGE (inclusive checks on history) — supports multi names
    // Semantics preserved:
    //   - 1 name  -> APPLY year range to that specific affiliation
    //   - >=2 names -> SKIP year range (OR by name only)
    //   - no name but year range -> APPLY year range to ANY affiliation
    const affNames = parseMultiOr(affiliation);
    const from = Number.isFinite(+year_from) ? +year_from : null;
    const to = Number.isFinite(+year_to) ? +year_to : null;

    if (affNames.length > 0) {
      if (affNames.length === 1) {
        // 1 institution -> APPLY year range (if provided)
        const affRx = toSafeRegex(affNames[0]);
        const affQuery = { "institution.display_name": affRx };

        if (from != null && to != null) {
          affQuery["years"] = { $elemMatch: { $gte: from, $lte: to } };
        } else if (from != null) {
          affQuery["years"] = { $elemMatch: { $gte: from } };
        } else if (to != null) {
          affQuery["years"] = { $elemMatch: { $lte: to } };
        }

        andParts.push({ "basic_info.affiliations": { $elemMatch: affQuery } });
      } else {
        // >=2 institutions -> SKIP year range (if provided); OR by name only
        const orAff = affNames.map((affName) => ({
          "basic_info.affiliations": {
            $elemMatch: { "institution.display_name": toSafeRegex(affName) },
          },
        }));
        andParts.push({ $or: orAff });
      }
    } else if (from != null || to != null) {
      // No affiliation name provided, but a year range is — apply to ANY affiliation
      const yearCond =
        from != null && to != null
          ? { years: { $elemMatch: { $gte: from, $lte: to } } }
          : from != null
          ? { years: { $elemMatch: { $gte: from } } }
          : { years: { $elemMatch: { $lte: to } } };

      andParts.push({ "basic_info.affiliations": { $elemMatch: yearCond } });
    }

    // ------------------------------------------------------------------
    // 4) Combine conditions into a single MongoDB query document
    // ------------------------------------------------------------------
    if (andParts.length === 1) Object.assign(query, andParts[0]);
    else if (andParts.length > 1) query.$and = andParts;

    // A lightweight debug log — note: regex values are not fully represented by JSON.stringify
    console.log(`🔎 [FILTERS DB] ${JSON.stringify(query)}`);

    // ------------------------------------------------------------------
    // 5) Execute the database query with pagination and sorting
    // ------------------------------------------------------------------
    const total = await ResearcherProfile.countDocuments(query);
    const docs = await ResearcherProfile.find(query)
      .sort({ "basic_info.name": 1 }) // alphabetical ascending by name
      .skip(skip)
      .limit(limNum)
      .lean();

    // Ensure a consistent "A-id" field is present on each author
    const sanitized = docs.map(ensureAIdField);

    // ------------------------------------------------------------------
    // 6) Auto fallback to OpenAlex if no DB results were found
    // ------------------------------------------------------------------
    if (total === 0) {
      return authorController.searchOpenalexFilters(req, res);
    }

    // Normal response: include pagination & result count metadata
    return res.json({
      total,
      count: sanitized.length,
      page: pageNum,
      limit: limNum,
      authors: sanitized,
    });
  } catch (err) {
    // Centralized error handling to avoid leaking stack traces to clients
    console.error("Error in searchFilters:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { searchFilters: exports.searchFilters };
