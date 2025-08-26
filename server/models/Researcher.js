const mongoose = require("mongoose");

// ------------------- Subschemas -------------------

const IdentifierSchema = new mongoose.Schema(
  {
    openalex: { type: String, default: "" },
    orcid: { type: String, default: "" },
  },
  { _id: false }
);

const MetricsSchema = new mongoose.Schema(
  {
    h_index: { type: Number, default: 0 },
    i10_index: { type: Number, default: 0 },
    two_year_mean_citedness: { type: Number, default: 0 },
    total_citations: { type: Number, default: 0 },
    total_works: { type: Number, default: 0 },
  },
  { _id: false }
);

const AffiliationSchema = new mongoose.Schema(
  {
    institution: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
    },
    years: [Number],
  },
  { _id: false }
);

const CitationTrendSchema = new mongoose.Schema(
  {
    year: { type: Number, default: 0 },
    works_count: { type: Number, default: 0 },
    cited_by_count: { type: Number, default: 0 },
  },
  { _id: false }
);

// ------------------- Main Schema -------------------

const ResearcherSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },

    identifiers: IdentifierSchema,
    research_metrics: MetricsSchema,

    affiliations: [AffiliationSchema],
    last_known_affiliations: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Institution" },
    ],

    topics: [{ type: mongoose.Schema.Types.ObjectId, ref: "Topic" }],

    citation_trends: [CitationTrendSchema],

    search_tags: [{ type: String }],
    openalex_last_updated: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Researcher", ResearcherSchema);
