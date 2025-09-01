const Bookmark = require("../models/bookmarkModel");
const Researcher = require("../models/Researcher");
const Institution = require("../models/Institution");
const Topic = require("../models/Topic");

module.exports = {
  getBookmarks,
  addBookmarks,
  removeBookmark,
};

// Get all bookmarks for the authenticated user
async function getBookmarks(req, res) {
  try {
    const userId = req.user.id;

    // Find or create the user's bookmark document and populate all necessary data
    let bookmark = await Bookmark.findOne({ userId }).populate({
      path: "researcherIds",
      select:
        "name slug research_metrics last_known_affiliations topics affiliations identifiers citation_trends", // Include all fields needed for PDF
      populate: [
        {
          path: "last_known_affiliations",
          select: "display_name",
          model: "Institution",
        },
        {
          path: "topics",
          select: "display_name field_id",
          model: "Topic",
          populate: {
            path: "field_id",
            select: "display_name",
            model: "Field",
          },
        },
        {
          path: "affiliations.institution",
          select: "display_name",
          model: "Institution",
        },
      ],
    });

    // If no bookmark exists, return empty array
    if (!bookmark) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    // Transform data to match frontend expectations and include full data for PDF export
    const transformedData = bookmark.researcherIds.map((researcher) => {
      // Get the primary institution name
      const institutionName =
        researcher.last_known_affiliations?.[0]?.display_name ||
        "Unknown Institution";

      // Get the primary research field/topic
      const fieldName =
        researcher.topics?.[0]?.field_id?.display_name ||
        researcher.topics?.[0]?.display_name ||
        "Unknown Field";

      // Group topics by field
      const fieldTopicsMap = new Map();
      researcher.topics?.forEach((topic) => {
        const fieldName = topic.field_id?.display_name || "Uncategorized";
        if (!fieldTopicsMap.has(fieldName)) {
          fieldTopicsMap.set(fieldName, []);
        }
        fieldTopicsMap.get(fieldName).push({
          display_name: topic.display_name,
        });
      });

      // Convert map to array format for fields with their topics
      const fieldsWithTopics = Array.from(fieldTopicsMap.entries()).map(
        ([fieldName, topics]) => ({
          display_name: fieldName,
          topics: topics,
        })
      );

      return {
        _id: researcher._id,
        basic_info: {
          name: researcher.name || "Unknown",
          affiliations:
            researcher.affiliations?.map((aff) => ({
              institution: {
                display_name:
                  aff.institution?.display_name || "Unknown Institution",
              },
            })) || [],
        },
        current_affiliation: {
          display_name: institutionName,
        },
        current_affiliations:
          researcher.last_known_affiliations?.map((inst) => ({
            display_name: inst.display_name,
          })) || [],
        research_metrics: {
          h_index: researcher.research_metrics?.h_index || 0,
          i10_index: researcher.research_metrics?.i10_index || 0,
          total_citations: researcher.research_metrics?.total_citations || 0,
          total_works: researcher.research_metrics?.total_works || 0,
          two_year_mean_citedness:
            researcher.research_metrics?.two_year_mean_citedness || 0,
        },
        research_areas: {
          fields: fieldsWithTopics,
          topics: [], // Remove topics as a separate section
        },
        citation_trends: {
          counts_by_year: researcher.citation_trends || [],
        },
        identifiers: {
          orcid: researcher.identifiers?.orcid || "",
          openalex: researcher.identifiers?.openalex || "",
        },
        slug: researcher.slug || "",
      };
    });

    res.status(200).json({
      success: true,
      count: transformedData.length,
      data: transformedData,
    });
  } catch (error) {
    console.error("Error fetching bookmarks:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching bookmarks",
      error: error.message,
    });
  }
}

// Add bookmark(s) for one or more researchers
async function addBookmarks(req, res) {
  try {
    const userId = req.user.id;
    const { researcherIds } = req.body;

    // Validate input
    if (
      !researcherIds ||
      !Array.isArray(researcherIds) ||
      researcherIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of researcher IDs",
      });
    }

    // Verify that all researchers exist
    const existingResearchers = await Researcher.find({
      _id: { $in: researcherIds },
    });

    if (existingResearchers.length !== researcherIds.length) {
      return res.status(404).json({
        success: false,
        message: "One or more researchers not found",
      });
    }

    // Find or create the user's bookmark document
    let bookmark = await Bookmark.findOne({ userId });

    if (!bookmark) {
      // Create new bookmark document with the researcher IDs
      bookmark = new Bookmark({
        userId,
        researcherIds: researcherIds,
      });
      await bookmark.save();

      return res.status(201).json({
        success: true,
        message: `Successfully bookmarked ${researcherIds.length} researcher(s)`,
        bookmarked: researcherIds.length,
        alreadyBookmarked: 0,
      });
    }

    // Check for duplicates
    const alreadyBookmarked = researcherIds.filter((id) =>
      bookmark.researcherIds.some(
        (existingId) => existingId.toString() === id.toString()
      )
    );

    const newBookmarks = researcherIds.filter(
      (id) =>
        !bookmark.researcherIds.some(
          (existingId) => existingId.toString() === id.toString()
        )
    );

    if (newBookmarks.length === 0) {
      return res.status(400).json({
        success: false,
        message: "All researchers are already bookmarked",
      });
    }

    // Add new researcher IDs to the existing bookmark
    bookmark.researcherIds.push(...newBookmarks);
    await bookmark.save();

    res.status(201).json({
      success: true,
      message: `Successfully bookmarked ${newBookmarks.length} researcher(s)`,
      bookmarked: newBookmarks.length,
      alreadyBookmarked: alreadyBookmarked.length,
    });
  } catch (error) {
    console.error("Error adding bookmarks:", error);
    res.status(500).json({
      success: false,
      message: "Error adding bookmarks",
      error: error.message,
    });
  }
}

// Remove a bookmark for a specific researcher
async function removeBookmark(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params; // researcher ID

    // Validate ID
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Please provide a researcher ID",
      });
    }

    // Find the user's bookmark document
    const bookmark = await Bookmark.findOne({ userId });

    if (!bookmark) {
      return res.status(404).json({
        success: false,
        message: "Bookmark not found",
      });
    }

    // Check if the researcher is bookmarked
    const researcherIndex = bookmark.researcherIds.findIndex(
      (researcherId) => researcherId.toString() === id.toString()
    );

    if (researcherIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Researcher not found in bookmarks",
      });
    }

    // Remove the researcher from the bookmark
    bookmark.researcherIds.splice(researcherIndex, 1);

    // If no researchers left, delete the entire bookmark document
    if (bookmark.researcherIds.length === 0) {
      await Bookmark.findByIdAndDelete(bookmark._id);
    } else {
      await bookmark.save();
    }

    res.status(200).json({
      success: true,
      message: "Bookmark removed successfully",
    });
  } catch (error) {
    console.error("Error removing bookmark:", error);
    res.status(500).json({
      success: false,
      message: "Error removing bookmark",
      error: error.message,
    });
  }
}
