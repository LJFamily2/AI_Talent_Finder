const mongoose = require("mongoose");

// ------------------- Subschemas -------------------

const IdentifierSchema = new mongoose.Schema({
    openalex: { type: String, default: "" },
    orcid: { type: String, default: "" }
}, { _id: false });

const MetricsSchema = new mongoose.Schema({
    h_index: { type: Number, default: 0 },
    i10_index: { type: Number, default: 0 },
    two_year_mean_citedness: { type: Number, default: 0 },
    total_citations: { type: Number, default: 0 },
    total_works: { type: Number, default: 0 }
}, { _id: false });

const AffiliationSchema = new mongoose.Schema({
    institution_id: { type: String, ref: "Institution" },
    years: [Number]
}, { _id: false });

const CitationTrendSchema = new mongoose.Schema({
    year: { type: Number, default: 0 },
    works_count: { type: Number, default: 0 },
    cited_by_count: { type: Number, default: 0 }
}, { _id: false });

// ------------------- Main Schema -------------------

const ResearcherSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    name: { type: String, default: "" },

    identifiers: IdentifierSchema,
    research_metrics: MetricsSchema,

    affiliations: [AffiliationSchema],
    last_known_affiliations: [{ type: String, ref: "Institution" }],

    topics: [{ type: String, ref: "Topic" }],

    citation_trends: [CitationTrendSchema],

    searchTags: [{ type: String }],
    openalex_last_updated: { type: Date, default: null }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model("Researcher", ResearcherSchema);
