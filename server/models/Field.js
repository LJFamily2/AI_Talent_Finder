const mongoose = require("mongoose");

const FieldSchema = new mongoose.Schema({
  display_name: { type: String, required: true }
}, {
  timestamps: true,
  versionKey: false
});

module.exports = mongoose.model("Field", FieldSchema);
