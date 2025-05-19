
const express = require("express");
const axios = require("axios");
require("dotenv").config();

const router = express.Router();
router.use(express.text({ type: 'text/plain' }));

router.post("/api/extract-keywords", async (req, res) => {
  const cvText = typeof req.body === "string" ? req.body : "";

  if (!cvText.trim()) {
    return res.status(400).json({ error: "Missing plain text input." });
  }

  // STEP 1: Pre-process to isolate likely publication lines
  const lines = cvText.split(/[\n]+/);
  const likelyPubs = lines.filter(line =>
    line.match(/10\.\d{4,9}\/|doi|journal|“|”|".*"/i)
  );
  const cleanBlock = likelyPubs.join("\n");

  try {
    const cohereApiKey = process.env.COHERE_API_KEY;

    const cohereResponse = await axios.post(
      "https://api.cohere.ai/v1/generate",
      {
        model: "command",
        prompt: `
You are an intelligent information extractor for academic CVs or publication blocks.

From the text below, extract all publication entries.

Each publication must be returned as an object inside a JSON array, with the following keys:

- "publication": the full original line or paragraph as given
- "author": the name(s) of the author(s), support multiple formats
- "title": the full title of the publication
- "doi": the DOI if it is written (starts with 10.), otherwise null

Format:
[
  {
    "publication": "...",
    "author": "...",
    "title": "...",
    "doi": "10.xxxx/..." or null
  }
]

Rules:
- DO NOT fabricate or invent DOI. Only extract it if explicitly written and starts with 10.
- Ignore unrelated metadata such as ISSN, URL, notes like 'publication not accessible' or 'included in application'.
- Focus only on clean entries that reflect an actual publication.
- Return only valid JSON. No markdown, no explanation, no extra output.

TEXT:
"""
${cleanBlock}
"""
        `,
        max_tokens: 1000,
        temperature: 0.3
      },
      {
        headers: {
          Authorization: `Bearer ${cohereApiKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    let rawText = cohereResponse.data.generations[0].text.trim();
    let cleaned = "";

    try {
      cleaned = rawText
        .replace(/```json|```/g, "")
        .replace(/^[^{\[]*(?=\[)/s, "")
        .replace(/\\n/g, " ")
        .replace(/\\t/g, " ")
        .replace(/\n/g, " ")
        .replace(/\r/g, "")
        .replace(/\"/g, '"')
        .replace(/\'/g, "'")
        .replace(/\\/g, "\\")
        .trim();

      if (
        cleaned.startsWith('\"') || cleaned.includes('\"doi') || cleaned.includes('\\')
      ) {
        cleaned = JSON.parse(JSON.parse(`"${cleaned}"`));
      }
    } catch (e) {
      console.warn("⚠️ JSON fallback cleanup failed:", e.message);
    }

    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]") + 1;
    cleaned = cleaned.slice(start, end);

    let publications;
    try {
      publications = JSON.parse(cleaned);
      if (!Array.isArray(publications)) throw new Error("Invalid array format");
    } catch {
      return res.status(500).json({
        error: "Cohere returned invalid JSON.",
        raw: cleaned
      });
    }

    const results = publications.map(pub => {
      const publication = pub.publication?.trim() || "";
      const doi = pub.doi?.trim() || null;
      const doiInPublication = publication.includes("10.");

      return {
        author: pub.author?.trim() || null,
        title: pub.title?.trim() || "",
        doi: doiInPublication ? doi : null,
        publication
      };
    });

    res.json(results);
  } catch (err) {
    console.error("Extraction error:", err.message);
    res.status(500).json({ error: "Failed to extract publication info." });
  }
});

module.exports = router;