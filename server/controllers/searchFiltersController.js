//==================================================================
// Search Filters Controller
// Provides multiple API endpoints to search researchers by country,
// topic, metrics (h-index, i10-index), identifier, or composite filters
//==================================================================

const axios = require("axios");
const ResearcherProfile = require("../models/researcherProfile");

const OPENALEX_BASE = "https://api.openalex.org";

const opsMap = { eq: "$eq", gt: "$gt", gte: "$gte", lt: "$lt", lte: "$lte" };
const externalOpsMap = { eq: "", gt: ">", gte: ">=", lt: "<", lte: "<=" };

//==================================================================
// Helper: Simplify author object for responses
//==================================================================
const simplifyAuthors = (docs) =>
  docs.map((a) => ({
    _id: a._id,
    basic_info: {
      name: a.basic_info?.name || "(no name)",
    },
  }));

//==================================================================
// Helper: Build Redis-style key only with used filters
//==================================================================
function buildFilterKey(prefix, filters) {
  const { country, topic, hindex, i10index, identifier, op, page, limit } = filters;
  const segments = [prefix];

  if (country)    segments.push(`country=${country}`);
  if (topic)      segments.push(`topic=${topic}`);
  if (hindex)     segments.push(`hindex=${hindex}`);
  if (i10index)   segments.push(`i10index=${i10index}`);
  if (identifier) segments.push(`identifier=${identifier}`);
  if (hindex || i10index) segments.push(`op=${op}`);
  segments.push(`page=${page}`);
  segments.push(`limit=${limit}`);

  return segments.join(":");
}

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
    const raw = await ResearcherProfile.find(query).sort({ "basic_info.name": 1 }).skip(skip).limit(+limit);
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
    const query = {
      $or: [
        { "research_areas.topics.display_name": regex },
        { "research_areas.fields.display_name": regex },
      ],
    };
    const total = await ResearcherProfile.countDocuments(query);
    const raw = await ResearcherProfile.find(query).sort({ "basic_info.name": 1 }).skip(skip).limit(+limit);
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
    const raw = await ResearcherProfile.find(query).sort({ "basic_info.name": 1 }).skip(skip).limit(+limit);
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
    const raw = await ResearcherProfile.find(query).sort({ "basic_info.name": 1 }).skip(skip).limit(+limit);
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
    const raw = await ResearcherProfile.find(query).sort({ "basic_info.name": 1 }).skip(skip).limit(+limit);
    const authors = simplifyAuthors(raw);

    return res.json({ total, count: authors.length, page: +page, limit: +limit, authors });
  } catch (err) {
    console.error("Error in searchByIdentifier:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

//==================================================================
// [GET] /api/search-filters/multi
// Apply combined filters: country, topic, metrics, identifier
//==================================================================
exports.searchByMultipleFilters = async (req, res) => {
  const { country, topic, hindex, i10index, identifier, op = "eq", page = 1, limit = 20 } = req.query;
  const query = {};

  const redisKey = buildFilterKey("searchFilters", { country, topic, hindex, i10index, identifier, op, page, limit });
  console.log(`🔎 [FILTERS DB] ${redisKey}`);

  if (country) query["basic_info.affiliations.institution.country_code"] = country.toUpperCase();
  if (topic) {
    const regex = new RegExp(topic, "i");
    query["$or"] = [
      { "research_areas.topics.display_name": regex },
      { "research_areas.fields.display_name": regex },
    ];
  }
  if (hindex) query["research_metrics.h_index"] = { [opsMap[op] || "$eq"]: parseInt(hindex) };
  if (i10index) query["research_metrics.i10_index"] = { [opsMap[op] || "$eq"]: parseInt(i10index) };
  if (identifier) query[`identifiers.${identifier}`] = { $exists: true, $ne: "" };

  try {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await ResearcherProfile.countDocuments(query);
    const raw = await ResearcherProfile.find(query).sort({ "basic_info.name": 1 }).skip(skip).limit(+limit);
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
  try {
    const { country, topic, hindex, i10index, identifier, op = "eq", page = 1, limit = 25 } = req.query;
    const filters = [];

    const redisKey = buildFilterKey("openalexFilters", { country, topic, hindex, i10index, identifier, op, page, limit });
    console.log(`🌐 [FILTERS OPENALEX] ${redisKey}`);

    if (country) filters.push(`last_known_institutions.country_code:${country.toUpperCase()}`);
    if (hindex) filters.push(`summary_stats.h_index:${externalOpsMap[op] || ""}${hindex}`);
    if (i10index) filters.push(`summary_stats.i10_index:${externalOpsMap[op] || ""}${i10index}`);
    if (identifier) filters.push(`${identifier}!=null`);

    const params = new URLSearchParams();
    if (filters.length) params.append("filter", filters.join(","));
    if (topic) params.append("search", topic);
    params.append("page", page);
    params.append("per_page", limit);

    const url = `${OPENALEX_BASE}/authors?${params.toString()}`;
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent": "AcademicTalentFinder/1.0 (daithanhnguyen2711@gmail.com)",
        Accept: "application/json",
      },
    });

    const results = Array.isArray(data.results) ? data.results : [];
    const authors = results.map((a) => ({
      _id: a.id,
      basic_info: {
        name: a.display_name,
      },
    })).sort((a, b) => a.basic_info.name.localeCompare(b.basic_info.name));;
    
    return res.json({
      total: data.meta?.count || authors.length,
      count: authors.length,
      page: +page,
      limit: +limit,
      authors,
    });
  } catch (err) {
    console.error("Error in searchOpenalexFilters:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
