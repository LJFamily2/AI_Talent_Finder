const mongoose = require('mongoose');

const publicationSchema = new mongoose.Schema({
  // Core Identification Fields
  id: {
    type: String,
    required: true,
    unique: true
  },
  doi: {
    type: String
  },
  title: {
    type: String,
    required: true
  },
  url: {
    type: String
  },
  link: {
    type: String
  },

  // Publication Details
  publication_date: {
    type: Date
  },
  journal_name: {
    type: String
  },
  volume: {
    type: String
  },
  issue: {
    type: String
  },
  page_range: {
    type: String
  },
  article_number: {
    type: String
  },
  publication_type: {
    type: String
  },
  language: {
    type: String
  },
  eissn: {
    type: String
  },
  issn: {
    type: String
  },

  // Author Information
  authors: [{
    name: {
      type: String
    },
    id: {
      type: String
    },
    affiliation: {
      type: String
    },
    orcid: {
      type: String
    }
  }],

  // Content & Abstract
  abstract: {
    type: String
  },
  topics: [{
    id: {
      type: String
    },
    display_name: {
      type: String
    },
    score: {
      type: Number
    }
  }],

  // Metrics & Impact
  cited_by_count: {
    type: Number,
    default: 0
  },
  citation_percentile: {
    type: Number
  },
  open_access_status: {
    type: String,
    enum: ['gold', 'green', 'bronze', 'hybrid', 'closed']
  },
  fwci: {
    type: Number
  },

  // API Source Tracking
  source_api: {
    type: String
  },
  external_ids: {
    openalex: {
      type: String
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Publication', publicationSchema);
