const express = require('express');
const router = express.Router();
const ResearcherProfile = require('../models/researcherProfileModel'); // <-- import the model

// GET /api/researchers
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const maxResults = 20;
    const skip = (page - 1) * limit;

    const docs = await ResearcherProfile
      .find({})
      .limit(Math.min(limit, maxResults - skip))
      .skip(skip)
      .exec();

    const totalDocs = await ResearcherProfile.countDocuments({});
    const total = Math.min(totalDocs, maxResults);

    const peopleList = docs.map(doc => ({
      id: doc._id || '',
      name: doc.basic_info?.name || '',
      institution: Array.isArray(doc.current_affiliations)
        ? doc.current_affiliations.map(aff => aff.display_name).filter(Boolean).join(', ')
        : '',
      hIndex: doc.research_metrics?.h_index || 0,
      i10Index: doc.research_metrics?.i10_index || 0,
      field: Array.isArray(doc.research_areas?.fields) && doc.research_areas.fields.length > 0
        ? doc.research_areas.fields.map(f => f.display_name).join(', ')
        : '',
      score: doc.research_metrics?.total_citations || 0
    }));

    res.json({
      peopleList,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('API /api/researchers error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
