const fs = require("fs");
const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");
const pdf = require("pdf-poppler");
const path = require("path");
const axios = require("axios");

// --------------------- PDF TEXT EXTRACTION ---------------------
async function extractTextFromPDF(filePath) {
  let cvText = "";

  try {
    const pdfBuffer = fs.readFileSync(filePath);
    const parsed = await pdfParse(pdfBuffer);
    cvText = parsed.text || "";
    console.log("[PDF Parser] Text extracted successfully (length):", cvText.length);
  } catch (err) {
    console.warn("[PDF Parser] Failed to parse PDF:", err.message);
  }

  // Fallback to OCR if empty/too short
  if (!cvText || cvText.trim().length < 10) {
    console.warn("[PDF Parser] Using OCR fallback...");

    const outputDir = path.join(__dirname, "../temp_images_ocr");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    await pdf.convert(filePath, {
      format: "jpeg",
      out_dir: outputDir,
      out_prefix: "page",
      page: null,
    });

    const images = fs.readdirSync(outputDir).filter((f) => f.endsWith(".jpg"));
    for (const img of images) {
      const imagePath = path.join(outputDir, img);
      const { data: { text } } = await Tesseract.recognize(imagePath, "eng");
      cvText += (text || "") + "\n";
    }

    fs.rmSync(outputDir, { recursive: true, force: true });

    if (!cvText.trim()) {
      throw new Error("Unable to extract text from PDF (OCR failed)");
    }

    console.log("[OCR Parser] Text extracted via OCR (length):", cvText.length);
  }

  return cvText;
}

// --------------------- FIELD/TOPIC NORMALIZATION (no hardcoded role list) ---------------------
function titleCaseSmart(str) {
  return str
    .split(/\s+/)
    .map((w) => {
      // Preserve acronyms automatically (2–4 all-caps or mixed with digits)
      if (/^[A-Z0-9]{2,4}$/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

function splitList(s) {
  return s
    .split(/\s*\/\s*|\s*,\s*|\s+and\s+|\s*&\s*/i)
    .map((x) => x.replace(/^[^A-Za-z0-9(]+|[^A-Za-z0-9)]+$/g, "").trim())
    .filter(Boolean)
    .map(titleCaseSmart);
}

function extractFieldPhrases(str) {
  if (!str || typeof str !== "string") return [];
  let s = str.replace(/\s+/g, " ").trim();

  // 1) Prefer specializations in parentheses: "Professor (AI/ML)" → ["AI", "ML"]
  const parens = [...s.matchAll(/\(([^)]+)\)/g)].map((m) => m[1]);
  if (parens.length) {
    return parens.flatMap(splitList);
  }

  // 2) Keep phrase to the RIGHT of the LAST preposition (robust to unknown role words)
  const preps = [" in ", " of ", " for ", " at ", " on ", " within ", " across ", " about "];
  let cut = -1;
  let chosen = "";
  for (const p of preps) {
    const i = s.toLowerCase().lastIndexOf(p);
    if (i > cut) {
      cut = i;
      chosen = p;
    }
  }
  if (cut >= 0) {
    const right = s.slice(cut + chosen.length).trim();
    if (right) return splitList(right);
  }

  // 3) Try after a colon or dash
  const separators = [":", "–", "—", "-"];
  let sepIdx = -1;
  for (const sep of separators) {
    const i = s.lastIndexOf(sep);
    if (i > sepIdx) sepIdx = i;
  }
  if (sepIdx >= 0 && sepIdx < s.length - 1) {
    return splitList(s.slice(sepIdx + 1).trim());
  }

  // 4) Fallback: split entire string (covers cases like "Data Analytics")
  return splitList(s);
}

// --------------------- GEMINI JOB TOPIC DETECTION ---------------------
// Returns: [ { topic: "Information Systems" }, { topic: "Data Analytics" }, ... ]
async function detectJobPositionUsingGemini(text) {
  const input = text.trim(); // send full document (no slicing)

  const prompt = `
You are an expert in analyzing job descriptions.

Goal:
Extract ONLY the core field/discipline or role topic(s) mentioned (e.g., "Information Systems", "Data Analytics", "Human Resources", "Cybersecurity", "Data Science").
Do NOT include academic/role ranks such as "Lecturer", "Senior Lecturer", "Reader", "Professor", or managerial/position nouns like "Manager", "Director", "Engineer", "Developer", etc.
Return short, human-readable field/topic names only.

Output rules:
1) Output ONLY a valid JSON array.
2) Each array item must be an object with exactly one key: "job_position".
3) The value of "job_position" is just the core field/topic that available on open alex (e.g., "Information Systems", "Data Analytics"), these value usually include in section "job description" or "required qualification" or "requirement":.
4) If multiple distinct fields are present anywhere in the text, include them all as separate objects.
5) No duplicates. No commentary, markdown, or text outside the JSON.

Examples of valid outputs:
[{"job_position":"Information Systems"}]
[{"job_position":"Information Systems"},{"job_position":"Business Analytics"}]

Text to analyze:
"${input}"
`;

  try {
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
      {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      },
      {
        params: { key: process.env.GEMINI_API_KEY },
        headers: { "Content-Type": "application/json" },
      }
    );

    const raw = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    console.log("[Gemini Raw Output]:", raw);

    // Try parse JSON; fallback to text splitting if necessary
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = splitList(raw).map((t) => ({ topic: t }));
    }

    // Collect topics using structure-based heuristics (no hardcoded role words)
    const collected = [];
    const pushFields = (val) => {
      const fields = extractFieldPhrases(val);
      collected.push(...fields);
    };

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const val =
          typeof item === "string"
            ? item
            : item?.topic ||
              item?.job_position ||
              item?.position ||
              item?.field ||
              item?.title ||
              "";
        if (val) pushFields(val);
      }
    } else if (parsed && typeof parsed === "object") {
      const val = parsed.topic || parsed.job_position || parsed.position || parsed.field || parsed.title || "";
      if (val) pushFields(val);
    } else if (typeof parsed === "string") {
      pushFields(parsed);
    }

    // Deduplicate (case-insensitive)
    const seen = new Set();
    const unique = [];
    for (const t of collected) {
      const key = t.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push({ topic: t });
      }
    }

    console.log("[Gemini Parsed Result]:", unique);
    return unique.length ? unique : [{ topic: "Unable to determine topic" }];
  } catch (error) {
    console.error("[Gemini Error]", error?.response?.data || error.message);
    return [{ topic: "Unable to determine topic" }];
  }
}

module.exports = {
  extractTextFromPDF,
  detectJobPositionUsingGemini,
};
