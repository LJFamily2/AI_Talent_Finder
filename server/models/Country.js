const mongoose = require("mongoose");

const CountrySchema = new mongoose.Schema({
    _id: { type: String, required: true },
    name: { type: String, required: true },
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model("Country", CountrySchema);