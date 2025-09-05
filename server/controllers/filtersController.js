const Country = require("../models/Country");
const Institution = require("../models/Institution");
const { foldString, toSafeRegex } = require("../utils/queryHelpers");

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

async function getInstitutionsFilter(req, res) {
    try {
        const q = (req.query.q || "").trim();
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
        const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

        if (q) {
            const qfold = foldString(q);
            const terms = qfold.split(/\s+/).filter(Boolean);

            // 1) Primary: full-name prefix matches (high priority)
            const primaryLimit = Math.min(limit, 10); // tuneable
            const primaryRegex = toSafeRegex(qfold, { anchor: true, flags: "" });
            let primaryDocs = await Institution.find({ display_name_folded: { $regex: primaryRegex } })
                .limit(primaryLimit)
                .select("_id display_name display_name_folded")
                .lean();

            // sort primary results by: earliest match (indexOf), then shorter name
            primaryDocs.sort((a, b) => {
                const ai = a.display_name_folded.indexOf(qfold);
                const bi = b.display_name_folded.indexOf(qfold);
                if (ai !== bi) return ai - bi;
                return a.display_name.length - b.display_name.length;
            });

            const primaryIds = primaryDocs.map(d => d._id);

            // 2) Secondary: token-AND matches to fill the rest (excludes primary results)
            let results = primaryDocs;
            if (results.length < limit) {
                const tokenConditions = terms.map(t => ({ display_name_tokens: { $regex: toSafeRegex(t, { anchor: true, flags: "" }) } }));
                const remaining = limit - results.length;
                const tokenDocs = await Institution.find({ $and: tokenConditions, _id: { $nin: primaryIds } })
                    .sort({ display_name_folded: 1 })
                    .limit(remaining)
                    .select("_id display_name")
                    .lean();
                results = results.concat(tokenDocs);
            }

            // strip fold field if present
            results = results.map(r => ({ _id: r._id, display_name: r.display_name }));

            return res.json({ institutions: results });
        }

        // browse (no q)
        const docs = await Institution.find()
            .sort({ display_name_folded: 1 })
            .skip(offset)
            .limit(limit)
            .select("_id display_name")
            .lean();
        return res.json({ institutions: docs });
    } catch (error) {
        console.error("getInstitutionsFilter error:", error);
        return res.status(500).json({ error: "Failed to fetch institutions" });
    }
}

module.exports = {
    getCountriesFilter,
    getInstitutionsFilter
}