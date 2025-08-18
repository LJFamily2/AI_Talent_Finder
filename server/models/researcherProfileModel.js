const mongoose = require("mongoose");

//==================================================================
// Subschemas for Embedded Fields
//==================================================================

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

// External Identifier Schema (OpenAlex)
const IdentifierSchema = new mongoose.Schema({
  openalex:          { type: String, default: "" },
  orcid:            { type: String, default: "" }
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

  basic_info: {
    name:         { type: String, default: "" },
    affiliations: [AffiliationSchema]
  },

  identifiers:      IdentifierSchema,
  research_metrics: MetricsSchema,

  research_areas: {
    fields: [ConceptSchema],  // updated to allow count like topics
    topics: [ConceptSchema]   // top 10 topics from OpenAlex by score
  },

  citation_trends:     CitationTrendSchema,
  current_affiliations: [CurrentAffSchema],
  current_affiliation: CurrentAffSchema    

}, {
  timestamps: true,
  versionKey: false
});

//==================================================================
// Export Mongo Model
//==================================================================

module.exports = mongoose.model("researcherprofiles", ResearcherProfileSchema);
