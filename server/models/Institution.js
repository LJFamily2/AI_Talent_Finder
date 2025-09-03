const mongoose = require("mongoose");

function foldString(s = "") {
  try { return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  catch (e) { return (s || "").toLowerCase(); }
}

function tokenizeFolded(s = "") {
  return Array.from(new Set(
    String(s)
      .split(/[\s\W_]+/u)
      .map(t => t.trim())
      .filter(Boolean)
  ));
}

const InstitutionSchema = new mongoose.Schema({
  display_name: { type: String, required: true },
  display_name_folded: { type: String, index: true },
  display_name_tokens: { type: [String], index: true },
  ror: { type: String, default: "" },
  country_code: { type: String, ref: "Country", required: true }
}, {
  timestamps: true,
  versionKey: false
});

InstitutionSchema.pre("save", function(next) {
  if (this.display_name) {
    const folded = foldString(this.display_name);
    this.display_name_folded = folded;
    this.display_name_tokens = tokenizeFolded(folded);
  }
  next();
});

InstitutionSchema.pre("findOneAndUpdate", function(next) {
  const update = this.getUpdate() || {};
  const set = update.$set || update;
  if (set.display_name) {
    const folded = foldString(set.display_name);
    if (!update.$set) update.$set = {};
    update.$set.display_name_folded = folded;
    update.$set.display_name_tokens = tokenizeFolded(folded);
    this.setUpdate(update);
  }
  next();
});

module.exports = mongoose.model("Institution", InstitutionSchema);
