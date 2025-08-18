//==================================================================
// Author Controller
// Handles DB + API routes for searching, fetching, saving, and deleting author profiles
//==================================================================

const axios = require("axios");
const ResearcherProfile = require("../models/researcherProfileModel");
const { deleteCacheKey } = require("../middleware/cacheRedisInsight");

// Helpers for OpenAlex API, query parsing, and year range checks
const {
  parseMultiOr,
  buildSearchStringFromPhrases,
  chooseOp,
  buildExternalMetricCond,
  clampPageLimit,
  parseYearBounds,
  inYearRange,
  normalizeAuthorId
} = require("../utils/queryHelpers");

const OPENALEX_BASE = "https://api.openalex.org";

//==================================================================
// [GET] /api/search-filters/openalex
//==================================================================
exports.searchOpenalexFilters = async (req, res) => {
  const {
    id,
    name,
    country,
    topic,
    hindex,
    i10index,
    op,           // global op (fallback)
    op_hindex,    // priority for hindex
    op_i10,       // priority i10index
    identifier,
    affiliation,
    year_from,
    year_to,
    page = 1,
    limit = 20
  } = req.query;

  // helper: resolve org name -> list Institution IDs (I……)
  async function resolveInstitutionIdsByName(q, max = 5) {
    if (!q) return [];
    const qp = new URLSearchParams({ search: q, per_page: String(max) });
    const url = `${OPENALEX_BASE}/institutions?${qp}`;
    const { data } = await axios.get(url, {
      headers: { "User-Agent": "AcademicTalentFinder/1.0", Accept: "application/json" }
    });
    const results = Array.isArray(data.results) ? data.results : [];
    return results.map(r => r.id).filter(Boolean); // e.g. "https://openalex.org/I..."
  }

  try {
    // 1) Detail by ID - OpenAlex
    if (id) {
      // Chuẩn hóa ID nếu là URL -> A\d+; nếu không normalize được thì dùng nguyên giá trị người dùng.
      const normId = normalizeAuthorId(id) || id;

      const { data: a } = await axios.get(`${OPENALEX_BASE}/authors/${encodeURIComponent(normId)}`, {
        headers: { "User-Agent": "AcademicTalentFinder/1.0", Accept: "application/json" }
      });

      const sortedConcepts = Array.isArray(a.x_concepts)
        ? [...a.x_concepts].sort((x, y) => (y.score || 0) - (x.score || 0))
        : [];
      const topTopics = sortedConcepts.slice(0, 10).map(c => ({
        display_name: c.display_name,
        count: Math.round((c.score || 0) * 100)
      }));
      const fields = sortedConcepts.slice(0, 5).map(c => ({
        display_name: c.display_name,
        count: Math.round((c.score || 0) * 100)
      }));

      const fallbackAff = (a.affiliations?.[0]?.institution?.display_name)
        ? {
            institution: "",
            display_name: a.affiliations[0].institution.display_name,
            ror: a.affiliations[0].institution.ror || "",
            country_code: a.affiliations[0].institution.country_code || ""
          }
        : { institution: "", display_name: "", ror: "", country_code: "" };

      const currentAff = a.last_known_institution?.display_name
        ? {
            institution: "",
            display_name: a.last_known_institution.display_name,
            ror: a.last_known_institution.ror || "",
            country_code: a.last_known_institution.country_code || ""
          }
        : fallbackAff;

      const profile = {
        _id: normalizeAuthorId(id) || id,
        basic_info: {
          name: a.display_name || "",
          affiliations: (a.affiliations || []).map(entry => ({
            institution: {
              display_name: entry.institution?.display_name || "",
              ror:          entry.institution?.ror || "",
              id:           entry.institution?.id || "",
              country_code: entry.institution?.country_code || ""
            },
            years: entry.years || []
          }))
        },
        identifiers: {
          openalex: a.id || "",
          orcid: a.orcid || ""
        },
        research_metrics: {
          h_index: a.summary_stats?.h_index || 0,
          i10_index: a.summary_stats?.i10_index || 0,
          two_year_mean_citedness: a.summary_stats?.["2yr_mean_citedness"] || 0,
          total_citations: a.cited_by_count || 0,
          total_works: a.works_count || 0
        },
        research_areas: { fields, topics: topTopics },
        citation_trends: { cited_by_table: [], counts_by_year: a.counts_by_year || [] },
        current_affiliation: currentAff
      };

      return res.json({ profile });
    }

    // 2) Build query filters for OpenAlex API
    const filters = [];

    // COUNTRY (multi) -> last_known_institutions.country_code:eg|pk
    const countries = parseMultiOr(country).map(c => c.toLowerCase());
    if (countries.length === 1) {
      filters.push(`last_known_institutions.country_code:${countries[0]}`);
    } else if (countries.length > 1) {
      filters.push(`last_known_institutions.country_code:${countries.join("|")}`);
    }

    // Operators cho metrics
    const opH = chooseOp(op_hindex, op, "eq");
    const opI = chooseOp(op_i10, op, "eq");

    const hFrag = buildExternalMetricCond("summary_stats.h_index", opH, hindex);
    if (hFrag) filters.push(hFrag);

    const iFrag = buildExternalMetricCond("summary_stats.i10_index", opI, i10index);
    if (iFrag) filters.push(iFrag);

    // Identifier flags
    if (identifier) {
      const idNorm = String(identifier).toLowerCase();
      if (idNorm === "openalex") filters.push("ids.openalex!=null");
      else if (idNorm === "orcid") filters.push("has_orcid:true");
      else if (idNorm === "scopus") filters.push("ids.scopus!=null");
      else if (idNorm === "google_scholar") filters.push("ids.google_scholar!=null");
    }

    // affiliation: ID/ROR/name
    let affIds = [];
    if (affiliation) {
      const affStr = String(affiliation).trim();
      if (/^https?:\/\/openalex\.org\/I/i.test(affStr)) {
        affIds = [affStr];
      } else if (/^https?:\/\/ror\.org\//i.test(affStr)) {
        filters.push(`affiliations.institution.ror:${affStr}`);
      } else {
        affIds = await resolveInstitutionIdsByName(affStr, 5);
      }
      if (affIds.length) {
        filters.push(`affiliations.institution.id:${affIds.join("|")}`);
      }
    }

    // SEARCH terms: name + multi topics (quoted phrases)
    const topics = parseMultiOr(topic);
    const searchStr = buildSearchStringFromPhrases(
      [name, ...topics].filter(Boolean)
    );

    // Pagination: default 20, max 20 (theo clamp hiện tại)
    const { page: pageNum, limit: limNum } = clampPageLimit(page, limit, 20, 20);

    const params = new URLSearchParams();
    if (filters.length) params.append("filter", filters.join(","));
    if (searchStr) params.append("search", searchStr);
    params.append("page", pageNum);
    params.append("per_page", limNum);

    const url = `${OPENALEX_BASE}/authors?${params.toString()}`;
    const { data } = await axios.get(url, {
      headers: { "User-Agent": "AcademicTalentFinder/1.0", Accept: "application/json" }
    });

    // Mapping results to match our profile structure
    const results = Array.isArray(data.results) ? data.results : [];
    let authors = results.map(a => {
      const sorted = Array.isArray(a.x_concepts)
        ? [...a.x_concepts].sort((x, y) => (y.score || 0) - (x.score || 0))
        : [];
      const topicsTop = sorted.slice(0, 10).map(c => ({
        display_name: c.display_name,
        count: Math.round((c.score || 0) * 100)
      }));
      const fields = sorted.slice(0, 5).map(c => ({
        display_name: c.display_name,
        count: Math.round((c.score || 0) * 100)
      }));

      const fallbackAff = (a.affiliations?.[0]?.institution?.display_name)
        ? {
            institution: "",
            display_name: a.affiliations[0].institution.display_name,
            ror: a.affiliations[0].institution.ror || "",
            country_code: a.affiliations[0].institution.country_code || ""
          }
        : { institution: "", display_name: "", ror: "", country_code: "" };

      const currentAff = a.last_known_institution?.display_name
        ? {
            institution: "",
            display_name: a.last_known_institution.display_name,
            ror: a.last_known_institution.ror || "",
            country_code: a.last_known_institution.country_code || ""
          }
        : fallbackAff;

      return {
        _id: normalizeAuthorId(a.id) || a.id,
        basic_info: {
          name: a.display_name || "",
          affiliations: (a.affiliations || []).map(entry => ({
            institution: {
              display_name: entry.institution?.display_name || "",
              ror:          entry.institution?.ror || "",
              id:           entry.institution?.id || "",
              country_code: entry.institution?.country_code || ""
            },
            years: entry.years || []
          }))
        },
        identifiers: {
          openalex: a.id || "",
          orcid: a.orcid || "",
          scopus: "",
          google_scholar_id: ""
        },
        research_metrics: {
          h_index: a.summary_stats?.h_index || 0,
          i10_index: a.summary_stats?.i10_index || 0,
          two_year_mean_citedness: a.summary_stats?.["2yr_mean_citedness"] || 0,
          total_citations: a.cited_by_count || 0,
          total_works: a.works_count || 0
        },
        research_areas: { fields, topics: topicsTop },
        citation_trends: { cited_by_table: [], counts_by_year: a.counts_by_year || [] },
        current_affiliation: currentAff,

        // raw data for affiliations to filter by year later
        __affiliations_raw: a.affiliations || []
      };
    });

    // 3) filter by year range
    const { from, to } = parseYearBounds(year_from, year_to);
    if (from != null || to != null) {
      authors = authors.filter(a => {
        if (!Array.isArray(a.__affiliations_raw)) return false;
        if (affIds.length) {
          // only check affiliations with specified IDs
          return a.__affiliations_raw.some(aff =>
            affIds.includes(aff.institution?.id) &&
            inYearRange(aff.years, from, to)
          );
        }
        // if not filtering by specific IDs, check any affiliation
        return a.__affiliations_raw.some(aff => inYearRange(aff.years, from, to));
      });
    }

    // 4) total count of OpenAlex results
    const totalAll = data?.meta?.count ?? 0;

    return res.json({
      total: totalAll,          // total of OpenAlex results
      count: authors.length,    // total after year filter per page
      page: pageNum,
      limit: limNum,
      authors
    });
  } catch (err) {
    console.error("Error in searchOpenalexFilters:", err.stack || err);
    return res
      .status(500)
      .json({ error: "OpenAlex fetch error", details: err.response?.data || err.message });
  }
};

// //==================================================================
// // [POST] /api/author/save-profile
// // Save or update a profile into MongoDB (upsert)
// //==================================================================
// async function saveToDatabase(req, res, next) {
//   try {
//     const { profile } = req.body?.profile ?? req.body;
//     if (!profile?._id) return res.status(400).json({ error: "Request body must include 'profile._id'" });

//     const normId = normalizeAuthorId(profile._id || profile.id || profile.identifiers?.openalex);
//     if (!normId) return res.status(400).json({ error: "Invalid author id" });
//     profile._id = normId;

//     const updatedProfile = await ResearcherProfile.findByIdAndUpdate(
//       profile._id,
//       { $set: profile },
//       { upsert: true, new: true, setDefaultsOnInsert: true }
//     );

//     console.log(`📝 [DB SAVED] researcherProfiles:${profile._id}`);

//     return res.json({
//       message: "Profile saved to DB and cache successfully",
//       profile: updatedProfile
//     });
//   } catch (err) {
//     console.error("Error in saveToDatabase:", err);
//     next(err);
//   }
// }

// //==================================================================
// // [DELETE] /api/author/delete-profile
// // Remove a profile from MongoDB and clear Redis cache key
// //  - Idempotent: không tồn tại vẫn trả 200 (để CLI không crash)
// //  - Dùng _id = A\d+ sau khi normalize (single source of truth)
// //==================================================================
// async function deleteFromDatabase(req, res, next) {
//   try {
//     const { id } = req.body ?? {};
//     if (!id) return res.status(400).json({ error: "Missing id" });

//     // Chuẩn hóa ID; strict để báo 400 nếu input sai định dạng hoàn toàn
//     let normalized;
//     try {
//       normalized = normalizeAuthorId(id, { strict: true });
//     } catch {
//       return res.status(400).json({ error: "Invalid author id" });
//     }

//     // Xóa theo _id đã normalize (DB đang lưu _id = 'A\d+')
//     const deletedDoc = await ResearcherProfile.findByIdAndDelete(normalized);

//     // Dọn cache key bất kể có doc hay không (idempotent cleanup)
//     try {
//       await deleteCacheKey(`researcherProfiles:${normalized}`);
//     } catch (e) {
//       // im lặng nếu key không tồn tại; tránh làm hỏng flow idempotent
//     }

//     if (!deletedDoc) {
//       console.info(`[DB DEL] not found -> clean state OK`, { _id: normalized });
//       return res.status(200).json({ deleted: false, id: normalized, reason: "not_found" });
//     }

//     console.info(`🗑️  [DB DEL] researcherProfiles:${normalized}`);
//     return res.status(200).json({
//       deleted: true,
//       id: normalized,
//       message: "Profile deleted from DB successfully"
//     });
//   } catch (err) {
//     console.error("Error in deleteFromDatabase:", err);
//     next(err);
//   }
// }

module.exports = {
  searchOpenalexFilters: exports.searchOpenalexFilters
  // saveToDatabase,
  // deleteFromDatabase
};
