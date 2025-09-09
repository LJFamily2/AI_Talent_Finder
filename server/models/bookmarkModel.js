const mongoose = require("mongoose");

//==================================================================
// Bookmark Schema (with Folders)
//==================================================================

const FolderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    researcherIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Researcher",
      },
    ],
  },
  { _id: false } // prevent auto _id for each folder subdocument
);

const BookmarkSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    folders: {
      type: [FolderSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

//==================================================================
// Export Mongo Model
//==================================================================

module.exports = mongoose.model("Bookmark", BookmarkSchema);
