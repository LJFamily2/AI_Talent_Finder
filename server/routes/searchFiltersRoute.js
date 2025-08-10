//==================================================================
// Express Router: Search Filters API
// Connects filter-based routes to controller logic, with Redis caching
// Each route uses cacheRedisInsight middleware to auto-cache responses
//==================================================================

const express = require('express');
const { cache: cacheRedisInsight } = require('../middleware/cacheRedisInsight');
const ctrl = require('../controllers/searchFiltersController');

const router = express.Router();
const SHORT = 900;   // 15 minutes TTL for cached search results
const MEDIUM = 1800; // 30 minutes TTL for cached search results
const LONG = 3600;   // 1 hour TTL for cached search results

//==================================================================
// 8) Multi-filter search in MongoDB
// Combines all filters: topic, country, hindex, i10index, identifier,
// affiliation, year_from, year_to
//==================================================================
router.get(
  '/search',
  cacheRedisInsight(MEDIUM, req => {
    const key = ['searchFilters'];
    const filterParams = [
      'country',
      'topic',
      'hindex',
      'i10index',
      'identifier',
      'affiliation',
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
    key.push(`page=${req.query.page || 1}`, `limit=${req.query.limit || 20}`);
    return key;
  }),
  ctrl.searchFilters
);

//==================================================================
// 9) Multi-filter search from OpenAlex API
// Retrieves live data and applies same filter set
//==================================================================
router.get(
  '/openalex',
  cacheRedisInsight(SHORT, req => {
    const key = ['openalexFilters'];
    const filterParams = [
      'country',
      'topic',
      'hindex',
      'i10index',
      'identifier',
      'affiliation',
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
    key.push(`page=${req.query.page || 1}`, `limit=${req.query.limit || 20}`);
    return key;
  }),
  ctrl.searchOpenalexFilters
);

//==================================================================
// Export the router
//==================================================================
module.exports = router;
