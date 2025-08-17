const mongoose = require("mongoose");

//==================================================================
// Bookmark Schema
//==================================================================

const BookmarkSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    researcherProfileIds: {
      type: [String],
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Create compound index to ensure user can't bookmark the same researcher twice
BookmarkSchema.index({ userId: 1, researcherProfileIds: 1 }, { unique: true });

//==================================================================
// Export Mongo Model
//==================================================================

module.exports = mongoose.model("Bookmark", BookmarkSchema);
