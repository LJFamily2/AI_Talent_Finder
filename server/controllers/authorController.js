//==================================================================
// Author Controller
// Handles DB + API routes for searching, fetching, saving, and deleting author profiles
//==================================================================

const axios = require("axios");
const ResearcherProfile = require("../models/researcherProfile");
const { deleteCacheKey } = require("../middleware/cacheRedisInsight");

const OPENALEX_BASE = "https://api.openalex.org";

//==================================================================
// [GET] /api/author/search-author
// Search for author candidates in MongoDB by name, or get single profile by ID
//==================================================================
async function searchByCandidates(req, res, next) {
  try {
    const { id, name, page = 1, limit = 25 } = req.query;

    if (id) {
      const profileDoc = await ResearcherProfile.findById(id);
      if (!profileDoc) return res.status(404).json({ error: "Author not found" });
      return res.json({ profile: profileDoc });
    }

    if (!name) return res.status(400).json({ error: "Either 'id' or 'name' is required" });

    const pageNum = parseInt(page, 10);
    const limNum  = parseInt(limit, 10);
    const skip    = (pageNum - 1) * limNum;
    const regex   = new RegExp(name, "i");

    const filter = { "basic_info.name": regex };
    const total = await ResearcherProfile.countDocuments(filter);
    const docs  = await ResearcherProfile
      .find(filter)
      .skip(skip)
      .limit(limNum)
      .select({ _id: 1, "basic_info.name": 1 });

    const candidates = docs.map(doc => ({
      _id:  doc._id,
      name: doc.basic_info?.name || ""
    }));

    return res.json({
      total,
      count: candidates.length,
      page:  pageNum,
      limit: limNum,
      candidates
    });
  } catch (err) {
    console.error("Error in searchByCandidates:", err);
    next(err);
  }
}

//==================================================================
// [GET] /api/author/fetch-author
// Fetch author(s) from OpenAlex API (list or detail by ID)
//==================================================================
async function searchByFetch(req, res, next) {
  try {
    const { id, name, page = 1, limit = 25 } = req.query;

    // Fetch single author profile by ID
    if (id) {
      const { data: a } = await axios.get(`${OPENALEX_BASE}/authors/${encodeURIComponent(id)}`);
      const profile = {
        _id: id,
        basic_info: {
          name: a.display_name || "",
          affiliations: (a.affiliations || []).map(entry => ({
            institution: {
              display_name: entry.institution?.display_name || "",
              ror:           entry.institution?.ror           || "",
              id:            entry.institution?.id            || "",
              country_code:  entry.institution?.country_code  || ""
            },
            years: entry.years || []
          }))
        },
        identifiers: {
          openalex:          a.id          || "",
          orcid:             a.orcid       || "",
          scopus:            "",
          google_scholar_id: ""
        },
        research_metrics: {
          h_index:                 a.summary_stats?.h_index                 || 0,
          i10_index:               a.summary_stats?.i10_index               || 0,
          two_year_mean_citedness: a.summary_stats?.["2yr_mean_citedness"] || 0,
          total_citations:         a.cited_by_count                         || 0,
          total_works:             a.works_count                            || 0
        },
        research_areas: {
          fields: (a.x_concepts || []).slice(0, 5).map(c => ({ display_name: c.display_name })),
          topics: (a.x_concepts || []).slice(0, 25).map(c => ({
            display_name: c.display_name,
            count:        Math.round(c.score * 100)
          }))
        },
        citation_trends: {
          cited_by_table: [],
          counts_by_year: a.counts_by_year || []
        },
        current_affiliation: a.last_known_institution
          ? {
              institution:  "",
              display_name: a.last_known_institution.display_name || "",
              ror:          a.last_known_institution.ror           || ""
            }
          : { institution: "", display_name: "", ror: "" }
      };

      return res.json({ profile });
    }

    // List authors by name query
    if (!name) return res.status(400).json({ error: "Either 'id' or 'name' is required" });

    const pageNum = parseInt(page, 10);
    const limNum  = parseInt(limit, 10);
    const url = `${OPENALEX_BASE}/authors?search=${encodeURIComponent(name)}&page=${pageNum}&per_page=${limNum}`;
    const { data } = await axios.get(url);

    const total   = data.meta?.count ?? 0;
    const results = Array.isArray(data.results) ? data.results : [];
    const authors = results.map(r => ({ _id: r.id, name: r.display_name || "" }));

    return res.json({
      total,
      count: authors.length,
      page:  pageNum,
      limit: limNum,
      authors
    });
  } catch (err) {
    console.error("Error in searchByFetch:", err);
    next(err);
  }
}

//==================================================================
// [POST] /api/author/save-profile
// Save or update a profile into MongoDB (upsert)
//==================================================================
async function saveToDatabase(req, res, next) {
  try {
    const { profile } = req.body;
    if (!profile?._id) return res.status(400).json({ error: "Request body must include 'profile._id'" });

    const updatedProfile = await ResearcherProfile.findByIdAndUpdate(
      profile._id,
      { $set: profile },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`🟢 [DB SAVED] researcherProfiles:${profile._id}`);

    return res.json({
      message: "Profile saved to DB and cache successfully",
      profile: updatedProfile
    });
  } catch (err) {
    console.error("Error in saveToDatabase:", err);
    next(err);
  }
}

//==================================================================
// [DELETE] /api/author/delete-profile
// Remove a profile from MongoDB and clear Redis cache key
//==================================================================
async function deleteFromDatabase(req, res, next) {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "Missing id" });

    const deleted = await ResearcherProfile.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Author not found in DB" });

    console.log(`🗑️ [DB DEL] researcherProfiles:${id}`);
    await deleteCacheKey(`researcherProfiles:${id}`);

    return res.json({ message: "Profile deleted from DB successfully" });
  } catch (err) {
    console.error("Error in deleteFromDatabase:", err);
    next(err);
  }
}

//==================================================================
// Exports
//==================================================================
module.exports = {
  searchByCandidates,
  searchByFetch,
  saveToDatabase,
  deleteFromDatabase
};
