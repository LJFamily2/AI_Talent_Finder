const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const institutionSchema = new mongoose.Schema({
  display_name: String,
  ror: String,
  years: [Number],
  id: String,
  country_code: String,
  type: String,
  lineage: [String]
}, { _id: false });

const researcherProfileSchema = new mongoose.Schema({
  basic_info: {
    name: { type: String, required: true },                     // OpenAlex & Scopus
    email: { type: String, required: true },                    // Google Scholar
    thumbnail: { type: String },                                // Google Scholar
    affiliations: [{
      institution: institutionSchema
    }]
  },
  identifiers: {
    scopus: { type: String },                                   // Scopus
    openalex: { type: String },                                 // OpenAlex
    orcid: { type: String },                                    // OpenAlex
    google_scholar_id: { type: String }                         // Google Scholar
  },
  research_metrics: {
    h_index: { type: Number },                                  // All 3 sources
    i10_index: { type: Number },                                // Google Scholar & OpenAlex
    two_year_mean_citedness: { type: Number },                  // OpenAlex
    total_citations: { type: Number },                          // All 3 sources
    total_works: { type: Number }                               // All 3 sources
  },
  research_areas: {
    fields: [{
      display_name: { type: String }                            // OpenAlex: topic.field.display_name
    }],
    topics: [{
      display_name: { type: String },                           // topic.display_name
      count: { type: Number }                                   // topic.count
    }]
  },
  works: [{
    workID: [ObjectId]                                          // References to Publication documents
  }],
  citation_trends: {
    cited_by_table: { type: mongoose.Schema.Types.Mixed },      // OpenAlex/Google Scholar/Scopus
    cited_by_graph: { type: mongoose.Schema.Types.Mixed },      // OpenAlex
    counts_by_year: [{
      year: { type: Number },
      works_count: { type: Number },                            // OpenAlex
      cited_by_count: { type: Number }
    }]
  },
  current_affiliation: {
    institution: { type: String },                              // OpenAlex
    display_name: { type: String },
    ror: { type: String }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("ResearcherProfile", researcherProfileSchema);
