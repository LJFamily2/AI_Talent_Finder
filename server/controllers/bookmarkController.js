const Bookmark = require("../models/bookmarkModel");
const researcherProfile = require("../models/researcherProfileModel");

// Get all bookmarks for the authenticated user
const getBookmarks = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find all bookmarks for this user and populate researcher data
    const bookmarks = await Bookmark.find({ userId }).populate({
      path: "researcherProfileIds",
      model: "researcherprofiles",
    });

    // Extract researcher profiles from bookmarks
    const researcherProfiles = [];
    for (const bookmark of bookmarks) {
      for (const researcherId of bookmark.researcherProfileIds) {
        const researcher = await researcherProfile.findById(researcherId);
        if (researcher) {
          researcherProfiles.push(researcher);
        }
      }
    }

    res.status(200).json({
      success: true,
      count: researcherProfiles.length,
      data: researcherProfiles,
    });
  } catch (error) {
    console.error("Error fetching bookmarks:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching bookmarks",
      error: error.message,
    });
  }
};

// Add bookmark(s) for one or more researcher profiles
const addBookmarks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { researcherProfileIds } = req.body;

    // Validate input
    if (
      !researcherProfileIds ||
      !Array.isArray(researcherProfileIds) ||
      researcherProfileIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of researcher profile IDs",
      });
    }

    // Verify that all researcher profiles exist
    const existingResearchers = await researcherProfile.find({
      _id: { $in: researcherProfileIds },
    });

    if (existingResearchers.length !== researcherProfileIds.length) {
      return res.status(404).json({
        success: false,
        message: "One or more researcher profiles not found",
      });
    }

    // Check for existing bookmarks to avoid duplicates
    const existingBookmarks = await Bookmark.find({
      userId,
      researcherProfileIds: { $in: researcherProfileIds },
    });

    const alreadyBookmarked = existingBookmarks
      .map((b) => b.researcherProfileIds)
      .flat();
    const newBookmarks = researcherProfileIds.filter(
      (id) => !alreadyBookmarked.includes(id)
    );

    if (newBookmarks.length === 0) {
      return res.status(400).json({
        success: false,
        message: "All researchers are already bookmarked",
      });
    }

    // Create individual bookmark documents for each researcher
    const bookmarkPromises = newBookmarks.map((researcherId) =>
      new Bookmark({
        userId,
        researcherProfileIds: [researcherId],
      }).save()
    );

    await Promise.all(bookmarkPromises);

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
};

// Remove a bookmark for a specific researcher
const removeBookmark = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params; // researcher profile ID

    // Validate ID
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Please provide a researcher profile ID",
      });
    }

    // Find and remove the bookmark
    const deletedBookmark = await Bookmark.findOneAndDelete({
      userId,
      researcherProfileIds: id,
    });

    if (!deletedBookmark) {
      return res.status(404).json({
        success: false,
        message: "Bookmark not found",
      });
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
};

module.exports = {
  getBookmarks,
  addBookmarks,
  removeBookmark,
};
