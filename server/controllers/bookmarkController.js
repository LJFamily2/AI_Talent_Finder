const Bookmark = require("../models/bookmarkModel");
const Researcher = require("../models/Researcher");
const Institution = require("../models/Institution");
const Topic = require("../models/Topic");

// Exported controller functions
module.exports = {
  getBookmarks,
  addBookmarks,
  removeBookmark,
  createFolder,
  renameFolder,
  deleteFolder,
  replaceResearchersInFolder,
  updateResearchersInFolder,
  moveResearchersBetweenFolders,
  getBookmarkIds,
};

/* ============================================================
   Utilities
============================================================ */
async function ensureBookmarkDoc(userId) {
  let bookmark = await Bookmark.findOne({ userId });
  if (!bookmark) {
    bookmark = new Bookmark({
      userId,
      folders: [{ name: "General", researcherIds: [] }],
    });
    await bookmark.save();
  } else {
    // Ensure "General" always exists
    if (!bookmark.folders.some(f => f.name.toLowerCase() === "general")) {
      bookmark.folders.push({ name: "General", researcherIds: [] });
      await bookmark.save();
    }
  }
  return bookmark;
}

function findFolder(bookmark, folderName) {
  return bookmark.folders.find(
    f => f.name.toLowerCase() === folderName.toLowerCase()
  );
}

function folderExists(bookmark, name) {
  return bookmark.folders.some(
    f => f.name.toLowerCase() === name.toLowerCase()
  );
}

/* ============================================================
   GET Bookmarks (grouped by folders)
============================================================ */
async function getBookmarks(req, res) {
  try {
    const userId = req.user.id;
    let bookmark = await ensureBookmarkDoc(userId);

    await bookmark.populate({
      path: "folders.researcherIds",
      select:
        "name slug research_metrics last_known_affiliations topics affiliations identifiers citation_trends",
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

    // Transform data
    const transformed = bookmark.folders.map(folder => ({
      name: folder.name,
      researcherIds: folder.researcherIds.map(r => {
        const institutionName =
          r.last_known_affiliations?.[0]?.display_name || "Unknown Institution";

        const fieldName =
          r.topics?.[0]?.field_id?.display_name ||
          r.topics?.[0]?.display_name ||
          "Unknown Field";

        const fieldTopicsMap = new Map();
        r.topics?.forEach(topic => {
          const fname = topic.field_id?.display_name || "Uncategorized";
          if (!fieldTopicsMap.has(fname)) fieldTopicsMap.set(fname, []);
          fieldTopicsMap.get(fname).push({ display_name: topic.display_name });
        });

        const fieldsWithTopics = Array.from(fieldTopicsMap.entries()).map(
          ([fname, topics]) => ({ display_name: fname, topics })
        );

        return {
          _id: r._id,
          basic_info: {
            name: r.name || "Unknown",
            affiliations:
              r.affiliations?.map(aff => ({
                institution: {
                  display_name:
                    aff.institution?.display_name || "Unknown Institution",
                },
              })) || [],
          },
          current_affiliation: { display_name: institutionName },
          current_affiliations:
            r.last_known_affiliations?.map(inst => ({
              display_name: inst.display_name,
            })) || [],
          research_metrics: {
            h_index: r.research_metrics?.h_index || 0,
            i10_index: r.research_metrics?.i10_index || 0,
            total_citations: r.research_metrics?.total_citations || 0,
            total_works: r.research_metrics?.total_works || 0,
            two_year_mean_citedness:
              r.research_metrics?.two_year_mean_citedness || 0,
          },
          research_areas: { fields: fieldsWithTopics, topics: [] },
          citation_trends: { counts_by_year: r.citation_trends || [] },
          identifiers: {
            orcid: r.identifiers?.orcid || "",
            openalex: r.identifiers?.openalex || "",
          },
          slug: r.slug || "",
        };
      }),
    }));

    res.status(200).json({
      success: true,
      data: transformed,
    });
  } catch (err) {
    console.error("Error fetching bookmarks:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/* ============================================================
   ADD Bookmarks (to folder)
============================================================ */
async function addBookmarks(req, res) {
  try {
    const userId = req.user.id;
    const { researcherIds, folderName = "General" } = req.body;

    if (!researcherIds || !Array.isArray(researcherIds) || !researcherIds.length) {
      return res.status(400).json({ success: false, message: "researcherIds required" });
    }

    const existingResearchers = await Researcher.find({ _id: { $in: researcherIds } });
    if (existingResearchers.length !== researcherIds.length) {
      return res.status(404).json({ success: false, message: "One or more researchers not found" });
    }

    let bookmark = await ensureBookmarkDoc(userId);
    let folder = findFolder(bookmark, folderName);

    if (!folder) {
      folder = { name: folderName, researcherIds: [] };
      bookmark.folders.push(folder);
    }

    const already = folder.researcherIds.map(id => id.toString());
    const newOnes = researcherIds.filter(id => !already.includes(id.toString()));

    folder.researcherIds.push(...newOnes);
    await bookmark.save();

    res.status(201).json({
      success: true,
      message: `Added ${newOnes.length} researchers to ${folderName}`,
      bookmarked: newOnes.length,
      alreadyBookmarked: researcherIds.length - newOnes.length,
    });
  } catch (err) {
    console.error("Error adding bookmarks:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/* ============================================================
   REMOVE a researcher from folder
============================================================ */
async function removeBookmark(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { folderName = "General" } = req.query;

    if (!id) return res.status(400).json({ success: false, message: "researcherId required" });

    let bookmark = await ensureBookmarkDoc(userId);
    const folder = findFolder(bookmark, folderName);
    if (!folder) return res.status(404).json({ success: false, message: "Folder not found" });

    const idx = folder.researcherIds.findIndex(rid => rid.toString() === id.toString());
    if (idx === -1) return res.status(404).json({ success: false, message: "Researcher not found" });

    folder.researcherIds.splice(idx, 1);
    await bookmark.save();

    res.status(200).json({ success: true, message: "Removed successfully" });
  } catch (err) {
    console.error("Error removing bookmark:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/* ============================================================
   CREATE Folder
============================================================ */
async function createFolder(req, res) {
  try {
    const userId = req.user.id;
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Folder name required" });
    if (name.toLowerCase() === "general") return res.status(400).json({ success: false, message: "General already exists" });

    let bookmark = await ensureBookmarkDoc(userId);
    if (folderExists(bookmark, name)) return res.status(400).json({ success: false, message: "Folder already exists" });

    bookmark.folders.push({ name, researcherIds: [] });
    await bookmark.save();
    res.status(201).json({ success: true, message: "Folder created" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/* ============================================================
   RENAME Folder
============================================================ */
async function renameFolder(req, res) {
  try {
    const userId = req.user.id;
    const { folderName } = req.params;
    const { newName } = req.body;

    if (!newName) return res.status(400).json({ success: false, message: "newName required" });
    if (folderName.toLowerCase() === "general") return res.status(400).json({ success: false, message: "Cannot rename General" });

    let bookmark = await ensureBookmarkDoc(userId);
    const folder = findFolder(bookmark, folderName);
    if (!folder) return res.status(404).json({ success: false, message: "Folder not found" });

    if (folderExists(bookmark, newName)) return res.status(400).json({ success: false, message: "Name already in use" });

    folder.name = newName;
    await bookmark.save();
    res.status(200).json({ success: true, message: "Folder renamed" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/* ============================================================
   DELETE Folder
============================================================ */
async function deleteFolder(req, res) {
  try {
    const userId = req.user.id;
    const { folderName } = req.params;

    if (folderName.toLowerCase() === "general") {
      return res.status(400).json({ success: false, message: "Cannot delete General" });
    }

    let bookmark = await ensureBookmarkDoc(userId);
    const idx = bookmark.folders.findIndex(f => f.name.toLowerCase() === folderName.toLowerCase());
    if (idx === -1) return res.status(404).json({ success: false, message: "Folder not found" });

    bookmark.folders.splice(idx, 1);
    await bookmark.save();
    res.status(200).json({ success: true, message: "Folder deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/* ============================================================
   REPLACE Researchers in Folder
============================================================ */
async function replaceResearchersInFolder(req, res) {
  try {
    const userId = req.user.id;
    const { folderName } = req.params;
    const { researcherIds } = req.body;

    let bookmark = await ensureBookmarkDoc(userId);
    const folder = findFolder(bookmark, folderName);
    if (!folder) return res.status(404).json({ success: false, message: "Folder not found" });

    const existing = await Researcher.find({ _id: { $in: researcherIds } });
    if (existing.length !== researcherIds.length) return res.status(404).json({ success: false, message: "Invalid researcherIds" });

    folder.researcherIds = [...new Set(researcherIds.map(id => id.toString()))];
    await bookmark.save();
    res.status(200).json({ success: true, message: "Researchers replaced" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/* ============================================================
   UPDATE Researchers in Folder (add/remove)
============================================================ */
async function updateResearchersInFolder(req, res) {
  try {
    const userId = req.user.id;
    const { folderName } = req.params;
    const { add = [], remove = [] } = req.body;

    let bookmark = await ensureBookmarkDoc(userId);
    const folder = findFolder(bookmark, folderName);
    if (!folder) return res.status(404).json({ success: false, message: "Folder not found" });

    if (add.length) {
      const existing = await Researcher.find({ _id: { $in: add } });
      if (existing.length !== add.length) return res.status(404).json({ success: false, message: "Invalid researcherIds in add" });

      const set = new Set(folder.researcherIds.map(id => id.toString()));
      add.forEach(id => set.add(id.toString()));
      folder.researcherIds = Array.from(set);
    }

    if (remove.length) {
      folder.researcherIds = folder.researcherIds.filter(
        id => !remove.some(rid => rid.toString() === id.toString())
      );
    }

    await bookmark.save();
    res.status(200).json({ success: true, message: "Researchers updated" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/* ============================================================
   MOVE Researchers between Folders
============================================================ */
async function moveResearchersBetweenFolders(req, res) {
  try {
    const userId = req.user.id;
    const { from, to } = req.body;
    const { researcherIds } = req.body;

    if (!from || !to) return res.status(400).json({ success: false, message: "from and to folders required" });
    if (!researcherIds || !researcherIds.length) return res.status(400).json({ success: false, message: "researcherIds required" });

    let bookmark = await ensureBookmarkDoc(userId);
    const fromFolder = findFolder(bookmark, from);
    if (!fromFolder) return res.status(404).json({ success: false, message: "Source folder not found" });

    let toFolder = findFolder(bookmark, to);
    if (!toFolder) {
      toFolder = { name: to, researcherIds: [] };
      bookmark.folders.push(toFolder);
    }

    fromFolder.researcherIds = fromFolder.researcherIds.filter(
      id => !researcherIds.includes(id.toString())
    );

    const set = new Set(toFolder.researcherIds.map(id => id.toString()));
    researcherIds.forEach(id => set.add(id.toString()));
    toFolder.researcherIds = Array.from(set);

    await bookmark.save();
    res.status(200).json({ success: true, message: "Researchers moved" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/* ============================================================
   GET Bookmark IDs (only researcher IDs)
============================================================ */
async function getBookmarkIds(req, res) {
  try {
    const userId = req.user.id;
    let bookmark = await ensureBookmarkDoc(userId);

    const folderIds = bookmark.folders.map(folder => ({
      name: folder.name,
      researcherIds: folder.researcherIds, // Only return IDs
    }));

    res.status(200).json({
      success: true,
      data: folderIds,
    });
  } catch (err) {
    console.error("Error fetching bookmark IDs:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}
