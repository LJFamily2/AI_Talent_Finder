const fs = require("fs");
const pdfParse = require("pdf-parse");
const pdfjsLib = require("pdfjs-dist");
const { createWorker } = require("tesseract.js");
const { createCanvas } = require("canvas");
const { parentPort } = require("worker_threads");

async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);

    if (pdfData.text && pdfData.text.trim().length > 30) {
      return pdfData.text;
    }

    console.log(
      "[CV Verification] pdf-parse returned little text, falling back to OCR...",
    );
  } catch (err) {
    console.warn(
      "[CV Verification] pdf-parse failed, falling back to OCR...",
      err,
    );
  }

  try {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const pdfDoc = await pdfjsLib.getDocument({ data }).promise;

    const worker = await createWorker("eng");
    const ocrResults = [];
    const concurrency = 2;
    const pageNumbers = Array.from(
      { length: pdfDoc.numPages },
      (_, i) => i + 1,
    );

    async function processPage(pageNum) {
      console.log(`[CV Verification] OCR processing page ${pageNum}`);

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });

      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext("2d");
      await page.render({ canvasContext: context, viewport }).promise;

      const imgBuffer = canvas.toBuffer("image/png");
      const {
        data: { text },
      } = await worker.recognize(imgBuffer);
      return text.trim();
    }

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
      "Error: Failed to extract text from PDF (both pdf-parse & OCR failed).",
    );
  }
}

parentPort.on("message", async (message) => {
  try {
    const filePath = message?.filePath;
    if (!filePath) {
      parentPort.postMessage({
        success: false,
        error: "Missing PDF file path",
      });
      return;
    }

    const text = await extractTextFromPDF(filePath);
    parentPort.postMessage({ success: true, text });
  } catch (error) {
    parentPort.postMessage({
      success: false,
      error:
        error?.message ||
        "Error: Failed to extract text from PDF (both pdf-parse & OCR failed).",
    });
  }
});
