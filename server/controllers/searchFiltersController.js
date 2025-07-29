//==================================================================
// Search Filters Controller
// Provides multiple API endpoints to search researchers by country,
// topic, metrics (h-index, i10-index), identifier, affiliation, current affiliation,
// year range, or composite filters
//==================================================================

const axios = require("axios");
const ResearcherProfile = require("../models/researcherProfileController");

const OPENALEX_BASE = "https://api.openalex.org";

const opsMap = { eq: "$eq", gt: "$gt", gte: "$gte", lt: "$lt", lte: "$lte" };
const externalOpsMap = { eq: "", gt: ">", gte: ">=", lt: "<", lte: "<=" };

//==================================================================
// Helper: Simplify author object for responses
//==================================================================
const simplifyAuthors = docs =>
  docs.map(a => ({
    _id: a._id,
    basic_info: { name: a.basic_info?.name || "(no name)" }
  }));

//==================================================================
// [GET] /api/search-filters/affiliation
// Filter by past affiliation (institution.display_name)
//==================================================================
exports.searchByAffiliation = async (req, res) => {
  const { affiliation, page = 1, limit = 20 } = req.query;
  if (!affiliation) return res.status(400).json({ error: "Affiliation is required" });

  try {
    console.log(`🔎 [FILTERS DB] searchFilters:affiliation=${affiliation}:page=${page}:limit=${limit}`);
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { "basic_info.affiliations.institution.display_name": new RegExp(affiliation, "i") };
    const total = await ResearcherProfile.countDocuments(query);
    const raw = await ResearcherProfile.find(query)
      .sort({ "basic_info.name": 1 })
      .skip(skip)
      .limit(+limit);
    const authors = simplifyAuthors(raw);

    return res.json({ total, count: authors.length, page: +page, limit: +limit, authors });
  } catch (err) {
    console.error("Error in searchByAffiliation:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

//==================================================================
// [GET] /api/search-filters/current-affiliation
// Filter by current affiliation (current_affiliation.display_name)
//==================================================================
exports.searchByCurrentAffiliation = async (req, res) => {
  const { current_affiliation, page = 1, limit = 20 } = req.query;
  if (!current_affiliation)
    return res.status(400).json({ error: "Current affiliation is required" });

  try {
    console.log(`🔎 [FILTERS DB] searchFilters:current_affiliation=${current_affiliation}:page=${page}:limit=${limit}`);
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { "current_affiliation.display_name": new RegExp(current_affiliation, "i") };
    const total = await ResearcherProfile.countDocuments(query);
    const raw = await ResearcherProfile.find(query)
      .sort({ "basic_info.name": 1 })
      .skip(skip)
      .limit(+limit);
    const authors = simplifyAuthors(raw);

    return res.json({ total, count: authors.length, page: +page, limit: +limit, authors });
  } catch (err) {
    console.error("Error in searchByCurrentAffiliation:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

//==================================================================
// [GET] /api/search-filters/year-range
// Filter by affiliation years between year_from and year_to
//==================================================================
exports.searchByYearRange = async (req, res) => {
  const { year_from, year_to, page = 1, limit = 20 } = req.query;
  if (!year_from && !year_to)
    return res.status(400).json({ error: "At least one of year_from or year_to is required" });

  try {
    console.log(`🔎 [FILTERS DB] searchFilters:year_from=${year_from || ''}:year_to=${year_to || ''}:page=${page}:limit=${limit}`);
    const from = parseInt(year_from);
    const to = parseInt(year_to);
    const currentYear = new Date().getFullYear();

    let minYear = isNaN(from) ? null : from;
    let maxYear = isNaN(to) ? null : to;
    if (minYear !== null && maxYear !== null && minYear > maxYear) {
      console.warn(`⚠️ Invalid year range: year_from (${minYear}) > year_to (${maxYear})`);
      minYear = null;
    }

    const rangeFilter = {};
    if (minYear !== null) rangeFilter.$gte = minYear;
    if (maxYear !== null) rangeFilter.$lte = maxYear;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { "basic_info.affiliations.years": { $elemMatch: rangeFilter } };
    const total = await ResearcherProfile.countDocuments(query);
    const raw = await ResearcherProfile.find(query)
      .sort({ "basic_info.name": 1 })
      .skip(skip)
      .limit(+limit);
    const authors = simplifyAuthors(raw);

    return res.json({ total, count: authors.length, page: +page, limit: +limit, authors });
  } catch (err) {
    console.error("Error in searchByYearRange:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

//==================================================================
// [GET] /api/search-filters/country
// Filter by country using institution.country_code
//==================================================================
exports.searchByCountry = async (req, res) => {
  const { country, page = 1, limit = 20 } = req.query;
  if (!country) return res.status(400).json({ error: "Country code is required" });

  try {
    console.log(`🔎 [FILTERS DB] searchFilters:country=${country}:page=${page}:limit=${limit}`);
    const code = country.toUpperCase();
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { "basic_info.affiliations.institution.country_code": code };
    const total = await ResearcherProfile.countDocuments(query);
    const raw = await ResearcherProfile.find(query)
      .sort({ "basic_info.name": 1 })
      .skip(skip)
      .limit(+limit);
    const authors = simplifyAuthors(raw);

    return res.json({ total, count: authors.length, page: +page, limit: +limit, authors });
  } catch (err) {
    console.error("Error in searchByCountry:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

//==================================================================
// [GET] /api/search-filters/topic
// Filter by topic or field match (case-insensitive partial match)
//==================================================================
exports.searchByTopic = async (req, res) => {
  const { topic, page = 1, limit = 20 } = req.query;
  if (!topic) return res.status(400).json({ error: "Topic is required" });

  try {
    console.log(`🔎 [FILTERS DB] searchFilters:topic=${topic}:page=${page}:limit=${limit}`);
    const regex = new RegExp(topic, "i");
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { $or: [
      { "research_areas.topics.display_name": regex },
      { "research_areas.fields.display_name": regex }
    ]};
    const total = await ResearcherProfile.countDocuments(query);
    const raw = await ResearcherProfile.find(query)
      .sort({ "basic_info.name": 1 })
      .skip(skip)
      .limit(+limit);
    const authors = simplifyAuthors(raw);

    return res.json({ total, count: authors.length, page: +page, limit: +limit, authors });
  } catch (err) {
    console.error("Error in searchByTopic:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

//==================================================================
// [GET] /api/search-filters/hindex
// Filter by h-index with operator: eq | gte | lte
//==================================================================
exports.searchByHIndex = async (req, res) => {
  const { hindex, op = "eq", page = 1, limit = 20 } = req.query;
  if (!hindex) return res.status(400).json({ error: "h-index value is required" });

  try {
    console.log(`🔎 [FILTERS DB] searchFilters:hindex=${hindex}:op=${op}:page=${page}:limit=${limit}`);
    const mongoOp = opsMap[op] || "$eq";
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { "research_metrics.h_index": { [mongoOp]: parseInt(hindex) } };
    const total = await ResearcherProfile.countDocuments(query);
    const raw = await ResearcherProfile.find(query)
      .sort({ "basic_info.name": 1 })
      .skip(skip)
      .limit(+limit);
    const authors = simplifyAuthors(raw);

    return res.json({ total, count: authors.length, page: +page, limit: +limit, authors });
  } catch (err) {
    console.error("Error in searchByHIndex:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

//==================================================================
// [GET] /api/search-filters/i10index
// Filter by i10-index with operator: eq | gte | lte
//==================================================================
exports.searchByI10Index = async (req, res) => {
  const { i10index, op = "eq", page = 1, limit = 20 } = req.query;
  if (!i10index) return res.status(400).json({ error: "i10-index value is required" });

  try {
    console.log(`🔎 [FILTERS DB] searchFilters:i10index=${i10index}:op=${op}:page=${page}:limit=${limit}`);
    const mongoOp = opsMap[op] || "$eq";
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { "research_metrics.i10_index": { [mongoOp]: parseInt(i10index) } };
    const total = await ResearcherProfile.countDocuments(query);
    const raw = await ResearcherProfile.find(query)
      .sort({ "basic_info.name": 1 })
      .skip(skip)
      .limit(+limit);
    const authors = simplifyAuthors(raw);

    return res.json({ total, count: authors.length, page: +page, limit: +limit, authors });
  } catch (err) {
    console.error("Error in searchByI10Index:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

//==================================================================
// [GET] /api/search-filters/identifier
// Filter by presence of a specific identifier (e.g. ORCID, Scopus)
//==================================================================
exports.searchByIdentifier = async (req, res) => {
  const { identifier, page = 1, limit = 20 } = req.query;
  const allowed = ["orcid", "scopus", "openalex", "google_scholar_id"];
  if (!identifier || !allowed.includes(identifier)) {
    return res.status(400).json({ error: `identifier must be one of: ${allowed.join(", ")}` });
  }

  try {
    console.log(`🔎 [FILTERS DB] searchFilters:identifier=${identifier}:page=${page}:limit=${limit}`);
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const field = `identifiers.${identifier}`;
    const query = { [field]: { $exists: true, $ne: "" } };
    const total = await ResearcherProfile.countDocuments(query);
    const raw = await ResearcherProfile.find(query)
      .sort({ "basic_info.name": 1 })
      .skip(skip)
      .limit(+limit);
    const authors = simplifyAuthors(raw);

    return res.json({ total, count: authors.length, page: +page, limit: +limit, authors });
  } catch (err) {
    console.error("Error in searchByIdentifier:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

//==================================================================
// [GET] /api/search-filters/multi
// Apply combined filters: country, topic, metrics, identifiers,
// affiliation, current affiliation, year range
//==================================================================
exports.searchByMultipleFilters = async (req, res) => {
  const {
    country, topic, hindex, i10index, identifier,
    affiliation, current_affiliation, year_from, year_to,
    op = "eq", page = 1, limit = 25
  } = req.query;

  // Build Redis key & log
  const rawKey = [
    "searchFilters",
    country && `country=${country}`,
    topic && `topic=${topic}`,
    hindex && `hindex=${hindex}`,
    i10index && `i10index=${i10index}`,
    identifier && `identifier=${identifier}`,
    op && (hindex||i10index) && `op=${op}`,
    affiliation && `affiliation=${affiliation}`,
    current_affiliation && `current_affiliation=${current_affiliation}`,
    year_from && `year_from=${year_from}`,
    year_to && `year_to=${year_to}`,
    `page=${page}`,
    `limit=${limit}`
  ]
    .filter(Boolean)
    .join(":");
  console.log(`🔎 [FILTERS DB] ${rawKey}`);

  // Construct Mongo query
  const query = {};
  if (country)
    query["basic_info.affiliations.institution.country_code"] = country.toUpperCase();

  if (topic) {
    const re = new RegExp(topic, "i");
    query["$or"] = [
      { "research_areas.topics.display_name": re },
      { "research_areas.fields.display_name": re }
    ];
  }
  if (hindex)
    query["research_metrics.h_index"] = { [opsMap[op]||"$eq"]: parseInt(hindex) };
  if (i10index)
    query["research_metrics.i10_index"] = { [opsMap[op]||"$eq"]: parseInt(i10index) };
  if (identifier)
    query[`identifiers.${identifier}`] = { $exists:true, $ne:"" };
  if (affiliation)
    query["basic_info.affiliations.institution.display_name"] = new RegExp(affiliation, "i");
  if (current_affiliation)
    query["current_affiliation.display_name"] = new RegExp(current_affiliation, "i");
  if (year_from || year_to) {
    const from = parseInt(year_from);
    const to = parseInt(year_to);
    const cr = new Date().getFullYear();
    let minY = isNaN(from)?null:from;
    let maxY = isNaN(to)?null:to;
    if (minY!=null && maxY!=null && minY>maxY) minY=null;
    query["basic_info.affiliations.years"] = { $elemMatch: {
      ...(minY!=null?{$gte:minY}:{}),
      ...(maxY!=null?{$lte:maxY}:{}),
    }};
  }

  try {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await ResearcherProfile.countDocuments(query);
    const raw = await ResearcherProfile.find(query)
      .sort({ "basic_info.name": 1 })
      .skip(skip)
      .limit(+limit);
    const authors = simplifyAuthors(raw);

    return res.json({ total, count: authors.length, page: +page, limit: +limit, authors });
  } catch (err) {
    console.error("Error in searchByMultipleFilters:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

//==================================================================
// [GET] /api/search-filters/openalex
// Perform external filter search via OpenAlex public API
//==================================================================
exports.searchOpenalexFilters = async (req, res) => {
  const {
    country, topic, hindex, i10index, identifier,
    affiliation, current_affiliation, year_from, year_to,
    op = "eq", page = 1, limit = 25
  } = req.query;
  try {
    const redisKey = buildFilterKey("openalexFilters", {
      country, topic, hindex, i10index, identifier,
      affiliation, current_affiliation, year_from, year_to,
      op, page, limit
    });
    console.log(`🌐 [FILTERS OPENALEX] ${redisKey}`);

    const filters = [];
    if (country) filters.push(`last_known_institutions.country_code:${country.toUpperCase()}`);
    if (topic) {/* search param handled below */}
    if (hindex) filters.push(`summary_stats.h_index:${externalOpsMap[op]||""}${hindex}`);
    if (i10index) filters.push(`summary_stats.i10_index:${externalOpsMap[op]||""}${i10index}`);
    if (identifier) filters.push(`${identifier}!=null`);

    const params = new URLSearchParams();
    if (filters.length) params.append("filter", filters.join(","));
    if (topic) params.append("search", topic);
    params.append("page", page);
    params.append("per_page", limit);

    const url = `${OPENALEX_BASE}/authors?${params}`;
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent": "AcademicTalentFinder/1.0",
        Accept: "application/json"
      }
    });

    const results = Array.isArray(data.results) ? data.results : [];
    const authors = results.map(a => ({ _id: a.id, basic_info: { name: a.display_name } }))
      .sort((a, b) => a.basic_info.name.localeCompare(b.basic_info.name));

    return res.json({ total: data.meta?.count||authors.length, count: authors.length, page: +page, limit: +limit, authors });
  } catch (err) {
    console.error("Error in searchOpenalexFilters:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
