const mongoose = require("mongoose");

// Affiliation schema: include country_code to support filtering by country
const AffiliationSchema = new mongoose.Schema({
  institution: {
    display_name: { type: String, default: "" },
    ror:          { type: String, default: "" },
    id:           { type: String, default: "" },
    country_code: { type: String, default: "" }
  },
  years: [Number]
}, { _id: false });

const IdentifierSchema = new mongoose.Schema({
  scopus:            { type: String, default: "" },
  openalex:          { type: String, default: "" },
  orcid:             { type: String, default: "" },
  google_scholar_id: { type: String, default: "" }
}, { _id: false });

const MetricsSchema = new mongoose.Schema({
  h_index:                 { type: Number, default: 0 },
  i10_index:               { type: Number, default: 0 },
  two_year_mean_citedness: { type: Number, default: 0 },
  total_citations:         { type: Number, default: 0 },
  total_works:             { type: Number, default: 0 }
}, { _id: false });

const ConceptSchema = new mongoose.Schema({
  display_name: { type: String, default: "" },
  count:        { type: Number }
}, { _id: false });

const CitationTrendSchema = new mongoose.Schema({
  cited_by_table: { type: Array,   default: [] },
  counts_by_year: { type: Array,   default: [] }
}, { _id: false });

const CurrentAffSchema = new mongoose.Schema({
  institution:  { type: String, default: "" },
  display_name: { type: String, default: "" },
  ror:          { type: String, default: "" }
}, { _id: false });

const ResearcherProfileSchema = new mongoose.Schema({
  _id:               String,  // use OpenAlex author ID as the Mongo _id
  basic_info: {
    name:         { type: String, default: "" },
    affiliations: [AffiliationSchema]
  },
  identifiers:       IdentifierSchema,
  research_metrics:  MetricsSchema,
  research_areas: {
    fields: [new mongoose.Schema({ display_name: String }, { _id: false })],
    topics: [ConceptSchema]
  },
  citation_trends:    CitationTrendSchema,
  current_affiliation: CurrentAffSchema
}, {
  timestamps: true,
  versionKey: false
});

module.exports = mongoose.model("ResearcherProfile", ResearcherProfileSchema);
