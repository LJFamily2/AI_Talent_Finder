const ResearcherProfile = require("../models/researcherProfile");
/**
 * Search by topic (in research_areas.topics hoặc research_areas.fields)
 * GET /api/authors/search/by-topic?topic=<string>
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
        { "research_areas.topics.display_name": { $regex: regex } },
        { "research_areas.fields.display_name": { $regex: regex } }
      ]
    })
      .limit(20); // limit to 20 results

    if (authors.length === 0) {
      return res.status(404).json({ message: "No authors found for that topic" });
    }

    return res.status(200).json({ count: authors.length, authors });
  } catch (err) {
    console.error("Error in searchByTopic:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * Search by institution country code
 * GET /api/authors/search/by-country?country=<string>
 */
exports.searchByCountry = async (req, res) => {
  const { country } = req.query;
  if (!country) {
    return res.status(400).json({ error: "Country code is required" });
  }

  try {
    const regex = new RegExp(`^${country}$`, "i");
    const authors = await ResearcherProfile.find({
      "basic_info.affiliations.institution.country_code": { $regex: regex }
    }).limit(20);

    if (authors.length === 0) {
      return res.status(404).json({ message: "No authors found for that country" });
    }

    return res.status(200).json({ count: authors.length, authors });
  } catch (err) {
    console.error("Error in searchByCountry:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * Search by h-index comparator
 * GET /api/authors/search/by-hindex?hindex=<int>&op=<gte|lte|eq>
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

  const ops = { gte: "$gte", lte: "$lte", eq: "$eq" };
  const mongoOp = ops[op] || "$eq";

  try {
    const authors = await ResearcherProfile.find({
      "research_metrics.h_index": { [mongoOp]: num }
    }).limit(20);

    if (authors.length === 0) {
      return res.status(404).json({ message: "No authors match that h-index filter" });
    }

    return res.status(200).json({ count: authors.length, authors });
  } catch (err) {
    console.error("Error in searchByHIndex:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * Search by i10-index comparator
 * GET /api/authors/search/by-i10index?i10index=<int>&op=<gte|lte|eq>
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

  const ops = { gte: "$gte", lte: "$lte", eq: "$eq" };
  const mongoOp = ops[op] || "$eq";

  try {
    const authors = await ResearcherProfile.find({
      "research_metrics.i10_index": { [mongoOp]: num }
    }).limit(20);

    if (authors.length === 0) {
      return res.status(404).json({ message: "No authors match that i10-index filter" });
    }

    return res.status(200).json({ count: authors.length, authors });
  } catch (err) {
    console.error("Error in searchByI10Index:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// /**
//  * Search only authors with ORCID ID
//  * GET /api/authors/search/with-orcid
//  */
// exports.searchWithOrcid = async (_req, res) => {
//   try {
//     const authors = await ResearcherProfile.find({
//       "identifiers.orcid": { $exists: true, $ne: "" }
//     }).limit(20);

//     if (authors.length === 0) {
//       return res.status(404).json({ message: "No authors with ORCID ID found" });
//     }

//     return res.status(200).json({ count: authors.length, authors });
//   } catch (err) {
//     console.error("Error in searchWithOrcid:", err.message);
//     return res.status(500).json({ error: "Internal Server Error" });
//   }
// };

// /**
//  * Search only authors with Scopus ID
//  * GET /api/authors/search/with-scopus
//  */
// exports.searchWithScopus = async (_req, res) => {
//   try {
//     const authors = await ResearcherProfile.find({
//       "identifiers.scopus": { $exists: true, $ne: "" }
//     }).limit(20);

//     if (authors.length === 0) {
//       return res.status(404).json({ message: "No authors with Scopus ID found" });
//     }

//     return res.status(200).json({ count: authors.length, authors });
//   } catch (err) {
//     console.error("Error in searchWithScopus:", err.message);
//     return res.status(500).json({ error: "Internal Server Error" });
//   }
// };

// /**
//  * Search only authors with OpenAlex ID
//  * GET /api/search-by-topic/with-openalex
//  */
// exports.searchWithOpenAlex = async (_req, res) => {
//   try {
//     const authors = await ResearcherProfile.find({
//       "identifiers.openalex": { $exists: true, $ne: "" }
//     }).limit(20);

//     if (authors.length === 0) {
//       return res.status(404).json({ message: "No authors with OpenAlex ID found" });
//     }

//     return res.status(200).json({ count: authors.length, authors });
//   } catch (err) {
//     console.error("Error in searchWithOpenAlex:", err.message);
//     return res.status(500).json({ error: "Internal Server Error" });
//   }
// };

exports.searchByIdentifier = async (req, res) => {
  const { type } = req.query;
  const allowed = ['orcid','scopus','openalex','google_scholar_id'];

  if (!type || !allowed.includes(type)) {
    return res
      .status(400)
      .json({ error: `type is required and must be one of: ${allowed.join(',')}` });
  }

  // Build dynamic field path
  const field = `identifiers.${type}`;

  try {
    const authors = await ResearcherProfile.find({
      [field]: { $exists: true, $ne: "" }
    }).limit(20);

    if (authors.length === 0) {
      return res
        .status(404)
        .json({ message: `No authors with ${type} found` });
    }

    return res.status(200).json({ count: authors.length, authors });
  } catch (err) {
    console.error(`Error in searchByIdentifier [${type}]:`, err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};