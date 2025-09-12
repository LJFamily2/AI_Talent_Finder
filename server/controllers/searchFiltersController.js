const mongoose = require("mongoose");
const Researcher = require("../models/Researcher");
const Field = require("../models/Field");
const Institution = require("../models/Institution");
const Country = require("../models/Country");

const { buildComparison, parseYearBounds, inYearRange } = require("../utils/queryHelpers");

// -----------------------------
// Enrich fields (from search_tags) - returns map _id => display_name
// -----------------------------
async function enrichFields(fieldIds) {
  const fields = await Field.find({ _id: { $in: fieldIds } }, { display_name: 1 }).lean();
  return Object.fromEntries(fields.map(f => [f._id, f.display_name]));
}

// -----------------------------
// Compute matched/unmatched filters
// -----------------------------
function computeMatch(selectedFilters, researcherTags, maps) {
  const matched = [];
  const unmatched = [];
  const { fieldMap, topicMap, instMap, countryMap } = maps;

  selectedFilters.forEach(tag => {
    const [type, id] = tag.split(":");
    const displayName = (() => {
      switch (type) {
        case "field": return fieldMap[id] || id;
        case "topic": return topicMap[id] || id;
        case "institution": return instMap[id] || id;
        case "country": return countryMap[id] || id;
        default: return id;
      }
    })();

    if (researcherTags.includes(tag)) matched.push(displayName);
    else unmatched.push(displayName);
  });

  return {
    matched,
    unmatched,
    matchCount: matched.length,
    totalFilters: selectedFilters.length
  };
}

// -----------------------------
// Controller: searchResearchers
// -----------------------------
exports.searchResearchers = async (req, res) => {
  try {
    const {
      search_tags = [],
      h_index,
      i10_index,
      researcher_name,
      sort_field = "match_count",
      sort_order = "desc",
      page = 1,
      limit = 20,
      year_from,
      year_to
    } = req.body;

    const matchStage = {};

    // -----------------------------
    // Build query filters
    // -----------------------------
    if (search_tags.length > 0) matchStage.search_tags = { $in: search_tags };
    if (h_index) matchStage["research_metrics.h_index"] = buildComparison(h_index);
    if (i10_index) matchStage["research_metrics.i10_index"] = buildComparison(i10_index);
    if (researcher_name) matchStage.name = { $regex: researcher_name, $options: "i" };

    // -----------------------------
    // Year range for affiliations
    // -----------------------------
    const { from: yFrom, to: yTo } = parseYearBounds(year_from, year_to);
    if (yFrom != null || yTo != null) {
      matchStage.affiliations = {
        $elemMatch: {
          years: { $exists: true, $not: { $size: 0 } }
        }
      };
    }

    const skip = (page - 1) * limit;
    const order = sort_order === "asc" ? 1 : -1;

    // -----------------------------
    // Aggregation pipeline
    // -----------------------------
    const pipeline = [
      { $match: matchStage },

      // Lookup topics
      {
        $lookup: {
          from: "topics",
          localField: "topics",
          foreignField: "_id",
          as: "topics"
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          search_tags: 1,
          affiliations: 1,
          last_known_affiliations: 1,
          research_metrics: 1,
          topics: 1
        }
      },

      // Filter affiliations by year range if provided
      ...(yFrom != null || yTo != null
        ? [{
          $addFields: {
            affiliations: {
              $filter: {
                input: "$affiliations",
                as: "aff",
                cond: {
                  $function: {
                    body: function (years, from, to) {
                      if (!Array.isArray(years) || years.length === 0) return false;
                      from = from != null ? from : to;
                      to = to != null ? to : from;
                      return years.some(y => y >= from && y <= to);
                    },
                    args: ["$$aff.years", yFrom, yTo],
                    lang: "js"
                  }
                }
              }
            }
          }
        }] : []),

      // Add a field for matchCount (number of selected filters matched)
      {
        $addFields: {
          matchCount: {
            $size: {
              $filter: {
                input: "$search_tags",
                as: "tag",
                cond: { $in: ["$$tag", search_tags] }
              }
            }
          }
        }
      },

      // Sort
      {
        $sort:
          sort_field === "match_count"
            ? { matchCount: order }
            : sort_field === "name"
              ? { name: order }
              : { [`research_metrics.${sort_field}`]: order }
      },

      // Pagination
      { $skip: skip },
      { $limit: limit }
    ];

    let researchers = await Researcher.aggregate(pipeline).allowDiskUse(true).exec();

    // -----------------------------
    // Enrich fields from search_tags
    // -----------------------------
    const allFieldIds = [...new Set(
      researchers.flatMap(r =>
        r.search_tags.filter(tag => tag.startsWith("field:")).map(tag => tag.split(":")[1])
      )
    )];
    const fieldMap = await enrichFields(allFieldIds);

    // -----------------------------
    // Enrich last_known affiliations and other display names
    // -----------------------------
    const allInstIds = [...new Set(researchers.flatMap(r => r.last_known_affiliations))];
    const allCountries = [...new Set(
      researchers.flatMap(r =>
        r.search_tags.filter(tag => tag.startsWith("country:")).map(tag => tag.split(":")[1])
      )
    )];

    const [institutions, countries] = await Promise.all([
      Institution.find({ _id: { $in: allInstIds } }, { display_name: 1 }).lean(),
      Country.find({ _id: { $in: allCountries } }, { display_name: 1 }).lean()
    ]);

    const instMap = Object.fromEntries(institutions.map(i => [i._id, i.display_name]));
    const countryMap = Object.fromEntries(countries.map(c => [c._id, c.display_name]));

    // For topics, we already have display_name from $lookup
    const topicMap = Object.fromEntries(
      researchers.flatMap(r => r.topics.map(t => [t._id, t.display_name]))
    );

    // -----------------------------
    // Compute matched/unmatched and final formatting
    // -----------------------------
    researchers = researchers.map(r => {
      const { matched, unmatched, matchCount, totalFilters } =
        computeMatch(search_tags, r.search_tags, { fieldMap, topicMap, instMap, countryMap });

      return {
        _id: r._id,
        name: r.name,
        fields: r.search_tags
          .filter(tag => tag.startsWith("field:"))
          .map(tag => fieldMap[tag.split(":")[1]]),
        topics: r.topics.map(t => t.display_name),
        last_known_affiliations: r.last_known_affiliations.map(id => instMap[id]),
        research_metrics: {
          h_index: r.research_metrics.h_index,
          i10_index: r.research_metrics.i10_index,
          total_citations: r.research_metrics.total_citations,
          total_works: r.research_metrics.total_works
        },
        match: {
          matched,
          unmatched,
          matchCount,
          totalFilters
        }
      };
    });

    // -----------------------------
    // Get total count for pagination
    // -----------------------------
    const total = await Researcher.countDocuments(matchStage);

    res.json({
      total,
      page,
      totalPages: Math.ceil(total / limit),
      totalResearchers: researchers.length,
      researchers
    });

  } catch (error) {
    console.error("Error in searchResearchers aggregation:", error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { searchResearchers: exports.searchResearchers };
