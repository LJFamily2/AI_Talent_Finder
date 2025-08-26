//==================================================================
// Search Filters Controller (Unified)
// Combines candidate search (id, name) and multi-filter search
//==================================================================

const Researcher = require("../models/Researcher");

// helpers query parsing and metric conditions
const {
  parseMultiOr,
  toSafeRegex,
  buildMetricCond,
  chooseOp,
  clampPageLimit,
} = require("../utils/queryHelpers");

// fall back to OpenAlex if no results found
const authorController = require("./authorController");

//==================================================================
// [GET] /api/search-filters/search
// - exact by id
// - regex by name
// - filters: country (OR), topic (OR across topics|fields), metrics, identifier,
//            affiliation + year range
//==================================================================
exports.searchFilters = async (req, res) => {
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
    identifier, // identifiers.<key> must exist and non-empty (supports multi)
    affiliation, // affiliation name (regex, supports multi)
    year_from, // inclusive
    year_to, // inclusive
    page = 1,
    limit = 20,
  } = req.query;

  try {
    // 1) Detail by ID
    if (id) {
      const profileDoc = await Researcher.findById(id);
      if (!profileDoc)
        return res.status(404).json({ error: "Author not found" });
      return res.json({ profile: profileDoc });
    }

    // 2) Pagination (safe bounds) - DB max 100, default 20
    const { page: pageNum, limit: limNum } = clampPageLimit(
      page,
      limit,
      100,
      20
    );
    const skip = (pageNum - 1) * limNum;

    // 3) Build query
    const query = {};
    const andParts = [];

    // NAME (case-insensitive substring)
    if (name) {
      andParts.push({ "basic_info.name": toSafeRegex(name) });
    }

    // COUNTRY (include_any / OR across entire affiliation history)
    const countries = parseMultiOr(country).map((c) => c.toUpperCase());
    if (countries.length === 1) {
      andParts.push({
        "basic_info.affiliations.institution.country_code": countries[0],
      });
    } else if (countries.length > 1) {
      andParts.push({
        "basic_info.affiliations.institution.country_code": { $in: countries },
      });
    }

    // TOPIC & FIELDS (include_any / OR)
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

    // METRICS (each metric can have its own op, fallback to global op, default eq)
    const opH = chooseOp(op_hindex, op, "eq");
    const opI = chooseOp(op_i10, op, "eq");

    const hCond = buildMetricCond("research_metrics.h_index", opH, hindex);
    if (hCond) andParts.push(hCond);

    const iCond = buildMetricCond("research_metrics.i10_index", opI, i10index);
    if (iCond) andParts.push(iCond);

    // IDENTIFIER exists and non-empty (supports multi OR)
    const idents = parseMultiOr(identifier).map((x) => x.toLowerCase());
    if (idents.length === 1) {
      andParts.push({
        [`identifiers.${idents[0]}`]: { $exists: true, $ne: "" },
      });
    } else if (idents.length > 1) {
      andParts.push({
        $or: idents.map((k) => ({
          [`identifiers.${k}`]: { $exists: true, $ne: "" },
        })),
      });
    }

    // AFFILIATION + YEAR RANGE (inclusive checks on history) — supports multi names
    const affNames = parseMultiOr(affiliation);
    const from = Number.isFinite(+year_from) ? +year_from : null;
    const to = Number.isFinite(+year_to) ? +year_to : null;

    if (affNames.length > 0) {
      const affElemQueries = affNames.map((affName) => {
        const affRx = toSafeRegex(affName);
        const affQuery = { "institution.display_name": affRx };
        if (from != null && to != null) {
          affQuery["years"] = { $elemMatch: { $gte: from, $lte: to } };
        } else if (from != null) {
          affQuery["years"] = { $elemMatch: { $gte: from } };
        } else if (to != null) {
          affQuery["years"] = { $elemMatch: { $lte: to } };
        }
        return { "basic_info.affiliations": { $elemMatch: affQuery } };
      });

      // if search multi affiliations, use $or
      if (affElemQueries.length === 1) andParts.push(affElemQueries[0]);
      else andParts.push({ $or: affElemQueries });
    } else if (from != null || to != null) {
      // if no affiliation names, still check year range
      const yearCond =
        from != null && to != null
          ? { years: { $elemMatch: { $gte: from, $lte: to } } }
          : from != null
          ? { years: { $elemMatch: { $gte: from } } }
          : { years: { $elemMatch: { $lte: to } } };

      andParts.push({ "basic_info.affiliations": { $elemMatch: yearCond } });
    }

    // 4) Combine
    if (andParts.length === 1) Object.assign(query, andParts[0]);
    else if (andParts.length > 1) query.$and = andParts;

    console.log(`🔎 [FILTERS DB] ${JSON.stringify(query)}`);

    // 5) Execute
    const total = await Researcher.countDocuments(query);
    const docs = await Researcher.find(query)
      .sort({ "basic_info.name": 1 })
      .skip(skip)
      .limit(limNum);

    // 6) Auto fallback to OpenAlex if no results
    if (total === 0) {
      return authorController.searchOpenalexFilters(req, res);
    }

    return res.json({
      total,
      count: docs.length,
      page: pageNum,
      limit: limNum,
      authors: docs,
    });
  } catch (err) {
    console.error("Error in searchFilters:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  searchFilters: exports.searchFilters,
};
