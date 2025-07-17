const axios = require("axios");
const ResearcherProfile = require("../models/researcherProfile");

const OPENALEX_BASE = "https://api.openalex.org";
const opsMap = { gte: "$gte", lte: "$lte", eq: "$eq" };

// Helper: sanitize authors before caching
const simplifyAuthors = (docs) =>
  docs.map((a) => ({
    _id: a._id,
    basic_info: {
      name: a.basic_info?.name || "(no name)",
    },
  }));

// ─── 1) SEARCH BY COUNTRY ─────────────────────────────────────────────────────────────
exports.searchByCountry = async (req, res) => {
  const { country, page = 1, limit = 20 } = req.query;
  if (!country) return res.status(400).json({ error: "Country code is required" });

  try {
    const code = country.toUpperCase();
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { "basic_info.affiliations.institution.country_code": code };
    const total = await ResearcherProfile.countDocuments(query);
    const raw = await ResearcherProfile.find(query).skip(skip).limit(+limit);
    const authors = simplifyAuthors(raw);

    return res.json({ total, count: authors.length, page: +page, limit: +limit, authors });
  } catch (err) {
    console.error("Error in searchByCountry:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};


// ─── 2) SEARCH BY TOPIC ──────────────────────────────────────────────────────────────
exports.searchByTopic = async (req, res) => {
  const { topic, page = 1, limit = 20 } = req.query;
  if (!topic) return res.status(400).json({ error: "Topic is required" });

  try {
    const regex = new RegExp(topic, "i");
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {
      $or: [
        { "research_areas.topics.display_name": regex },
        { "research_areas.fields.display_name": regex },
      ],
    };
    const total = await ResearcherProfile.countDocuments(query);
    const raw = await ResearcherProfile.find(query).skip(skip).limit(+limit);
    const authors = simplifyAuthors(raw);

    return res.json({ total, count: authors.length, page: +page, limit: +limit, authors });
  } catch (err) {
    console.error("Error in searchByTopic:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ─── 3) SEARCH BY H-INDEX ─────────────────────────────────────────────────────────────
exports.searchByHIndex = async (req, res) => {
  const { hindex, op = "eq", page = 1, limit = 20 } = req.query;
  if (!hindex) return res.status(400).json({ error: "h-index value is required" });

  try {
    const mongoOp = opsMap[op] || "$eq";
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { "research_metrics.h_index": { [mongoOp]: parseInt(hindex) } };
    const total = await ResearcherProfile.countDocuments(query);
    const raw = await ResearcherProfile.find(query).skip(skip).limit(+limit);
    const authors = simplifyAuthors(raw);

    return res.json({ total, count: authors.length, page: +page, limit: +limit, authors });
  } catch (err) {
    console.error("Error in searchByHIndex:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ─── 4) SEARCH BY I10-INDEX ──────────────────────────────────────────────────────────
exports.searchByI10Index = async (req, res) => {
  const { i10index, op = "eq", page = 1, limit = 20 } = req.query;
  if (!i10index) return res.status(400).json({ error: "i10-index value is required" });

  try {
    const mongoOp = opsMap[op] || "$eq";
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { "research_metrics.i10_index": { [mongoOp]: parseInt(i10index) } };
    const total = await ResearcherProfile.countDocuments(query);
    const raw = await ResearcherProfile.find(query).skip(skip).limit(+limit);
    const authors = simplifyAuthors(raw);

    return res.json({ total, count: authors.length, page: +page, limit: +limit, authors });
  } catch (err) {
    console.error("Error in searchByI10Index:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
// ─── 5) SEARCH BY IDENTIFIER ──────────────────────────────────────────────────────────
exports.searchByIdentifier = async (req, res) => {
  const { identifier, page = 1, limit = 20 } = req.query;
  const allowed = ["orcid", "scopus", "openalex", "google_scholar_id"];
  if (!identifier || !allowed.includes(identifier)) {
    return res.status(400).json({ error: `identifier must be one of: ${allowed.join(", ")}` });
  }

  try {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const field = `identifiers.${identifier}`;
    const query = { [field]: { $exists: true, $ne: "" } };
    const total = await ResearcherProfile.countDocuments(query);
    const raw = await ResearcherProfile.find(query).skip(skip).limit(+limit);
    const authors = simplifyAuthors(raw);

    return res.json({ total, count: authors.length, page: +page, limit: +limit, authors });
  } catch (err) {
    console.error("Error in searchByIdentifier:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ─── 6) MULTI-FILTER SEARCH IN MONGODB ─────────────────────────────────────────────
exports.searchByMultipleFilters = async (req, res) => {
  const { country, topic, hindex, i10index, identifier, op = "eq", page = 1, limit = 20 } = req.query;
  const query = {};

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
    const raw = await ResearcherProfile.find(query).skip(skip).limit(+limit);
    const authors = simplifyAuthors(raw);

    return res.json({ total, count: authors.length, page: +page, limit: +limit, authors });
  } catch (err) {
    console.error("Error in searchByMultipleFilters:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};


// ─── 7) MULTI-FILTER SEARCH FROM OPENALEX ─────────────────────────────────────────────
exports.searchOpenalexFilters = async (req, res) => {
  try {
    const { country, topic, hindex, i10index, identifier, page = 1, limit = 25 } = req.query;
    const filters = [];

    if (country) filters.push(`last_known_institutions.country_code:${country.toUpperCase()}`);
    if (hindex) filters.push(`summary_stats.h_index:${hindex}`);
    if (i10index) filters.push(`summary_stats.i10_index:${i10index}`);
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
    }));

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