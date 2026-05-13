// utils/pdfUtils.js
const path = require("path");
const { Worker } = require("worker_threads");

async function extractTextFromPDF(filePath) {
  console.log("[CV Verification] Starting PDF text extraction...");

  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, "pdfWorker.js"));
    let settled = false;

    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
      void worker.terminate().catch(() => {});
    };

    worker.once("message", (message) => {
      if (message?.success) {
        settle(resolve, message.text || "");
        return;
      }

      settle(
        reject,
        new Error(
          message?.error ||
            "Error: Failed to extract text from PDF (both pdf-parse & OCR failed).",
        ),
      );
    });

    worker.once("error", (error) => {
      settle(reject, error);
    });

    worker.once("exit", (code) => {
      if (!settled && code !== 0) {
        settle(
          reject,
          new Error(`PDF worker exited unexpectedly with code ${code}`),
        );
      }
    });

    worker.postMessage({ filePath });
  });
}

module.exports = { extractTextFromPDF };
