const mongoose = require('mongoose');

const publicationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },           // All sources
  doi: { type: String },                                        // All sources
  title: { type: String, required: true },

  // Publication Details
  publication_date: { type: Date },                             // All sources
  publicationLocation: { type: String },                        // host_organization_name (OpenAlex/Scopus/Scholar)
  volume: { type: String },                                     // OpenAlex & Scopus
  issue: { type: String },                                      // OpenAlex & Scopus
  page_range: { type: String },                                 // Scopus & OpenAlex
  article_number: { type: String },                             // Scopus
  publication_type: { type: String },                           // OpenAlex & Scopus
  eissn: { type: String },                                      // Scopus
  issn: { type: String },                                       // OpenAlex & Scopus

  // Author Information
  authors: [{ type: mongoose.Schema.Types.Mixed }],             // Mixed source parsing

  // Metrics & Impact
  cited_by_count: { type: Number, default: 0 },                 // OpenAlex
  citation_percentile: { type: Number },                        // citation_normalized_percentile (OpenAlex)
  open_access_status: { type: String },                         // OpenAlex
  fwci: { type: Number }                                        // OpenAlex
}, {
  timestamps: true
});

module.exports = mongoose.model("Publication", publicationSchema);
