// server/routes/searchFilters.js

const express = require('express');
const cache   = require('../middleware/cache');
const ctrl    = require('../controllers/searchFiltersController');

const router = express.Router();

// Cache TTLs (seconds)
const SHORT  = 60;    // 1 minute
const MEDIUM = 300;   // 5 minutes
const LONG   = 3600;  // 1 hour

// ─── GET ENDPOINTS ─────────────────────────────────────────────────────────────

/**
 * GET /api/search-filters/by-topic?topic=<string>
 */
router.get(
  '/by-topic',
  cache(MEDIUM, req => `search:topic:${(req.query.topic||'').toLowerCase()}`),
  ctrl.searchByTopic
);

/**
 * GET /api/search-filters/by-country?country=<string>
 */
router.get(
  '/by-country',
  cache(LONG, req => `search:country:${(req.query.country||'').toUpperCase()}`),
  ctrl.searchByCountry
);

/**
 * GET /api/search-filters/by-hindex?hindex=<int>&op=<gte|lte|eq>
 */
router.get(
  '/by-hindex',
  cache(MEDIUM, req => `search:hindex:${req.query.op||'eq'}:${req.query.hindex||''}`),
  ctrl.searchByHIndex
);

/**
 * GET /api/search-filters/by-i10index?i10index=<int>&op=<gte|lte|eq>
 */
router.get(
  '/by-i10index',
  cache(MEDIUM, req => `search:i10index:${req.query.op||'eq'}:${req.query.i10index||''}`),
  ctrl.searchByI10Index
);

/**
 * GET /api/search-filters/with-identifier?type=orcid|scopus|openalex|google_scholar_id
 */
router.get(
  '/with-identifier',
  cache(LONG, req => `search:identifier:${req.query.type||''}`),
  ctrl.searchByIdentifier
);

// ─── POST ENDPOINTS ────────────────────────────────────────────────────────────

/**
 * POST /api/search-filters/by-topic
 * body: { topic: string }
 */
router.post(
  '/by-topic',
  cache(MEDIUM, req => `search:topic:${(req.body.topic||'').toLowerCase()}`),
  ctrl.searchByTopicPOST
);

/**
 * POST /api/search-filters/by-country
 * body: { country: string }
 */
router.post(
  '/by-country',
  cache(LONG, req => `search:country:${(req.body.country||'').toUpperCase()}`),
  ctrl.searchByCountryPOST
);

/**
 * POST /api/search-filters/by-hindex
 * body: { hindex: number, op: 'gte'|'lte'|'eq' }
 */
router.post(
  '/by-hindex',
  cache(MEDIUM, req => `search:hindex:${req.body.op||'eq'}:${req.body.hindex||''}`),
  ctrl.searchByHIndexPOST
);

/**
 * POST /api/search-filters/by-i10index
 * body: { i10index: number, op: 'gte'|'lte'|'eq' }
 */
router.post(
  '/by-i10index',
  cache(MEDIUM, req => `search:i10index:${req.body.op||'eq'}:${req.body.i10index||''}`),
  ctrl.searchByI10IndexPOST
);

/**
 * POST /api/search-filters/with-identifier
 * body: { type: 'orcid'|'scopus'|'openalex'|'google_scholar_id' }
 */
router.post(
  '/with-identifier',
  cache(LONG, req => `search:identifier:${req.body.type||''}`),
  ctrl.searchByIdentifierPOST
);

module.exports = router;
