/**
 * Script to add missing CV files to ground_truth_final.json
 *
 * This script:
 * 1. Reads existing ground truth JSON
 * 2. Scans test_cvs folder for all PDF files
 * 3. Filters out files already in ground truth
 * 4. Runs both AI (Gemini) and Traditional verification on missing CVs
 * 5. Compares results and handles conflicts like ground-truth-generator.js
 * 6. Saves updated ground truth JSON
 */

const fs = require("fs").promises;
const path = require("path");

// Load environment variables
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// Import verification controllers
const traditionalVerifier = require("../controllers/cvVerificationController");
const geminiVerifier = require("../controllers/geminiAICvVerificationController");
const { extractTextFromPDF } = require("../utils/pdfUtils");
const {
  compareVerificationResults,
  normalizeTitle,
} = require("../utils/groundTruthUtils");

// Configuration
const CONFIG = {
  groundTruthPath: path.join(__dirname, "../data/ground_truth_final.json"),
  testCvsFolder: path.join(__dirname, "../data/test_cvs"),
  backupPath: path.join(__dirname, "../data/ground_truth_final_backup.json"),
  progressPath: path.join(__dirname, "../data/add_cvs_progress.json"),
  useHybridApproach: true,
  delayBetweenCVs: 6000, // 6 seconds delay between CVs
};

/**
 * Get CV identifier from filename (removes .pdf extension)
 */
function getCVIdentifier(filename) {
  return path.basename(filename, ".pdf");
}

/**
 * Create backup of original ground truth file
 */
async function createBackup() {
  try {
    console.log("Creating backup of ground truth file...");
    const originalContent = await fs.readFile(CONFIG.groundTruthPath, "utf8");
    await fs.writeFile(CONFIG.backupPath, originalContent, "utf8");
    console.log(`✓ Backup created: ${CONFIG.backupPath}`);
  } catch (error) {
    console.error("Error creating backup:", error);
    throw error;
  }
}

/**
 * Load existing ground truth data
 */
async function loadGroundTruth() {
  try {
    console.log("Loading existing ground truth...");
    const content = await fs.readFile(CONFIG.groundTruthPath, "utf8");
    const groundTruth = JSON.parse(content);
    console.log(
      `✓ Loaded ${Object.keys(groundTruth).length} existing CV entries`
    );
    return groundTruth;
  } catch (error) {
    console.error("Error loading ground truth:", error);
    throw error;
  }
}

/**
 * Get all PDF files from test_cvs folder
 */
async function getAllCVFiles() {
  try {
    console.log("Scanning test_cvs folder...");
    const files = await fs.readdir(CONFIG.testCvsFolder);
    const pdfFiles = files.filter((file) =>
      file.toLowerCase().endsWith(".pdf")
    );
    console.log(`✓ Found ${pdfFiles.length} PDF files in test_cvs folder`);
    return pdfFiles;
  } catch (error) {
    console.error("Error reading test_cvs folder:", error);
    throw error;
  }
}

/**
 * Filter out CVs that already exist in ground truth
 */
function filterNewCVs(allPdfFiles, existingGroundTruth) {
  console.log("Filtering new CVs...");

  const existingCVIds = Object.keys(existingGroundTruth);
  console.log(
    `✓ Found ${existingCVIds.length} existing CV IDs in ground truth`
  );

  const newCVs = allPdfFiles.filter((filename) => {
    const cvId = getCVIdentifier(filename);
    return !existingCVIds.includes(cvId);
  });

  console.log(`✓ Found ${newCVs.length} new CV files not in ground truth`);

  // Log some examples
  if (newCVs.length > 0) {
    console.log("Examples of new CVs:");
    newCVs.slice(0, 5).forEach((cv, i) => {
      console.log(`  ${i + 1}. ${cv}`);
    });
    if (newCVs.length > 5) {
      console.log(`  ... and ${newCVs.length - 5} more`);
    }
  }

  return newCVs;
}

/**
 * Process a single CV with hybrid verification approach
 */
async function processNewCVEntry(filename) {
  const cvId = getCVIdentifier(filename);
  const cvPath = path.join(CONFIG.testCvsFolder, filename);

  console.log(`  Processing: ${filename}`);

  try {
    // Extract text to get CV size
    const cvText = await extractTextFromPDF(cvPath);
    const cvTextSize = cvText.length;
    console.log(`    CV text size: ${cvTextSize} characters`);

    // Create file object for verification methods
    const cvFile = {
      path: cvPath,
      originalname: filename,
      size: cvTextSize,
    };

    // Run both verification methods
    console.log("    Running both AI (Gemini) and traditional verification...");
    const [geminiResult, traditionalResult] = await Promise.all([
      geminiVerifier.verifyCVWithAI(cvFile).catch((err) => {
        console.log(`      Gemini verification failed: ${err.message}`);
        return null;
      }),
      traditionalVerifier.verifyCV(cvFile).catch((err) => {
        console.log(`      Traditional verification failed: ${err.message}`);
        return null;
      }),
    ]);

    // Determine which method to use and process results
    let result, method;
    if (geminiResult && traditionalResult) {
      console.log(
        "    Both AI (Gemini) and Traditional verification succeeded - using hybrid approach"
      );
      method = "hybrid";
      result = traditionalResult; // Use traditional as primary for consistency
    } else if (geminiResult) {
      console.log("    Only AI (Gemini) verification succeeded");
      method = "gemini_ai";
      result = geminiResult;
    } else if (traditionalResult) {
      console.log("    Only Traditional verification succeeded");
      method = "traditional";
      result = traditionalResult;
    } else {
      throw new Error("Both verification methods failed");
    }

    // Compare results between methods and flag conflicts for manual review
    let conflictedPublications = [];
    if (geminiResult && traditionalResult) {
      console.log("    Comparing AI vs Traditional verification results...");
      const comparisonResults = compareVerificationResults(
        geminiResult,
        traditionalResult
      );
      conflictedPublications = comparisonResults.filter((r) => r.hasConflict);

      if (conflictedPublications.length > 0) {
        console.log(
          `    ⚠️  Found ${conflictedPublications.length} status conflicts between methods`
        );
      }
    }

    // Process publications with proper structure
    let publications;
    if (method === "gemini_ai") {
      publications = result.results.map((pub) => ({
        title: pub.publication.title,
        verifiedStatus: pub.verification.displayData.status === "verified",
      }));
    } else {
      publications = result.results.map((pub) => ({
        title: pub.publication.title,
        verifiedStatus: pub.verification.displayData.status === "verified",
      }));
    }

    // Set conflicted publications' verifiedStatus to null
    if (conflictedPublications.length > 0) {
      const conflictTitlesNormalized = conflictedPublications.map((c) =>
        normalizeTitle(c.title)
      );
      publications = publications.map((pub) => {
        const pubTitleNormalized = normalizeTitle(pub.title);
        if (conflictTitlesNormalized.includes(pubTitleNormalized)) {
          return {
            ...pub,
            verifiedStatus: null,
          };
        }
        return pub;
      });
    }

    // Extract candidate name from results or filename
    let candidateName = result.candidateName || "Unknown";

    // If still unknown, try to extract from filename
    if (candidateName === "Unknown") {
      candidateName = extractCandidateNameFromFilename(filename);
    }

    const newEntry = {
      candidateName: candidateName,
      cvSize: cvTextSize,
      publications: publications,
    };

    console.log(`    ✓ Processed with ${publications.length} publications`);

    // Log conflicts for console output
    if (conflictedPublications.length > 0) {
      console.log(
        `    ⚠️  ${conflictedPublications.length} publications have status conflicts (set to null)`
      );
    }

    return newEntry;
  } catch (error) {
    console.error(`    ✗ Error processing CV: ${error.message}`);

    // Return basic entry on error
    return {
      candidateName: extractCandidateNameFromFilename(filename),
      cvSize: 0,
      publications: [],
      error: error.message,
    };
  }
}

/**
 * Extract candidate name from filename (helper function)
 */
function extractCandidateNameFromFilename(filename) {
  const cvId = getCVIdentifier(filename);
  let candidateName = "Unknown";

  // Handle different filename patterns
  if (filename.includes("academics-rmit-edu-au-")) {
    // Extract name from RMIT academics URLs
    const namePart = filename
      .replace("academics-rmit-edu-au-", "")
      .replace("-publications", "")
      .replace(".pdf", "");
    candidateName = namePart
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  } else if (filename.includes("staffportal-curtin-edu-au-")) {
    // Extract name from Curtin staff portal URLs
    const namePart = filename.split("view-")[1]?.split("-");
    if (namePart && namePart.length >= 2) {
      candidateName = namePart
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    }
  } else if (filename.includes("www-rmit-edu-vn-profiles-")) {
    // Extract name from RMIT Vietnam profiles
    const namePart = filename
      .replace("www-rmit-edu-vn-profiles-", "")
      .replace(".pdf", "");
    candidateName = namePart
      .split("-")
      .slice(1)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  } else {
    // For other files, use filename as basis
    candidateName = cvId
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }

  return candidateName;
}

/**
 * Save progress incrementally to prevent data loss
 */
async function saveProgress(groundTruth, filename = "add_cvs_progress.json") {
  try {
    const progressPath = path.join(__dirname, "../data", filename);
    await fs.writeFile(
      progressPath,
      JSON.stringify(groundTruth, null, 2),
      "utf8"
    );
    console.log(`  💾 Progress saved to: ${progressPath}`);
  } catch (error) {
    console.error(`  ❌ Failed to save progress: ${error.message}`);
  }
}

/**
 * Add new CVs to ground truth with verification
 */
async function addNewCVsToGroundTruth(groundTruth, newCVFiles) {
  console.log(`Processing ${newCVFiles.length} new CVs with verification...`);

  let addedCount = 0;
  let successCount = 0;
  let errorCount = 0;

  // Handle unexpected termination
  const handleTermination = async (signal) => {
    console.log(`\n🚨 Received ${signal}. Saving current progress...`);
    await saveProgress(groundTruth, `add_cvs_interrupted_${Date.now()}.json`);
    console.log("Progress saved. Exiting...");
    process.exit(0);
  };

  process.on("SIGINT", handleTermination);
  process.on("SIGTERM", handleTermination);

  for (let i = 0; i < newCVFiles.length; i++) {
    const filename = newCVFiles[i];
    const cvId = getCVIdentifier(filename);

    console.log(`\n[${i + 1}/${newCVFiles.length}] Processing: ${filename}`);

    try {
      const newEntry = await processNewCVEntry(filename);
      groundTruth[cvId] = newEntry;

      addedCount++;
      if (!newEntry.error) {
        successCount++;
        console.log(
          `  ✓ Successfully added: ${cvId} (${newEntry.candidateName})`
        );
      } else {
        errorCount++;
        console.log(
          `  ⚠️  Added with errors: ${cvId} (${newEntry.candidateName})`
        );
      }

      // Save progress every 5 CVs
      if (addedCount % 5 === 0) {
        await saveProgress(groundTruth, `add_cvs_progress_${addedCount}.json`);
      }
    } catch (error) {
      console.error(`  ✗ Failed to process ${filename}: ${error.message}`);
      errorCount++;

      // Add basic entry even on failure
      groundTruth[cvId] = {
        candidateName: extractCandidateNameFromFilename(filename),
        cvSize: 0,
        publications: [],
        error: error.message,
      };
      addedCount++;
    }

    // Add delay between CVs to avoid rate limiting
    if (i < newCVFiles.length - 1) {
      console.log(
        `  ⏳ Waiting ${
          CONFIG.delayBetweenCVs / 1000
        } seconds before next CV...`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, CONFIG.delayBetweenCVs)
      );
    }
  }

  console.log(`\n📊 Processing Summary:`);
  console.log(`  Total processed: ${addedCount}`);
  console.log(`  Successful: ${successCount}`);
  console.log(`  With errors: ${errorCount}`);

  return addedCount;
}

/**
 * Save updated ground truth
 */
async function saveGroundTruth(groundTruth) {
  try {
    console.log("Saving updated ground truth...");
    const content = JSON.stringify(groundTruth, null, 2);
    await fs.writeFile(CONFIG.groundTruthPath, content, "utf8");
    console.log(
      `✓ Ground truth saved with ${
        Object.keys(groundTruth).length
      } total entries`
    );
  } catch (error) {
    console.error("Error saving ground truth:", error);
    throw error;
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log("=".repeat(60));
    console.log("Adding CVs to Ground Truth with Verification");
    console.log("=".repeat(60));

    // Create backup
    await createBackup();

    // Load existing data
    const groundTruth = await loadGroundTruth();
    const originalCount = Object.keys(groundTruth).length;

    // Get all CV files
    const allPdfFiles = await getAllCVFiles();

    // Filter new CVs
    const newCVFiles = filterNewCVs(allPdfFiles, groundTruth);

    if (newCVFiles.length === 0) {
      console.log("❌ No new CV files found to add");
      return;
    }

    console.log(
      `\n🚀 Will process ${newCVFiles.length} new CVs with hybrid verification`
    );
    console.log("This may take a while due to AI API calls and delays...");

    // Process new CVs with verification
    const addedCount = await addNewCVsToGroundTruth(groundTruth, newCVFiles);

    // Save final updated ground truth
    await saveGroundTruth(groundTruth);

    // Save final progress backup
    await saveProgress(groundTruth, "add_cvs_final.json");

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("SUMMARY");
    console.log("=".repeat(60));
    console.log(`Original CV count: ${originalCount}`);
    console.log(`New CVs processed: ${addedCount}`);
    console.log(`Total CV count: ${Object.keys(groundTruth).length}`);
    console.log(`Backup created: ${CONFIG.backupPath}`);
    console.log("✓ Process completed successfully!");

    console.log("\n📝 Next steps:");
    console.log("1. Review the results for any entries marked with errors");
    console.log(
      "2. Manually verify publications with conflicted status (verifiedStatus: null)"
    );
    console.log("3. Run accuracy analysis if desired");
  } catch (error) {
    console.error("\n❌ Error occurred:", error);
    console.log("\nTo restore from backup:");
    console.log(`  cp "${CONFIG.backupPath}" "${CONFIG.groundTruthPath}"`);

    // Try to save current progress
    try {
      if (typeof groundTruth !== "undefined") {
        await saveProgress(groundTruth, `add_cvs_error_${Date.now()}.json`);
        console.log("Current progress saved before exit.");
      }
    } catch (saveError) {
      console.error("Failed to save progress:", saveError.message);
    }

    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = {
  main,
  getCVIdentifier,
  processNewCVEntry,
  extractCandidateNameFromFilename,
  filterNewCVs,
};
