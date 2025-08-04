//==================================================================
// Search Filters Controller
// Provides multiple API endpoints to search researchers by country,
// topic, metrics (h-index, i10-index), identifier, affiliation, current affiliation,
// year range, or composite filters
//==================================================================

const axios = require("axios");
const ResearcherProfile = require("../models/researcherProfileModel");

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
// [GET] /api/search-filters/search
// Apply combined filters: country, topic, metrics, identifiers,
// affiliation, current affiliation, year range
//==================================================================
exports.searchFilters = async (req, res) => {
  const {
    country, topic, hindex, i10index, identifier,
    affiliation, current_affiliation, year_from, year_to,
    op = "eq", page = 1, limit = 20
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

if (affiliation || year_from || year_to) {
  const affMatch = {};

  if (affiliation) {
    affMatch["institution.display_name"] = new RegExp(affiliation, "i");
  }

  const from = parseInt(year_from);
  const to = parseInt(year_to);

  // Cảnh báo nếu nhập sai khoảng
  if (!isNaN(from) && !isNaN(to) && from > to) {
    return res.status(400).json({
      error: "Invalid year range: 'year_from' must be less than or equal to 'year_to'"
    });
  }

  if (!isNaN(from) && !isNaN(to)) {
    if (from === to) {
      // 🎯 Trường hợp chỉ 1 năm, exact match [2011]
      affMatch["years"] = [from];
    } else {
      const yearRange = Array.from({ length: to - from + 1 }, (_, i) => from + i);
      affMatch["years"] = { $in: yearRange };
    }
  } else if (!isNaN(from)) {
    affMatch["years"] = { $gte: from };
  } else if (!isNaN(to)) {
    affMatch["years"] = { $lte: to };
  }

  query["basic_info.affiliations"] = { $elemMatch: affMatch };
}


  if (current_affiliation)
    query["current_affiliation.display_name"] = new RegExp(current_affiliation, "i");

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
    console.error("Error in searchFilters:", err);
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
    op = "eq", page = 1, limit = 20
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
