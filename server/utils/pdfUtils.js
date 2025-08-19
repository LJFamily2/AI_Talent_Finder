const fs = require("fs");
const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");
const pdf = require("pdf-poppler");
const path = require("path");
const axios = require("axios");

// Extract text from PDF using pdf-parse first, fallback to OCR with Tesseract if needed
async function extractTextFromPDF(filePath) {
  let cvText = "";

  try {
    const pdfBuffer = fs.readFileSync(filePath);
    const parsed = await pdfParse(pdfBuffer);
    cvText = parsed.text;
    console.log("[PDF Parser] Text extracted successfully (length):", cvText.length);
  } catch (err) {
    console.warn("[PDF Parser] Failed to parse PDF:", err.message);
  }

  // Fallback to OCR if pdf-parse failed or returned empty/too-short text
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
      cvText += text + "\n";
    }

    fs.rmSync(outputDir, { recursive: true, force: true });

    if (!cvText.trim()) {
      throw new Error("Unable to extract text from PDF (OCR failed)");
    }

    console.log("[OCR Parser] Text extracted via OCR (length):", cvText.length);
  }

  return cvText;
}

// Use Gemini model to classify job position from text (max 1000 characters)
async function detectJobPositionUsingGemini(text) {
  const input = text.trim().slice(0, 1000);
  const prompt = `Here is a job description:\n\n"${input}"\n\nBased on this description, what is the most likely job position (e.g., Information Systems, HR Manager)? Just return the position as a short phrase.`;

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
        params: {
          key: process.env.GEMINI_API_KEY,
        },
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const position = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    console.log("[Gemini] Job position detected:", position);
    return position || "Unknown position";
  } catch (error) {
    console.error("[Gemini Error]", error?.response?.data || error.message);
    return "Unable to determine position";
  }
}

module.exports = {
  extractTextFromPDF,
  detectJobPositionUsingGemini,
};
