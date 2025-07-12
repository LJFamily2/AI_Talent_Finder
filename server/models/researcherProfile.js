// researcherProfile.js

const mongoose = require('mongoose');

const researcherProfileSchema = new mongoose.Schema({
  basic_info: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    thumbnail: {
      type: String
    },
    affiliations: [{
      institution: {
        display_name: { type: String },
        ror:          { type: String },
        id:           { type: String },
        country_code: { type: String },
        type:         { type: String },
        years:        [{ type: Number }],
        lineage:      [{ type: String }]
      }
    }]
  },

  // one-and-only works field
  works: [{
    type: mongoose.Schema.Types.ObjectId,
    ref:  'Publication'
  }],

  identifiers: {
    openalex:          { type: String },
    orcid:             { type: String },
    google_scholar_id: { type: String }
  },

  research_metrics: {
    h_index:               { type: Number },
    i10_index:             { type: Number },
    two_year_mean_citedness:{ type: Number },
    total_citations:       { type: Number },
    total_works:           { type: Number }
  },

  research_areas: {
    fields: [{ display_name: { type: String } }],
    topics: [{
      display_name: { type: String },
      count:        { type: Number }
    }]
  },

  citation_trends: {
    cited_by_table: mongoose.Schema.Types.Mixed,
    cited_by_graph: mongoose.Schema.Types.Mixed,
    counts_by_year: [{
      year:            { type: Number },
      works_count:     { type: Number },
      cited_by_count:  { type: Number }
    }]
  },

  current_affiliation: {
    institution:  { type: String },
    display_name: { type: String },
    ror:          { type: String }
  }

}, { timestamps: true });

module.exports = mongoose.model('ResearcherProfile', researcherProfileSchema);
