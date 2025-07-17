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
// 4) Search by i10-index (with operator)
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
// 6) Multi-filter search in MongoDB
// Combines topic, country, hindex, i10index, and identifier
//==================================================================
router.get(
  '/multi',
  cacheRedisInsight(LONG, req => {
    const key = ['searchFilters'];
    for (const k of ['country', 'topic', 'hindex', 'i10index', 'identifier']) {
      if (req.query[k]) key.push(`${k}=${req.query[k].toLowerCase?.() || req.query[k]}`);
    }
    key.push(`page=${req.query.page || 1}`);
    key.push(`limit=${req.query.limit || 25}`);
    return key;
  }),
  ctrl.searchByMultipleFilters
);

//==================================================================
// 7) Multi-filter search from OpenAlex API
// Same filters as MongoDB version, retrieves live external data
//==================================================================
router.get(
  '/openalex',
  cacheRedisInsight(LONG, req => {
    const key = ['openalexFilters'];
    for (const k of ['country', 'topic', 'hindex', 'i10index', 'identifier']) {
      if (req.query[k]) key.push(`${k}=${req.query[k].toLowerCase?.() || req.query[k]}`);
    }
    key.push(`page=${req.query.page || 1}`);
    key.push(`limit=${req.query.limit || 25}`);
    return key;
  }),
  ctrl.searchOpenalexFilters
);

//==================================================================
// Export the router
//==================================================================
module.exports = router;