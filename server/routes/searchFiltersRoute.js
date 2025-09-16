// routes/searchFiltersRoute.js
const express = require('express');
const crypto = require('crypto')
const { cache: cacheRedisInsight } = require('../middleware/cacheRedisInsight');
// const filtersCtrl = require('../controllers/searchFiltersController'); 
const searchCtrl = require('../controllers/searchFiltersController');
const authorCtrl = require('../controllers/authorController');
const { getCountriesFilter, getInstitutionsFilter, getInstitutionsCount, getAllFields, getTopicsForField, suggestResearchersByName, searchTopicsAutocomplete } = require('../controllers/filtersController');

const router = express.Router();
const SHORT = 900;
const MEDIUM = 1800;
const LONG = 3600;

// Helper to generate a cache key from the JSON body
function generateCacheKey(body) {
  if (!body || (typeof body === "object" && Object.keys(body).length === 0)) {
    return "searchResearchers:empty";
  }

  // Stable stringify that sorts keys recursively so order doesn't change the hash
  function stableStringify(obj) {
    if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
    if (Array.isArray(obj)) return "[" + obj.map(stableStringify).join(",") + "]";
    const keys = Object.keys(obj).sort();
    return "{" + keys.map(k => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
  }

  const bodyStr = stableStringify(body);
  return "searchResearchers:" + crypto.createHash("md5").update(bodyStr).digest("hex");
}

// POST /api/search-researchers
// router.post(
//   '/search',
//   cacheRedisInsight(MEDIUM, req => {
//     return generateCacheKey(req.body);
//   }),
//   searchCtrl.searchResearchers
// );
router.post('/search', /* cacheRedisInsight(MEDIUM, req => generateCacheKey(req.body)), */ searchCtrl.searchResearchers);


// =================== OpenAlex search ===================
router.get(
  '/openalex',
  cacheRedisInsight(SHORT, req => {
    // ✅ special-case id để cache theo researcherProfiles
    if (req.query.id) {
      const idOnly = String(req.query.id).split('/').pop();
      return ['researcherProfiles', idOnly];
    }

    const key = ['fetchLists'];
    const filterParams = [
      'name', 'country', 'topic', 'hindex', 'i10index',
      'op', 'op_hindex', 'op_i10',
      'identifier', 'affiliation', 'year_from', 'year_to'
      // id will not be included here, as it is only for DB search
    ];
    filterParams.forEach(k => {
      if (req.query[k]) {
        const raw = req.query[k];
        const val = typeof raw === 'string' ? raw.toLowerCase() : raw;
        key.push(`${k}=${val}`);
      }
    });
    key.push(`page=${req.query.page || 1}`, `limit=${req.query.limit || 20}`);
    return key;
  }),
  authorCtrl.searchOpenalexFilters
);

//========================
// build filters functions
//========================

router.get("/countries", getCountriesFilter);
router.get("/institutions", getInstitutionsFilter);
router.get("/institutions/count", getInstitutionsCount);

// new: return small list of all fields
router.get("/fields", getAllFields);

// get topics for a single field (fieldId = "null" for uncategorized)
router.get("/fields/:fieldId/topics", getTopicsForField);

// researcher name suggestions
router.get("/researchers/names", suggestResearchersByName);

// topics autocomplete suggestions
router.get("/topics", searchTopicsAutocomplete);

module.exports = router;
