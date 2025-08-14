// routes/searchFiltersRoute.js
const express = require('express');
const { cache: cacheRedisInsight } = require('../middleware/cacheRedisInsight');
const filtersCtrl = require('../controllers/searchFiltersController'); // chỉ còn DB search
const authorCtrl  = require('../controllers/authorController');       // chứa searchOpenalexFilters

const router = express.Router();
const SHORT = 900;
const MEDIUM = 1800;
const LONG = 3600;

// =================== DB search ===================
router.get(
  '/search',
  cacheRedisInsight(MEDIUM, req => {
    const { id } = req.query;
    const filterParams = [
      'name','country','topic','hindex','i10index',
      'op','op_hindex','op_i10',
      'identifier','affiliation','year_from','year_to'
    ];

    if (id) {
      const idOnly = String(id).split('/').pop();
      return ['researcherProfiles', idOnly];  // ✅ giữ bucket researcherProfiles
    }

    const key = ['searchLists'];
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
  filtersCtrl.searchFilters
);

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
      'name','country','topic','hindex','i10index',
      'op','op_hindex','op_i10',
      'identifier','affiliation','year_from','year_to'
      // (id không cần đưa vào đây nữa vì đã special-case ở trên)
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
  authorCtrl.searchOpenalexFilters   // ✅ dùng handler mới trong authorController
);

module.exports = router;
