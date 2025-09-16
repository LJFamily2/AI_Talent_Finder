/**
 * CV Verification Results Analysis with Ground Truth
 *
 * Analyzes raw verification results against ground truth data to calculate
 * accuracy metrics and generate comparative analysis reports.
 *
 * This script works with output from enhanced-cv-verification-comparison.js
 * and add_cvs_final.json to provide accuracy assessment.
 *
 * Features:
 * - Accuracy metrics (precision, recall, F1 score)
 * - Verification accuracy analysis
 * - Publication count accuracy
 * - Method comparison with ground truth
 * - Enhanced reporting with accuracy insights
 */

const path = require("path");
const fs = require("fs").promises;

//=============================================================================
// CONFIGURATION
//=============================================================================

const CONFIG = {
  // Input paths
  resultsFile:
    "../comparison_results/raw_results_2025-09-09T05-28-17-333Z.json", // Update with actual timestamp
  groundTruthPath: "../data/add_cvs_final.json",

  // Output paths
  outputFolder: "../results",
  analysisFolder: "../analysis",

  // Analysis settings
  includeDetailedComparison: true,
  generateVisualizations: false, // Future feature
};

//=============================================================================
// UTILITY FUNCTIONS
//=============================================================================

/**
 * Load verification results from enhanced-cv-verification-comparison.js
 */
async function loadVerificationResults() {
  try {
    console.log(`📖 Loading verification results from: ${CONFIG.resultsFile}`);
    const data = await fs.readFile(CONFIG.resultsFile, "utf8");
    const parsed = JSON.parse(data);
    console.log(`✅ Loaded ${parsed.results.length} verification results`);
    return parsed;
  } catch (error) {
    console.error("❌ Error loading verification results:", error.message);
    if (error.code === "ENOENT") {
      console.error(`📁 File not found: ${CONFIG.resultsFile}`);
      console.error(`Please run enhanced-cv-verification-comparison.js first`);
    }
    throw error;
  }
}

/**
 * Load ground truth data
 */
async function loadGroundTruth() {
  try {
    console.log(`📖 Loading ground truth from: ${CONFIG.groundTruthPath}`);
    const data = await fs.readFile(CONFIG.groundTruthPath, "utf8");
    const parsed = JSON.parse(data);
    console.log(`✅ Loaded ground truth for ${Object.keys(parsed).length} CVs`);
    return parsed;
  } catch (error) {
    console.error("❌ Error loading ground truth:", error.message);
    if (error.code === "ENOENT") {
      console.error(`📁 File not found: ${CONFIG.groundTruthPath}`);
      console.error(`Please ensure the ground truth file exists.`);
    }
    throw error;
  }
}

/**
 * Ensure output directories exist
 */
async function ensureOutputDirectories() {
  try {
    await fs.mkdir(CONFIG.outputFolder, { recursive: true });
    await fs.mkdir(CONFIG.analysisFolder, { recursive: true });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}

//=============================================================================
// ACCURACY ANALYSIS FUNCTIONS
//=============================================================================

/**
 * Calculate accuracy metrics against ground truth
 */
function calculateAccuracyMetrics(results, groundTruth) {
  const gtPublications = groundTruth.publications || [];

  // Since we only have summary data, not individual publications,
  // we'll calculate metrics based on available summary statistics
  const detectedCount = results.totalPublications || 0;
  const actualCount = gtPublications.length;
  const verifiedCount = results.verifiedPublications || 0;
  const verifiedWithAuthorCount = results.verifiedWithAuthorMatch || 0;

  // Publication count accuracy
  const publicationCountAccuracy =
    actualCount === 0 && detectedCount === 0
      ? 1.0 // Perfect match when both are 0
      : actualCount === 0
      ? 0.0 // Ground truth has 0 but detected some
      : 1 -
        Math.abs(detectedCount - actualCount) /
          Math.max(detectedCount, actualCount, 1);

  // For CVs with no publications in ground truth
  if (actualCount === 0) {
    return {
      precision: detectedCount === 0 ? 1.0 : 0.0,
      recall: 1.0, // Can't miss what doesn't exist
      f1Score: detectedCount === 0 ? 1.0 : 0.0,
      verificationAccuracy: detectedCount === 0 ? 1.0 : 0.0,
      publicationCountAccuracy,
      truePositives: 0,
      falsePositives: detectedCount,
      falseNegatives: 0,
      detectedCount,
      actualCount,
    };
  }

  // Count ground truth verified publications
  const gtVerifiedCount = gtPublications.filter(
    (pub) => pub.verifiedStatus === true
  ).length;

  // Since we don't have individual publication matching data,
  // we'll use a simplified approach based on counts

  // Assume verification accuracy is proportional to verified publications
  // This is a limitation of the current data structure
  const verificationRate =
    detectedCount > 0 ? verifiedCount / detectedCount : 0;
  const expectedVerificationRate =
    actualCount > 0 ? gtVerifiedCount / actualCount : 0;

  // Simplified metrics based on count comparison
  const precision =
    detectedCount > 0
      ? Math.min(verifiedCount, gtVerifiedCount) / detectedCount
      : 0;
  const recall =
    gtVerifiedCount > 0
      ? Math.min(verifiedCount, gtVerifiedCount) / gtVerifiedCount
      : 0;
  const f1Score =
    precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : 0;

  // Verification accuracy based on how close the verification rates are
  const verificationAccuracy =
    1 - Math.abs(verificationRate - expectedVerificationRate);

  return {
    precision,
    recall,
    f1Score,
    verificationAccuracy,
    publicationCountAccuracy,
    truePositives: Math.min(verifiedCount, gtVerifiedCount),
    falsePositives: Math.max(0, verifiedCount - gtVerifiedCount),
    falseNegatives: Math.max(0, gtVerifiedCount - verifiedCount),
    detectedCount,
    actualCount,
  };
}

/**
 * Enhance results with accuracy metrics
 */
function enhanceResultsWithAccuracy(verificationResults, groundTruthData) {
  const enhancedResults = verificationResults.results.map((result) => {
    const groundTruth = groundTruthData[result.cvName];

    if (!groundTruth) {
      console.warn(`⚠️  No ground truth found for CV: ${result.cvName}`);
      return {
        ...result,
        accuracy: null,
        groundTruthSize: null,
        groundTruthPublications: null,
      };
    }

    const accuracyMetrics = calculateAccuracyMetrics(result, groundTruth);

    return {
      ...result,
      accuracy: accuracyMetrics,
      groundTruthSize: groundTruth.cvSize,
      groundTruthPublications: groundTruth.publications.length,
    };
  });

  return {
    ...verificationResults,
    results: enhancedResults,
  };
}

/**
 * Generate enhanced summary statistics with accuracy
 */
function generateEnhancedSummaryStats(enhancedResults) {
  const stats = {};

  // Group by method
  const methodGroups = {};
  enhancedResults.results.forEach((result) => {
    if (!methodGroups[result.methodKey]) {
      methodGroups[result.methodKey] = [];
    }
    methodGroups[result.methodKey].push(result);
  });

  // Calculate stats for each method
  Object.entries(methodGroups).forEach(([methodKey, results]) => {
    const successfulResults = results.filter((r) => r.success);
    const total = results.length;
    const successful = successfulResults.length;

    stats[methodKey] = {
      method: results[0]?.method || methodKey,
      totalTests: total,
      successfulTests: successful,
      completionRate: successful / total,

      // Performance
      avgProcessingTime:
        successful > 0
          ? successfulResults.reduce((sum, r) => sum + r.processingTime, 0) /
            successful
          : null,

      // Accuracy (only for results with accuracy data)
      avgPrecision:
        successfulResults.filter(
          (r) => r.accuracy && r.accuracy.precision !== null
        ).length > 0
          ? successfulResults
              .filter((r) => r.accuracy && r.accuracy.precision !== null)
              .reduce((sum, r) => sum + r.accuracy.precision, 0) /
            successfulResults.filter(
              (r) => r.accuracy && r.accuracy.precision !== null
            ).length
          : null,

      avgRecall:
        successfulResults.filter(
          (r) => r.accuracy && r.accuracy.recall !== null
        ).length > 0
          ? successfulResults
              .filter((r) => r.accuracy && r.accuracy.recall !== null)
              .reduce((sum, r) => sum + r.accuracy.recall, 0) /
            successfulResults.filter(
              (r) => r.accuracy && r.accuracy.recall !== null
            ).length
          : null,

      avgF1Score:
        successfulResults.filter(
          (r) => r.accuracy && r.accuracy.f1Score !== null
        ).length > 0
          ? successfulResults
              .filter((r) => r.accuracy && r.accuracy.f1Score !== null)
              .reduce((sum, r) => sum + r.accuracy.f1Score, 0) /
            successfulResults.filter(
              (r) => r.accuracy && r.accuracy.f1Score !== null
            ).length
          : null,

      avgVerificationAccuracy:
        successfulResults.filter(
          (r) => r.accuracy && r.accuracy.verificationAccuracy !== null
        ).length > 0
          ? successfulResults
              .filter(
                (r) => r.accuracy && r.accuracy.verificationAccuracy !== null
              )
              .reduce((sum, r) => sum + r.accuracy.verificationAccuracy, 0) /
            successfulResults.filter(
              (r) => r.accuracy && r.accuracy.verificationAccuracy !== null
            ).length
          : null,

      avgPublicationCountAccuracy:
        successfulResults.filter(
          (r) => r.accuracy && r.accuracy.publicationCountAccuracy !== null
        ).length > 0
          ? successfulResults
              .filter(
                (r) =>
                  r.accuracy && r.accuracy.publicationCountAccuracy !== null
              )
              .reduce(
                (sum, r) => sum + r.accuracy.publicationCountAccuracy,
                0
              ) /
            successfulResults.filter(
              (r) => r.accuracy && r.accuracy.publicationCountAccuracy !== null
            ).length
          : null,

      // Quality
      avgLinkProvisionRate:
        successful > 0
          ? successfulResults.reduce(
              (sum, r) => sum + (r.quality?.linkProvisionRate || 0),
              0
            ) / successful
          : null,

      avgMetadataRichness:
        successful > 0
          ? successfulResults.reduce(
              (sum, r) => sum + (r.quality?.metadataRichness || 0),
              0
            ) / successful
          : null,

      // Token usage
      totalInputTokens: successfulResults.reduce(
        (sum, r) => sum + (r.tokenUsage?.inputTokens || 0),
        0
      ),
      totalOutputTokens: successfulResults.reduce(
        (sum, r) => sum + (r.tokenUsage?.outputTokens || 0),
        0
      ),
      totalApiCalls: successfulResults.reduce(
        (sum, r) => sum + (r.tokenUsage?.apiCalls || 0),
        0
      ),
      avgInputTokens:
        successful > 0
          ? successfulResults.reduce(
              (sum, r) => sum + (r.tokenUsage?.inputTokens || 0),
              0
            ) / successful
          : null,
      avgOutputTokens:
        successful > 0
          ? successfulResults.reduce(
              (sum, r) => sum + (r.tokenUsage?.outputTokens || 0),
              0
            ) / successful
          : null,
    };
  });

  return stats;
}

//=============================================================================
// EXPORT FUNCTIONS
//=============================================================================

/**
 * Export enhanced results with accuracy analysis
 */
async function exportEnhancedResults(enhancedResults, summaryStats) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  // Detailed CSV with accuracy metrics
  const detailedHeaders = [
    "CV Name",
    "Method",
    "Success",
    "Processing Time (ms)",
    "Time Per Publication (ms)",
    "Total Publications",
    "Verified Publications",
    "Verified With Author Match",
    "Precision",
    "Recall",
    "F1 Score",
    "Verification Accuracy",
    "Publication Count Accuracy",
    "Link Provision Rate",
    "Citation Count Availability",
    "Metadata Richness",
    "Input Tokens",
    "Output Tokens",
    "Total Tokens",
    "API Calls",
    "Ground Truth CV Size",
    "Ground Truth Publications",
    "Error",
  ];

  const detailedRows = enhancedResults.results.map((result) => [
    result.cvName,
    result.method,
    result.success,
    result.processingTime?.toFixed(2) || "",
    result.timePerPublication?.toFixed(2) || "",
    result.totalPublications || "",
    result.verifiedPublications || "",
    result.verifiedWithAuthorMatch || "",
    result.accuracy?.precision?.toFixed(3) || "",
    result.accuracy?.recall?.toFixed(3) || "",
    result.accuracy?.f1Score?.toFixed(3) || "",
    result.accuracy?.verificationAccuracy?.toFixed(3) || "",
    result.accuracy?.publicationCountAccuracy?.toFixed(3) || "",
    result.quality?.linkProvisionRate?.toFixed(3) || "",
    result.quality?.citationCountAvailability?.toFixed(3) || "",
    result.quality?.metadataRichness?.toFixed(3) || "",
    result.tokenUsage?.inputTokens || "",
    result.tokenUsage?.outputTokens || "",
    result.tokenUsage?.totalTokens || "",
    result.tokenUsage?.apiCalls || "",
    result.groundTruthSize || "",
    result.groundTruthPublications || "",
    result.error || "",
  ]);

  const detailedCSV = [detailedHeaders, ...detailedRows]
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");

  // Enhanced summary CSV
  const summaryHeaders = [
    "Method",
    "Total Tests",
    "Successful Tests",
    "Completion Rate",
    "Avg Processing Time (ms)",
    "Avg Precision",
    "Avg Recall",
    "Avg F1 Score",
    "Avg Verification Accuracy",
    "Avg Publication Count Accuracy",
    "Avg Link Provision Rate",
    "Avg Metadata Richness",
    "Total Input Tokens",
    "Total Output Tokens",
    "Total API Calls",
  ];

  const summaryRows = Object.values(summaryStats).map((stat) => [
    stat.method,
    stat.totalTests,
    stat.successfulTests,
    stat.completionRate?.toFixed(3) || "",
    stat.avgProcessingTime?.toFixed(2) || "",
    stat.avgPrecision?.toFixed(3) || "",
    stat.avgRecall?.toFixed(3) || "",
    stat.avgF1Score?.toFixed(3) || "",
    stat.avgVerificationAccuracy?.toFixed(3) || "",
    stat.avgPublicationCountAccuracy?.toFixed(3) || "",
    stat.avgLinkProvisionRate?.toFixed(3) || "",
    stat.avgMetadataRichness?.toFixed(3) || "",
    stat.totalInputTokens || "",
    stat.totalOutputTokens || "",
    stat.totalApiCalls || "",
  ]);

  const summaryCSV = [summaryHeaders, ...summaryRows]
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");

  // Write files
  await fs.writeFile(
    path.join(
      CONFIG.analysisFolder,
      `enhanced_detailed_results_${timestamp}.csv`
    ),
    detailedCSV
  );

  await fs.writeFile(
    path.join(CONFIG.analysisFolder, `enhanced_summary_stats_${timestamp}.csv`),
    summaryCSV
  );

  await fs.writeFile(
    path.join(CONFIG.analysisFolder, `enhanced_results_${timestamp}.json`),
    JSON.stringify({ results: enhancedResults, summary: summaryStats }, null, 2)
  );

  console.log(`\nEnhanced results exported to ${CONFIG.analysisFolder}:`);
  console.log(`- enhanced_detailed_results_${timestamp}.csv`);
  console.log(`- enhanced_summary_stats_${timestamp}.csv`);
  console.log(`- enhanced_results_${timestamp}.json`);
}

//=============================================================================
// MAIN ANALYSIS EXECUTION
//=============================================================================

async function runAnalysis() {
  console.log("=".repeat(80));
  console.log("📊 CV VERIFICATION RESULTS ANALYSIS WITH GROUND TRUTH");
  console.log("=".repeat(80));

  try {
    await ensureOutputDirectories();

    // Load data
    const verificationResults = await loadVerificationResults();
    const groundTruthData = await loadGroundTruth();

    // Enhance results with accuracy metrics
    console.log("\n=== CALCULATING ACCURACY METRICS ===");
    const enhancedResults = enhanceResultsWithAccuracy(
      verificationResults,
      groundTruthData
    );

    // Generate enhanced summary statistics
    console.log("\n=== GENERATING ENHANCED SUMMARY ===");
    const summaryStats = generateEnhancedSummaryStats(enhancedResults);

    // Display summary with accuracy
    console.log("\n=== ENHANCED RESULTS SUMMARY ===");
    Object.entries(summaryStats).forEach(([method, stats]) => {
      console.log(`\n${stats.method}:`);
      console.log(
        `  Completion Rate: ${(stats.completionRate * 100).toFixed(1)}%`
      );
      console.log(
        `  Avg Processing Time: ${stats.avgProcessingTime?.toFixed(0)}ms`
      );
      console.log(
        `  Avg Precision: ${stats.avgPrecision?.toFixed(3) || "N/A"}`
      );
      console.log(`  Avg Recall: ${stats.avgRecall?.toFixed(3) || "N/A"}`);
      console.log(`  Avg F1 Score: ${stats.avgF1Score?.toFixed(3) || "N/A"}`);
      console.log(
        `  Avg Verification Accuracy: ${
          stats.avgVerificationAccuracy?.toFixed(3) || "N/A"
        }`
      );
      console.log(
        `  Avg Publication Count Accuracy: ${
          stats.avgPublicationCountAccuracy?.toFixed(3) || "N/A"
        }`
      );
      console.log(
        `  Avg Link Provision: ${(stats.avgLinkProvisionRate * 100)?.toFixed(
          1
        )}%`
      );
    });

    // Export enhanced results
    console.log("\n💾 === EXPORTING ENHANCED RESULTS ===");
    await exportEnhancedResults(enhancedResults, summaryStats);

    console.log("\n🎉 === ANALYSIS COMPLETE ===");
    console.log(`📊 Total results analyzed: ${enhancedResults.results.length}`);
    console.log(
      `✅ Results with ground truth: ${
        enhancedResults.results.filter((r) => r.accuracy !== null).length
      }`
    );
  } catch (error) {
    console.error("\n❌ === ANALYSIS FAILED ===");
    console.error(`💥 Error: ${error.message}`);

    if (error.stack) {
      console.error("\n📋 Stack trace:");
      console.error(error.stack);
    }

    throw error;
  }
}

//=============================================================================
// SCRIPT EXECUTION
//=============================================================================

if (require.main === module) {
  runAnalysis()
    .then(() => {
      console.log("\n✓ Analysis completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n✗ Analysis failed:", error);
      process.exit(1);
    });
}

module.exports = {
  runAnalysis,
  calculateAccuracyMetrics,
  enhanceResultsWithAccuracy,
  generateEnhancedSummaryStats,
};
