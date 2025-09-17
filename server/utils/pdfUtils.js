// utils/pdfUtils.js
const fs = require("fs");
const pdfParse = require("pdf-parse");
const pdfjsLib = require("pdfjs-dist");
const { createWorker } = require("tesseract.js");
const { createCanvas } = require("canvas");

async function extractTextFromPDF(filePath) {
  console.log("[CV Verification] Starting PDF text extraction...");

  // 1. Try with pdf-parse first (fast path)
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);

    if (pdfData.text && pdfData.text.trim().length > 30) {
      return pdfData.text;
    } else {
      console.log(
        "[CV Verification] pdf-parse returned little text, falling back to OCR..."
      );
    }
  } catch (err) {
    console.warn(
      "[CV Verification] pdf-parse failed, falling back to OCR...",
      err
    );
  }

  // 2. Fallback OCR using pdfjs-dist + one persistent tesseract worker
  try {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const pdfDoc = await pdfjsLib.getDocument({ data }).promise;

    const worker = await createWorker("eng");
    let ocrResults = [];

    // Process pages in parallel (limit concurrency for memory)
    const concurrency = 2; // tune this based on CPU cores
    const pageNumbers = Array.from(
      { length: pdfDoc.numPages },
      (_, i) => i + 1
    );

    async function processPage(pageNum) {
      console.log(`[CV Verification] OCR processing page ${pageNum}`);

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 }); // reduce scale for speed/accuracy tradeoff

      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext("2d");
      await page.render({ canvasContext: context, viewport }).promise;

      const imgBuffer = canvas.toBuffer("image/png");

      const {
        data: { text },
      } = await worker.recognize(imgBuffer);
      return text.trim();
    }

    // Concurrency control
    while (pageNumbers.length > 0) {
      const batch = pageNumbers.splice(0, concurrency);
      const results = await Promise.all(batch.map(processPage));
      ocrResults.push(...results);
    }

    await worker.terminate();

    const finalText = ocrResults.join("\n");
    if (!finalText.trim()) {
      throw new Error("OCR returned no text");
    }

    return finalText;
  } catch (err) {
    console.error("[CV Verification] OCR failed:", err);
    throw new Error(
      "Error: Failed to extract text from PDF (both pdf-parse & OCR failed)."
    );
  }
}

module.exports = { extractTextFromPDF };
