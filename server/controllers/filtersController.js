const axios = require("axios");
const Country = require("../models/Country")

// Get all countries to build filter
async function getCountriesFilter(req, res) {
    try {
        // fetch all countries, sorted by name
        const allCountries = await Country.find().sort({ name: 1 });
        return res.status(200).json({ allCountries });
    } catch (error) {
        console.error("getCountriesFilter error:", error);
        return res.status(500).json({ error: "Failed to fetch countries" });
    }
}

module.exports = {
    getCountriesFilter
}