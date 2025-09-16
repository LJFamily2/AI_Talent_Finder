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
    slug: { type: String, unique: true, sparse: true },

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

ResearcherSchema.index({ name: 1 });
ResearcherSchema.index({ slug: 1 });
// Speed up search by tags (multikey index)
ResearcherSchema.index({ search_tags: 1 });
ResearcherSchema.index({ "research_metrics.h_index": 1 });
ResearcherSchema.index({ "research_metrics.i10_index": 1 });
ResearcherSchema.index({ "research_metrics.total_citations": 1 });
ResearcherSchema.index({ "research_metrics.total_works": 1 });

// Generate unique slug before saving
ResearcherSchema.pre("save", async function (next) {
  if (this.isNew || this.isModified("name")) {
    if (this.name && this.name.trim() !== "") {
      // Inline slug generation
      const generateSlug = (name) => {
        if (!name) return "";
        return name
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, "") // Remove special characters except hyphens
          .replace(/\s+/g, "-") // Replace spaces with hyphens
          .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
          .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
      };

      let baseSlug = generateSlug(this.name);
      let slug = baseSlug;
      let counter = 1;

      // Check for existing slugs and make it unique
      while (true) {
        const existingResearcher = await this.constructor.findOne({
          slug,
          _id: { $ne: this._id },
        });
        if (!existingResearcher) {
          this.slug = slug;
          break;
        }
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
    }
  }
  next();
});

module.exports = mongoose.model("Researcher", ResearcherSchema);
