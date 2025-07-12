const ResearcherProfile = require("../models/researcherProfile");

async function searchByTopic(req, res) {
  const { topic } = req.query;

  if (!topic) {
    return res.status(400).json({ error: "Topic is required" });
  }

  try {
    const regex = new RegExp(topic, "i"); // case-insensitive

    const authors = await ResearcherProfile.find({
      $or: [
        { "research_areas.topics.display_name": { $regex: regex } },
        { "research_areas.fields.display_name": { $regex: regex } }
      ]
    }).limit(20); // limit optional

    if (authors.length === 0) {
      return res.status(404).json({ message: "No authors found for that topic" });
    }

    return res.status(200).json({ count: authors.length, authors });

  } catch (err) {
    console.error("Error in searchByTopic:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = { searchByTopic };
