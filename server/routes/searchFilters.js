const express = require('express');
const { cache: cacheRedisInsight } = require('../middleware/cacheRedisInsight');
const ctrl = require('../controllers/searchFiltersController');

const router = express.Router();
const LONG = 3600;

// ─── 1) SEARCH BY TOPIC ──────────────────────────────────────────────
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

// ─── 2) SEARCH BY COUNTRY ────────────────────────────────────────────
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

// ─── 3) SEARCH BY H-INDEX ────────────────────────────────────────────
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

// ─── 4) SEARCH BY I10-INDEX ──────────────────────────────────────────
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

// ─── 5) SEARCH BY IDENTIFIER ─────────────────────────────────────────
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

// ─── 6) MULTI-FILTER SEARCH FROM DB ─────────────────────────────────
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

// ─── 7) MULTI-FILTER SEARCH FROM OPENALEX ───────────────────────────
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

module.exports = router;
