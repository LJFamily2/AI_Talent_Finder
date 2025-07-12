// server/controllers/searchFiltersController.js

const ResearcherProfile = require("../models/researcherProfile");

/**
 * GET /api/search-filters/by-topic?topic=<string>
 */
exports.searchByTopic = async (req, res) => {
  const { topic } = req.query;
  if (!topic) {
    return res.status(400).json({ error: "Topic is required" });
  }
  try {
    const regex = new RegExp(topic, "i");
    const authors = await ResearcherProfile.find({
      $or: [
        { "research_areas.topics.display_name": regex },
        { "research_areas.fields.display_name": regex }
      ]
    }).limit(20);
    if (!authors.length) {
      return res.status(404).json({ message: "No authors found for that topic" });
    }
    return res.json({ count: authors.length, authors });
  } catch (err) {
    console.error("Error in searchByTopic:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * POST /api/search-filters/by-topic
 * body: { topic: string }
 */
exports.searchByTopicPOST = async (req, res) => {
  const { topic } = req.body;
  if (!topic) {
    return res.status(400).json({ error: "Topic is required" });
  }
  try {
    const regex = new RegExp(topic, "i");
    const authors = await ResearcherProfile.find({
      $or: [
        { "research_areas.topics.display_name": regex },
        { "research_areas.fields.display_name": regex }
      ]
    }).limit(20);
    if (!authors.length) {
      return res.status(404).json({ message: "No authors found for that topic" });
    }
    return res.json({ count: authors.length, authors });
  } catch (err) {
    console.error("Error in searchByTopicPOST:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * GET /api/search-filters/by-country?country=<string>
 */
exports.searchByCountry = async (req, res) => {
  const { country } = req.query;
  if (!country) {
    return res.status(400).json({ error: "Country code is required" });
  }
  try {
    const code = country.toUpperCase();
    const authors = await ResearcherProfile.find({
      "basic_info.affiliations.institution.country_code": code
    }).limit(20);
    if (!authors.length) {
      return res.status(404).json({ message: "No authors found for that country" });
    }
    return res.json({ count: authors.length, authors });
  } catch (err) {
    console.error("Error in searchByCountry:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * POST /api/search-filters/by-country
 * body: { country: string }
 */
exports.searchByCountryPOST = async (req, res) => {
  const { country } = req.body;
  if (!country) {
    return res.status(400).json({ error: "Country code is required" });
  }
  try {
    const code = country.toUpperCase();
    const authors = await ResearcherProfile.find({
      "basic_info.affiliations.institution.country_code": code
    }).limit(20);
    if (!authors.length) {
      return res.status(404).json({ message: "No authors found for that country" });
    }
    return res.json({ count: authors.length, authors });
  } catch (err) {
    console.error("Error in searchByCountryPOST:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * GET /api/search-filters/by-hindex?hindex=<int>&op=<gte|lte|eq>
 */
exports.searchByHIndex = async (req, res) => {
  const { hindex, op } = req.query;
  if (!hindex) {
    return res.status(400).json({ error: "h-index value is required" });
  }
  const num = parseInt(hindex, 10);
  if (isNaN(num)) {
    return res.status(400).json({ error: "h-index must be an integer" });
  }
  const opsMap = { gte: "$gte", lte: "$lte", eq: "$eq" };
  const mongoOp = opsMap[op] || "$eq";
  try {
    const authors = await ResearcherProfile.find({
      "research_metrics.h_index": { [mongoOp]: num }
    }).limit(20);
    if (!authors.length) {
      return res.status(404).json({ message: "No authors match that h-index filter" });
    }
    return res.json({ count: authors.length, authors });
  } catch (err) {
    console.error("Error in searchByHIndex:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * POST /api/search-filters/by-hindex
 * body: { hindex: number, op: 'gte'|'lte'|'eq' }
 */
exports.searchByHIndexPOST = async (req, res) => {
  const { hindex, op } = req.body;
  if (hindex == null) {
    return res.status(400).json({ error: "h-index value is required" });
  }
  const num = parseInt(hindex, 10);
  if (isNaN(num)) {
    return res.status(400).json({ error: "h-index must be an integer" });
  }
  const opsMap = { gte: "$gte", lte: "$lte", eq: "$eq" };
  const mongoOp = opsMap[op] || "$eq";
  try {
    const authors = await ResearcherProfile.find({
      "research_metrics.h_index": { [mongoOp]: num }
    }).limit(20);
    if (!authors.length) {
      return res.status(404).json({ message: "No authors match that h-index filter" });
    }
    return res.json({ count: authors.length, authors });
  } catch (err) {
    console.error("Error in searchByHIndexPOST:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * GET /api/search-filters/by-i10index?i10index=<int>&op=<gte|lte|eq>
 */
exports.searchByI10Index = async (req, res) => {
  const { i10index, op } = req.query;
  if (!i10index) {
    return res.status(400).json({ error: "i10-index value is required" });
  }
  const num = parseInt(i10index, 10);
  if (isNaN(num)) {
    return res.status(400).json({ error: "i10-index must be an integer" });
  }
  const opsMap = { gte: "$gte", lte: "$lte", eq: "$eq" };
  const mongoOp = opsMap[op] || "$eq";
  try {
    const authors = await ResearcherProfile.find({
      "research_metrics.i10_index": { [mongoOp]: num }
    }).limit(20);
    if (!authors.length) {
      return res.status(404).json({ message: "No authors match that i10-index filter" });
    }
    return res.json({ count: authors.length, authors });
  } catch (err) {
    console.error("Error in searchByI10Index:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * POST /api/search-filters/by-i10index
 * body: { i10index: number, op: 'gte'|'lte'|'eq' }
 */
exports.searchByI10IndexPOST = async (req, res) => {
  const { i10index, op } = req.body;
  if (i10index == null) {
    return res.status(400).json({ error: "i10-index value is required" });
  }
  const num = parseInt(i10index, 10);
  if (isNaN(num)) {
    return res.status(400).json({ error: "i10-index must be an integer" });
  }
  const opsMap = { gte: "$gte", lte: "$lte", eq: "$eq" };
  const mongoOp = opsMap[op] || "$eq";
  try {
    const authors = await ResearcherProfile.find({
      "research_metrics.i10_index": { [mongoOp]: num }
    }).limit(20);
    if (!authors.length) {
      return res.status(404).json({ message: "No authors match that i10-index filter" });
    }
    return res.json({ count: authors.length, authors });
  } catch (err) {
    console.error("Error in searchByI10IndexPOST:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * GET /api/search-filters/with-identifier?type=orcid|scopus|openalex|google_scholar_id
 */
exports.searchByIdentifier = async (req, res) => {
  const { type } = req.query;
  const allowed = ['orcid','scopus','openalex','google_scholar_id'];
  if (!type || !allowed.includes(type)) {
    return res.status(400).json({ error: `type is required and must be one of: ${allowed.join(',')}` });
  }
  const field = `identifiers.${type}`;
  try {
    const authors = await ResearcherProfile.find({
      [field]: { $exists: true, $ne: "" }
    }).limit(20);
    if (!authors.length) {
      return res.status(404).json({ message: `No authors with ${type} found` });
    }
    return res.json({ count: authors.length, authors });
  } catch (err) {
    console.error(`Error in searchByIdentifier:`, err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * POST /api/search-filters/with-identifier
 * body: { type: 'orcid'|'scopus'|'openalex'|'google_scholar_id' }
 */
exports.searchByIdentifierPOST = async (req, res) => {
  const { type } = req.body;
  const allowed = ['orcid','scopus','openalex','google_scholar_id'];
  if (!type || !allowed.includes(type)) {
    return res.status(400).json({ error: `type is required and must be one of: ${allowed.join(',')}` });
  }
  const field = `identifiers.${type}`;
  try {
    const authors = await ResearcherProfile.find({
      [field]: { $exists: true, $ne: "" }
    }).limit(20);
    if (!authors.length) {
      return res.status(404).json({ message: `No authors with ${type} found` });
    }
    return res.json({ count: authors.length, authors });
  } catch (err) {
    console.error(`Error in searchByIdentifierPOST:`, err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
