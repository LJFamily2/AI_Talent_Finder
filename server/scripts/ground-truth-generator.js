/**
 * Ground Truth Generator for CV Verification
 *
 * This script helps generate ground truth data for evaluating
 * CV verification methods. It processes a set of CVs using the
 * traditional verification method and outputs a JSON file that
 * can be manually reviewed and adjusted.
 *
 * After running this script, you should:
 * 1. Review the generated ground_truth.json file
 * 2. Manually correct any incorrect verifications
 * 3. Set "shouldBeVerified" and "correctAuthorMatch" flags based on your knowledge
 *
 * @author AI Talent Finder Team
 * @version 1.0.0
 */

// =================== CONSTANTS & IMPORTS ===================
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

// Load environment variables
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const writeFileAsync = promisify(fs.writeFile);
const traditionalVerifier = require("../controllers/cvVerificationController");
const geminiVerifier = require("../controllers/geminiAICvVerificationController");
const { extractTextFromPDF } = require("../utils/pdfUtils");
const {
  compareVerificationResults,
  getCVFiles,
  getCVIdentifier,
  normalizeTitle,
} = require("../utils/groundTruthUtils");

const config = {
  cvDir: path.join(__dirname, "../data/training/cvsamples"),
  outputPath: path.join(__dirname, "../data/ground_truth.json"),
  sampleSize: 100,
  useHybridApproach: true,
};

module.exports = {
  generateGroundTruth,
};

// =================== MAIN FUNCTION ===================
async function generateGroundTruth() {
  console.log("Hybrid Ground Truth Generator");
  console.log("============================");

  const cvFiles = await getCVFiles(config.cvDir, config.sampleSize);
  console.log(`Found ${cvFiles.length} CV files to process`);
  const groundTruth = {};

  // Function to save current progress
  const saveProgress = async (
    data,
    filename = "ground_truth_progress.json"
  ) => {
    try {
      const progressPath = path.join(__dirname, "../data", filename);
      await writeFileAsync(progressPath, JSON.stringify(data, null, 2), "utf8");
      console.log(`  💾 Progress saved to: ${progressPath}`);
    } catch (error) {
      console.error(`  ❌ Failed to save progress: ${error.message}`);
    }
  };

  // Handle unexpected termination
  const handleTermination = async (signal) => {
    console.log(`\n🚨 Received ${signal}. Saving current progress...`);
    await saveProgress(
      groundTruth,
      `ground_truth_interrupted_${Date.now()}.json`
    );
    console.log("Progress saved. Exiting...");
    process.exit(0);
  };

  process.on("SIGINT", handleTermination);
  process.on("SIGTERM", handleTermination);
  process.on("uncaughtException", async (error) => {
    console.error("\n🚨 Uncaught Exception:", error);
    await saveProgress(groundTruth, `ground_truth_error_${Date.now()}.json`);
    process.exit(1);
  });
  process.on("unhandledRejection", async (reason, promise) => {
    console.error("\n🚨 Unhandled Rejection at:", promise, "reason:", reason);
    await saveProgress(
      groundTruth,
      `ground_truth_rejection_${Date.now()}.json`
    );
    process.exit(1);
  });

  for (let i = 0; i < cvFiles.length; i++) {
    const cvFile = cvFiles[i];
    const cvId = getCVIdentifier(cvFile.path);
    console.log(
      `\nProcessing CV ${i + 1}/${cvFiles.length}: ${path.basename(
        cvFile.path
      )} (${(cvFile.size / 1024).toFixed(1)}KB)`
    );
    try {
      const cvText = await extractTextFromPDF(cvFile.path);
      const cvTextSize = cvText.length;
      console.log(`  CV text size: ${cvTextSize} characters`);

      // Run both verification methods to compare results
      console.log("  Running both AI (Gemini) and traditional verification...");
      const [geminiResult, traditionalResult] = await Promise.all([
        geminiVerifier.verifyCVWithAI(cvFile).catch((err) => {
          console.log(`    Gemini verification failed: ${err.message}`);
          return null;
        }),
        traditionalVerifier.verifyCV(cvFile).catch((err) => {
          console.log(`    Traditional verification failed: ${err.message}`);
          return null;
        }),
      ]);

      // Always use both approaches and compare results
      let result, method;
      if (geminiResult && traditionalResult) {
        console.log(
          "  Both AI (Gemini) and Traditional verification succeeded - using hybrid approach"
        );
        method = "hybrid";
        result = traditionalResult; // Use traditional as primary for consistency, but will compare both
      } else if (geminiResult) {
        console.log("  Only AI (Gemini) verification succeeded");
        method = "gemini_ai";
        result = geminiResult;
      } else if (traditionalResult) {
        console.log("  Only Traditional verification succeeded");
        method = "traditional";
        result = traditionalResult;
      } else {
        throw new Error("Both verification methods failed");
      }
      // Compare results between methods and flag conflicts for manual review
      let conflictedPublications = [];
      if (geminiResult && traditionalResult) {
        console.log("  Comparing AI vs Traditional verification results...");
        const comparisonResults = compareVerificationResults(
          geminiResult,
          traditionalResult
        );
        conflictedPublications = comparisonResults.filter((r) => r.hasConflict);

        if (conflictedPublications.length > 0) {
          console.log(
            `  ⚠️  Found ${conflictedPublications.length} status conflicts between methods`
          );
        }
      }

      // Simplified publications structure
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

      groundTruth[cvId] = {
        candidateName: result.candidateName || "Unknown",
        cvSize: cvTextSize,
        publications: publications,
      };
      console.log(
        `  ✓ Processed with ${groundTruth[cvId].publications.length} publications`
      );

      // Save progress every 10 CVs
      if ((i + 1) % 10 === 0) {
        await saveProgress(groundTruth, `ground_truth_progress_${i + 1}.json`);
      }

      // Log conflicts for console output (but don't store in JSON)
      if (conflictedPublications.length > 0) {
        console.log(
          `  ⚠️  ${conflictedPublications.length} publications have status conflicts (set to null)`
        );
      }
    } catch (error) {
      console.error(`  ✗ Error processing CV: ${error.message}`);
      // Save progress even on error
      await saveProgress(
        groundTruth,
        `ground_truth_error_cv_${i + 1}_${Date.now()}.json`
      );
    }
    // Add a 15 second delay between each CV
    if (i < cvFiles.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 6000));
    }
  }

  // Save final progress
  await saveProgress(groundTruth, "ground_truth_final.json");

  await writeFileAsync(
    config.outputPath,
    JSON.stringify(groundTruth, null, 2),
    "utf8"
  );
}

// =================== ENTRY POINT ===================
if (require.main === module) {
  generateGroundTruth().catch((err) => {
    console.error("Error generating ground truth:", err);
    process.exit(1);
  });
}
