const mongoose = require("mongoose");

const InstitutionSchema = new mongoose.Schema({
    display_name: { type: String, required: true },
    ror: { type: String, default: "" },
    country_code: { type: String, ref: "Country", required: true }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model("Institution", InstitutionSchema);
