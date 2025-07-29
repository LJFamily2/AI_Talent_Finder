//==================================================================
// Express Router: Search Filters API
// Connects filter-based routes to controller logic, with Redis caching
// Each route uses cacheRedisInsight middleware to auto-cache responses
//==================================================================

const express = require('express');
const { cache: cacheRedisInsight } = require('../middleware/cacheRedisInsight');
const ctrl = require('../controllers/searchFiltersController');

const router = express.Router();
const LONG = 3600; // 1 hour TTL for cached search results

//==================================================================
// 1) Search by Topic
//==================================================================
router.get(
  '/by-topic',
  cacheRedisInsight(LONG, req => [
    'searchFilters',
    `topic=${(req.query.topic || '').toLowerCase()}`,
    `page=${req.query.page || 1}`,
    `limit=${req.query.limit || 25}`
  ]),
  ctrl.searchByTopic
);

//==================================================================
// 2) Search by Country Code (e.g., US, VN, GB)
//==================================================================
router.get(
  '/by-country',
  cacheRedisInsight(LONG, req => [
    'searchFilters',
    `country=${(req.query.country || '').toUpperCase()}`,
    `page=${req.query.page || 1}`,
    `limit=${req.query.limit || 25}`
  ]),
  ctrl.searchByCountry
);

//==================================================================
// 3) Search by h-index (with operator: eq, gte, lte)
//==================================================================
router.get(
  '/by-hindex',
  cacheRedisInsight(LONG, req => [
    'searchFilters',
    `hindex_op=${req.query.op || 'eq'}`,
    `hindex_val=${req.query.hindex || ''}`,
    `page=${req.query.page || 1}`,
    `limit=${req.query.limit || 25}`
  ]),
  ctrl.searchByHIndex
);

//==================================================================
// 4) Search by i10-index (with operator: eq, gte, lte)
//==================================================================
router.get(
  '/by-i10index',
  cacheRedisInsight(LONG, req => [
    'searchFilters',
    `i10_op=${req.query.op || 'eq'}`,
    `i10_val=${req.query.i10index || ''}`,
    `page=${req.query.page || 1}`,
    `limit=${req.query.limit || 25}`
  ]),
  ctrl.searchByI10Index
);

//==================================================================
// 5) Search by External Identifier (ORCID, SCOPUS, etc.)
//==================================================================
router.get(
  '/with-identifier',
  cacheRedisInsight(LONG, req => [
    'searchFilters',
    `identifier=${req.query.identifier || ''}`,
    `page=${req.query.page || 1}`,
    `limit=${req.query.limit || 25}`
  ]),
  ctrl.searchByIdentifier
);

//==================================================================
// 6) Search by Affiliation
//==================================================================
router.get(
  '/by-affiliation',
  cacheRedisInsight(LONG, req => [
    'searchFilters',
    `affiliation=${(req.query.affiliation || '').toLowerCase()}`,
    `page=${req.query.page || 1}`,
    `limit=${req.query.limit || 25}`
  ]),
  ctrl.searchByAffiliation
);

//==================================================================
// 7) Search by Current Affiliation
//==================================================================
router.get(
  '/by-current-affiliation',
  cacheRedisInsight(LONG, req => [
    'searchFilters',
    `current_affiliation=${(req.query.current_affiliation || '').toLowerCase()}`,
    `page=${req.query.page || 1}`,
    `limit=${req.query.limit || 25}`
  ]),
  ctrl.searchByCurrentAffiliation
);

//==================================================================
// 8) Search by Year Range
//==================================================================
router.get(
  '/by-year-range',
  cacheRedisInsight(LONG, req => [
    'searchFilters',
    req.query.year_from ? `year_from=${req.query.year_from}` : null,
    req.query.year_to ? `year_to=${req.query.year_to}` : null,
    `page=${req.query.page || 1}`,
    `limit=${req.query.limit || 25}`
  ].filter(Boolean)),
  ctrl.searchByYearRange
);

//==================================================================
// 9) Multi-filter search in MongoDB
// Combines all filters: topic, country, hindex, i10index, identifier,
// affiliation, current_affiliation, year_from, year_to
//==================================================================
router.get(
  '/multi',
  cacheRedisInsight(LONG, req => {
    const key = ['searchFilters'];
    const filterParams = [
      'country',
      'topic',
      'hindex',
      'i10index',
      'identifier',
      'affiliation',
      'current_affiliation',
      'year_from',
      'year_to'
    ];
    filterParams.forEach(k => {
      if (req.query[k]) {
        const raw = req.query[k];
        const val = typeof raw === 'string' ? raw.toLowerCase() : raw;
        key.push(`${k}=${val}`);
      }
    });
    key.push(`page=${req.query.page || 1}`, `limit=${req.query.limit || 25}`);
    return key;
  }),
  ctrl.searchByMultipleFilters
);

//==================================================================
// 10) Multi-filter search from OpenAlex API
// Retrieves live data and applies same filter set
//==================================================================
router.get(
  '/openalex',
  cacheRedisInsight(LONG, req => {
    const key = ['openalexFilters'];
    const filterParams = [
      'country',
      'topic',
      'hindex',
      'i10index',
      'identifier',
      'affiliation',
      'current_affiliation',
      'year_from',
      'year_to'
    ];
    filterParams.forEach(k => {
      if (req.query[k]) {
        const raw = req.query[k];
        const val = typeof raw === 'string' ? raw.toLowerCase() : raw;
        key.push(`${k}=${val}`);
      }
    });
    key.push(`page=${req.query.page || 1}`, `limit=${req.query.limit || 25}`);
    return key;
  }),
  ctrl.searchOpenalexFilters
);

//==================================================================
// Export the router
//==================================================================
module.exports = router;
