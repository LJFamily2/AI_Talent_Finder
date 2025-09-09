/**
 * Ground Truth Utilities
 *
 * Utility functions for ground truth generation and verification comparison
 *
 * @author AI Talent Finder Team
 * @version 1.0.0
 */

const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);

/**
 * Compare verification results between Gemini AI and Traditional methods
 * Focus only on status conflicts
 */
function compareVerificationResults(geminiResult, traditionalResult) {
  const geminiPubs = geminiResult.results || [];
  const traditionalPubs = traditionalResult.results || [];
  const comparisons = [];

  // Create a map of traditional publications by normalized title for easier lookup
  const traditionalMap = new Map();
  traditionalPubs.forEach((pub) => {
    const normalizedTitle = normalizeTitle(pub.publication.title);
    traditionalMap.set(normalizedTitle, pub);
  });

  // Compare each Gemini publication with its traditional counterpart
  geminiPubs.forEach((geminiPub) => {
    const normalizedTitle = normalizeTitle(geminiPub.publication.title);
    const traditionalPub = traditionalMap.get(normalizedTitle);

    if (traditionalPub) {
      const geminiStatus = geminiPub.verification.displayData.status;
      const traditionalStatus = traditionalPub.verification.displayData.status;

      // Only check for status conflicts
      const hasStatusConflict = geminiStatus !== traditionalStatus;

      if (hasStatusConflict) {
        comparisons.push({
          title: geminiPub.publication.title,
          hasConflict: true,
          conflictType: "status_mismatch",
        });
      }
    }
  });

  return comparisons;
}

/**
 * Normalize title for comparison
 */
function normalizeTitle(title) {
  if (!title) return "";
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Get CV files from directory with size limit
 */
async function getCVFiles(dirPath, limit) {
  try {
    const files = await readdirAsync(dirPath);
    const pdfFiles = files.filter((file) =>
      file.toLowerCase().endsWith(".pdf")
    );
    const fileStats = await Promise.all(
      pdfFiles.map(async (file) => {
        const filePath = path.join(dirPath, file);
        const stats = await statAsync(filePath);
        return { path: filePath, size: stats.size, created: stats.birthtime };
      })
    );
    fileStats.sort((a, b) => a.size - b.size);
    return fileStats.slice(0, limit);
  } catch (error) {
    console.error("Error getting CV files:", error);
    return [];
  }
}

/**
 * Get CV identifier from file path
 */
function getCVIdentifier(filePath) {
  return path.basename(filePath, ".pdf");
}

module.exports = {
  compareVerificationResults,
  normalizeTitle,
  getCVFiles,
  getCVIdentifier,
};
