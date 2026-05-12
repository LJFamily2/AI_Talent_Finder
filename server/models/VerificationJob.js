const mongoose = require("mongoose");

const VerificationJobSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    jobType: {
      type: String,
      enum: ["publication-check"],
      default: "publication-check",
      index: true,
    },
    prioritySource: {
      type: String,
      enum: ["googleScholar", "scopus", "openalex", "pubmed", "crossref"],
      default: "scopus",
    },
    originalFileName: {
      type: String,
      required: true,
    },
    storedFileName: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed"],
      default: "queued",
      index: true,
    },
    progress: {
      type: Number,
      default: 0,
    },
    stage: {
      type: String,
      default: "queued",
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    errorCode: {
      type: String,
      default: null,
    },
    retryable: {
      type: Boolean,
      default: false,
    },
    cancelRequested: {
      type: Boolean,
      default: false,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

VerificationJobSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("VerificationJob", VerificationJobSchema);
