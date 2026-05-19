const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const pdfjsLib = require("pdfjs-dist");
const { createWorker } = require("tesseract.js");
const { createCanvas } = require("canvas");

// Worker thread error handlers to prevent process crashes
process.on("unhandledRejection", (reason, promise) => {
  console.error(
    "❌ [Worker] Unhandled Rejection at:",
    promise,
    "reason:",
    reason,
  );
});

process.on("uncaughtException", (error) => {
  console.error("❌ [Worker] Uncaught Exception:", error);
});

async function extractTextFromPDF(filePath) {
  let dataBuffer;
  try {
    dataBuffer = fs.readFileSync(filePath);
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
    // If dataBuffer wasn't read, read it now
    if (!dataBuffer) {
      try {
        dataBuffer = fs.readFileSync(filePath);
      } catch (readErr) {
        throw new Error(`Failed to read PDF file: ${readErr.message}`);
      }
    }
  }

  try {
    const data = new Uint8Array(dataBuffer);
    const pdfDoc = await pdfjsLib.getDocument({ data }).promise;

    let worker;
    try {
      console.log("[CV Verification] Initializing Tesseract worker...");
      worker = await createWorker("eng");
      console.log("[CV Verification] Tesseract worker initialized.");
    } catch (workerErr) {
      console.error(
        "[CV Verification] Failed to initialize Tesseract worker:",
        workerErr,
      );
      throw new Error(`Failed to initialize OCR engine: ${workerErr.message}`);
    }

    const ocrResults = [];

    try {
      console.log(
        `[CV Verification] PDF loaded, ${pdfDoc.numPages} pages to process`,
      );

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        try {
          console.log(
            `[CV Verification] OCR processing page ${i}/${pdfDoc.numPages}`,
          );

          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });

          if (viewport.width === 0 || viewport.height === 0) {
            console.warn(
              `[CV Verification] Page ${i} has invalid dimensions, skipping.`,
            );
            continue;
          }

          const canvas = createCanvas(viewport.width, viewport.height);
          const context = canvas.getContext("2d");

          console.log(
            `[CV Verification] Rendering page ${i} to canvas (${viewport.width}x${viewport.height})`,
          );
          await page.render({ canvasContext: context, viewport }).promise;

          console.log(`[CV Verification] Converting page ${i} to buffer`);
          const imgBuffer = canvas.toBuffer("image/png");

          console.log(`[CV Verification] Tesseract recognizing page ${i}`);
          const {
            data: { text },
          } = await worker.recognize(imgBuffer);

          ocrResults.push(text.trim());

          // Help GC
          canvas.width = 0;
          canvas.height = 0;
        } catch (pageErr) {
          console.error(
            `[CV Verification] Failed to process page ${i}:`,
            pageErr,
          );
        }
      }
    } finally {
      if (worker) {
        try {
          console.log("[CV Verification] Terminating Tesseract worker...");
          await worker.terminate();
          console.log("[CV Verification] Tesseract worker terminated.");
        } catch (termErr) {
          console.warn(
            "[CV Verification] Tesseract worker termination failed:",
            termErr.message,
          );
        }
      }
    }

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

process.on("message", async (message) => {
  try {
    const filePath = message?.filePath;
    if (!filePath) {
      process.send({
        success: false,
        error: "Missing PDF file path",
      });
      return;
    }

    const text = await extractTextFromPDF(filePath);
    process.send({ success: true, text });
  } catch (error) {
    process.send({
      success: false,
      error:
        error?.message ||
        "Error: Failed to extract text from PDF (both pdf-parse & OCR failed).",
    });
  } finally {
    // Exit cleanly after sending result
    process.exit(0);
  }
});
