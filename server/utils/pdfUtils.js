const fs = require("fs");
const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");
const pdf = require("pdf-poppler");
const path = require("path");

// Utility function to extract text from PDF (native or OCR fallback)
async function extractTextFromPDF(filePath) {
  const pdfBuffer = fs.readFileSync(filePath);
  let cvText = "";
  try {
    const parsedData = await pdfParse(pdfBuffer);
    cvText = parsedData.text;
  } catch (err) {
    cvText = "";
  }
  if (!cvText || cvText.trim().length < 10) {
    console.warn(
      "[CV Verification] pdf-parse returned empty or too short text, attempting OCR fallback..."
    );
    const outputDir = path.join(__dirname, "../temp_images_ocr");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
    await pdf.convert(filePath, {
      format: "jpeg",
      out_dir: outputDir,
      out_prefix: "page",
      page: null,
    });
    const files = fs.readdirSync(outputDir).filter((f) => f.endsWith(".jpg"));
    for (const imageFile of files) {
      const {
        data: { text },
      } = await Tesseract.recognize(path.join(outputDir, imageFile), "eng");
      cvText += text + "\n";
    }
    // Optionally clean up images
    fs.rmSync(outputDir, { recursive: true, force: true });
    if (!cvText.trim()) {
      throw new Error("Unable to extract text from PDF (OCR also failed)");
    }
  }
  return cvText;
}

module.exports = {
  extractTextFromPDF,
};
