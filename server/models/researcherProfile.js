<<<<<<< Updated upstream
const mongoose = require('mongoose');
=======
//==================================================================
// Subschemas for Embedded Fields
//==================================================================

const mongoose = require("mongoose");

// Institution-level Affiliation Schema
const AffiliationSchema = new mongoose.Schema({
  institution: {
    display_name: { type: String, default: "" },
    ror:          { type: String, default: "" },
    id:           { type: String, default: "" },
    country_code: { type: String, default: "" }
  },
  years: [Number]
}, { _id: false });

// External Identifier Schema (OpenAlex, ORCID, etc.)
const IdentifierSchema = new mongoose.Schema({
  scopus:            { type: String, default: "" },
  openalex:          { type: String, default: "" },
  orcid:             { type: String, default: "" },
  google_scholar_id: { type: String, default: "" }
}, { _id: false });

// Research Metric Schema (H-index, total citations...)
const MetricsSchema = new mongoose.Schema({
  h_index:                 { type: Number, default: 0 },
  i10_index:               { type: Number, default: 0 },
  two_year_mean_citedness: { type: Number, default: 0 },
  total_citations:         { type: Number, default: 0 },
  total_works:             { type: Number, default: 0 }
}, { _id: false });

// Concept Schema used for both fields and topics
const ConceptSchema = new mongoose.Schema({
  display_name: { type: String, default: "" },
  count:        { type: Number, default: 0 }
}, { _id: false });

// Citation history trends
const CitationTrendSchema = new mongoose.Schema({
  cited_by_table: { type: Array, default: [] },
  counts_by_year: { type: Array, default: [] }
}, { _id: false });

// Most recent known affiliation
const CurrentAffSchema = new mongoose.Schema({
  institution:   { type: String, default: "" },
  display_name:  { type: String, default: "" },
  ror:           { type: String, default: "" },
  country_code:  { type: String, default: "" }
}, { _id: false });

//==================================================================
// Main Researcher Profile Schema
//==================================================================

const ResearcherProfileSchema = new mongoose.Schema({
  _id: { type: String }, // Use OpenAlex author ID as primary key
>>>>>>> Stashed changes

const researcherProfileSchema = new mongoose.Schema({
  basic_info: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    thumbnail: { type: String },
    affiliations: [{
      institution: {
        display_name: { type: String },
        years: { type: String },
        ror: { type: String }
      }
    }]
  },
  identifiers: {
    openalex: { type: String },
    orcid: { type: String },
    google_scholar_id: { type: String }
  },
  research_metrics: {
    h_index: { type: Number },
    i10_index: { type: Number },
    two_year_mean_citedness: { type: Number },
    total_citations: { type: Number },
    total_works: { type: Number }
  },
  research_areas: {
    fields: [{ display_name: { type: String } }],
    topics: [{
      display_name: { type: String },
      count: { type: Number }
    }]
  },
  works: [{
    workID: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Publication' }]
  }],
  citation_trends: {
    cited_by_table: mongoose.Schema.Types.Mixed,
    cited_by_graph: mongoose.Schema.Types.Mixed,
    counts_by_year: [{
      year: { type: Number },
      works_count: { type: Number },
      cited_by_count: { type: Number }
    }]
  },
  current_affiliation: {
    institution: { type: String },
    display_name: { type: String },
    ror: { type: String }
  }
}, { timestamps: true });

module.exports = mongoose.model("ResearcherProfile", researcherProfileSchema);