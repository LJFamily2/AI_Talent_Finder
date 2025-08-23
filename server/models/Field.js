const mongoose = require("mongoose");

const FieldSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  display_name: { type: String, required: true }
}, {
  timestamps: true,
  versionKey: false
});

module.exports = mongoose.model("Field", FieldSchema);
