// utils/pdfUtils.js
const path = require("path");
const { fork } = require("child_process");

// Child process timeout (120 seconds)
const WORKER_TIMEOUT_MS = 120000;

async function extractTextFromPDF(filePath) {
  console.log("[CV Verification] Starting PDF text extraction...");

  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, "pdfWorker.js");
    const child = fork(workerPath, [], {
      silent: true, // Don't inherit parent's stdio
      execArgv: [], // No special node flags
    });

    let settled = false;
    let timeoutId = null;

    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      fn(value);
      // Kill child process if still running (ignore errors)
      try {
        child.kill();
      } catch (e) {
        // Ignore kill errors
      }
    };

    // Set timeout to prevent hung processes
    timeoutId = setTimeout(() => {
      settle(reject, new Error("PDF extraction timed out after 120 seconds"));
    }, WORKER_TIMEOUT_MS);

    child.on("message", (message) => {
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

    child.on("error", (error) => {
      settle(reject, error);
    });

    child.on("exit", (code, signal) => {
      if (!settled) {
        if (code !== 0 && code !== null) {
          settle(
            reject,
            new Error(`PDF worker exited unexpectedly with code ${code}`),
          );
        } else if (signal) {
          settle(
            reject,
            new Error(`PDF worker was terminated by signal ${signal}`),
          );
        }
        // If code is 0 and we haven't settled, that's unexpected - should have
        // received a message first. Reject to be safe.
        else {
          settle(
            reject,
            new Error("PDF worker exited without sending a result"),
          );
        }
      }
    });

    // Send the file path to the child process
    child.send({ filePath });
  });
}

module.exports = { extractTextFromPDF };
