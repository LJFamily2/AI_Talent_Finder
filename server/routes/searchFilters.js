const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/searchFiltersController');

// 1. Search by topic
router.get('/by-topic', ctrl.searchByTopic);

// 2. Search by country code
router.get('/by-country', ctrl.searchByCountry);

// 3. Search by h-index
router.get('/by-hindex', ctrl.searchByHIndex);

// 4. Search by i10-index
router.get('/by-i10index', ctrl.searchByI10Index);


// // 5. Only with ORCID
// router.get('/with-orcid', ctrl.searchWithOrcid);

// // 6. Only with Scopus
// router.get('/with-scopus', ctrl.searchWithScopus);

// // 7. Only authors with OpenAlex ID
// router.get("/with-openalex", ctrl.searchWithOpenAlex);

// Search by any one of ORCID, Scopus or OpenAlex
// GET /api/search-filters/with-identifier?type=orcid|scopus|openalex
router.get("/with-identifier", ctrl.searchByIdentifier);


module.exports = router;