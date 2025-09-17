const mongoose = require("mongoose");
const Researcher = require("../models/Researcher");
const Field = require("../models/Field");
const Institution = require("../models/Institution");
const Country = require("../models/Country");
const Topic = require("../models/Topic");

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
      // allow fallback to `name` in case clients send it
      name: nameRaw,
      sort_field = "match_count",
      sort_order = "desc",
      require_full_match = false,
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
    // Name filter (supports `researcher_name` or `name` key)
    const nameFilter = (typeof researcher_name === 'string' && researcher_name.trim())
      || (typeof nameRaw === 'string' && nameRaw.trim())
      || '';
    if (nameFilter) {
      // Escape regex and anchor to start for better selectivity
      const escaped = String(nameFilter).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      matchStage.name = { $regex: `^${escaped}`, $options: "i" };
    }

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
    const filterCount = search_tags.length;

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
          slug: 1,
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

      // If require_full_match is set, only keep researchers matching all selected tags
      ...(require_full_match && filterCount > 0 ? [{ $match: { matchCount: filterCount } }] : []),

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
    // Build display-name maps for all selected filters and result data
    // -----------------------------
    // IDs from results
    const allFieldIdsFromResults = [...new Set(
      researchers.flatMap(r =>
        r.search_tags.filter(tag => tag.startsWith("field:")).map(tag => tag.split(":")[1])
      )
    )];
    const allInstIdsFromResults = [...new Set(researchers.flatMap(r => r.last_known_affiliations))];
    const allCountryIdsFromResults = [...new Set(
      researchers.flatMap(r =>
        r.search_tags.filter(tag => tag.startsWith("country:")).map(tag => tag.split(":")[1])
      )
    )];

    // IDs from selected filters (req.body.search_tags)
    const selectedFieldIds = new Set(search_tags.filter(t => t.startsWith('field:')).map(t => t.split(':')[1]));
    const selectedTopicIds = new Set(search_tags.filter(t => t.startsWith('topic:')).map(t => t.split(':')[1]));
    const selectedInstIds = new Set(search_tags.filter(t => t.startsWith('institution:')).map(t => t.split(':')[1]));
    const selectedCountryIds = new Set(search_tags.filter(t => t.startsWith('country:')).map(t => t.split(':')[1]));

    // Union sets for fetching
    const fieldIdsForMap = [...new Set([...allFieldIdsFromResults, ...selectedFieldIds])];
    const instIdsForMap = [...new Set([...allInstIdsFromResults, ...selectedInstIds])];
    const countryIdsForMap = [...new Set([...allCountryIdsFromResults, ...selectedCountryIds])];
    const topicIdsForMap = [...selectedTopicIds]; // topics from results already via $lookup below

    // Fetch display names
    const [fieldMapRaw, institutions, countries, selectedTopics] = await Promise.all([
      enrichFields(fieldIdsForMap),
      Institution.find({ _id: { $in: instIdsForMap } }, { display_name: 1 }).lean(),
      Country.find({ _id: { $in: countryIdsForMap } }, { display_name: 1 }).lean(),
      topicIdsForMap.length ? Topic.find({ _id: { $in: topicIdsForMap } }, { display_name: 1 }).lean() : Promise.resolve([])
    ]);

    const fieldMap = fieldMapRaw || {};
    const instMap = Object.fromEntries((institutions || []).map(i => [String(i._id), i.display_name]));
    const countryMap = Object.fromEntries((countries || []).map(c => [String(c._id), c.display_name]));

    // Topics: from aggregation lookup (for results) + selected topics
    const topicMap = Object.fromEntries([
      ...researchers.flatMap(r => r.topics.map(t => [String(t._id), t.display_name])),
      ...(selectedTopics || []).map(t => [String(t._id), t.display_name])
    ]);

    // -----------------------------
    // Compute matched/unmatched and final formatting
    // -----------------------------
    researchers = researchers.map(r => {
      const { matched, unmatched, matchCount, totalFilters } =
        computeMatch(search_tags, r.search_tags, { fieldMap, topicMap, instMap, countryMap });

      return {
        _id: r._id,
        slug: r.slug || "",
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
    let total;
    if (require_full_match && filterCount > 0) {
      const countPipeline = [
        { $match: matchStage },
        // Apply year range filter if any (same logic as main pipeline)
        ...((yFrom != null || yTo != null) ? [{
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
        { $match: { matchCount: filterCount } },
        { $count: 'total' }
      ];
      const countRes = await Researcher.aggregate(countPipeline).exec();
      total = (countRes && countRes[0] && countRes[0].total) ? countRes[0].total : 0;
    } else {
      total = await Researcher.countDocuments(matchStage);
    }

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
