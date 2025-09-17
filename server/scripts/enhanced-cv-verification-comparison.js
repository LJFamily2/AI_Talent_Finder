/**
 * Enhanced CV Verification Comparison Test Harness
 *
 * Compares all CV verification approaches by collecting verification data
 * from all enabled methods. No ground truth required - focuses on data collection.
 *
 * Methods tested:
 * - Traditional CV verification (ML + header detection)
 * - Gemini AI verification
 * - Claude AI verification
 * - ChatGPT AI verification
 * - Grok AI verification
 *
 * Features:
 * - Raw data collection without accuracy comparisons
 * - Quality metrics (link provision, citation availability, metadata richness)
 * - Token usage tracking for AI methods
 * - Performance metrics (processing time, success rates)
 * - Progress backup and error recovery
 * - Detailed CSV and JSON export
 */

const path = require("path");
const fs = require("fs").promises;
const { performance } = require("perf_hooks");

// Load environment variables
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// Import verification controllers
const {
  verifyCV: traditionalVerify,
} = require("../controllers/cvVerificationController");
const {
  verifyCVWithAI: geminiVerify,
} = require("../controllers/geminiAICvVerificationController");
const {
  verifyCVWithClaude: claudeVerify,
} = require("../controllers/claudeAICvVerificationController");
const {
  verifyCVWithChatGPT: chatgptVerify,
} = require("../controllers/chatGPTAICvVerificationController");
const {
  verifyCVWithGrok: grokVerify,
} = require("../controllers/grokAICvVerificationController");

//=============================================================================
// CONFIGURATION
//=============================================================================

const CONFIG = {
  // Paths
  testCvsFolder: path.join(__dirname, "../data/test_cvs"),
  resultsFolder: path.join(__dirname, "../comparison_results"),

  // Backup and recovery
  backupFolder: path.join(__dirname, "../comparison_backups"),
  saveProgressInterval: 5, // Save progress every 5 CVs

  // Rate limiting
  delayBetweenRequests: 3000, // 3 seconds
  delayBetweenBatches: 15000, // 15 seconds
  batchSize: 3,
  maxRetries: 3, // Increased retries
  timeoutMs: 300000, // 5 minutes

  // Error handling
  /* The above code is a comment block in JavaScript. The `continueOnError` and ` */
  continueOnError: true, // Don't stop entire process on single CV failure
  maxConsecutiveErrors: 5, // Stop if too many consecutive errors

  // Methods to test
  verificationMethods: {
    traditional: { name: "Traditional", fn: traditionalVerify, enabled: true },
    gemini: { name: "Gemini AI", fn: geminiVerify, enabled: true },
    claude: { name: "Claude AI", fn: claudeVerify, enabled: true },
    chatgpt: { name: "ChatGPT AI", fn: chatgptVerify, enabled: true },
    grok: { name: "Grok AI", fn: grokVerify, enabled: true },
  },
};

//=============================================================================
// UTILITY FUNCTIONS
//=============================================================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureResultsDirectory() {
  try {
    await fs.mkdir(CONFIG.resultsFolder, { recursive: true });
    await fs.mkdir(CONFIG.backupFolder, { recursive: true });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}

/**
 * Save progress incrementally to prevent data loss
 */
async function saveProgressBackup(results, batchNumber) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(
      CONFIG.backupFolder,
      `progress_batch_${batchNumber}_${timestamp}.json`
    );
    await fs.writeFile(backupPath, JSON.stringify(results, null, 2));
    console.log(`  💾 Progress saved to: ${path.basename(backupPath)}`);
  } catch (error) {
    console.warn(`⚠️  Failed to save progress backup: ${error.message}`);
  }
}

/**
 * Load previous progress if exists
 */
async function loadPreviousProgress() {
  try {
    const backupFiles = await fs.readdir(CONFIG.backupFolder);
    const progressFiles = backupFiles
      .filter((file) => file.startsWith("progress_batch_"))
      .sort()
      .reverse(); // Get most recent first

    if (progressFiles.length > 0) {
      const latestFile = path.join(CONFIG.backupFolder, progressFiles[0]);
      const data = await fs.readFile(latestFile, "utf8");
      console.log(`📁 Found previous progress: ${progressFiles[0]}`);
      return JSON.parse(data);
    }
  } catch (error) {
    console.log(`📝 No previous progress found, starting fresh`);
  }
  return null;
}

async function getCVFiles() {
  try {
    console.log(`📖 Scanning CV files in: ${CONFIG.testCvsFolder}`);
    const files = await fs.readdir(CONFIG.testCvsFolder);
    const cvFiles = files
      .filter((file) => file.endsWith(".pdf"))
      .map((file) => ({
        name: file.replace(".pdf", ""),
        path: path.join(CONFIG.testCvsFolder, file),
      }));

    console.log(`✅ Found ${cvFiles.length} CV files`);
    return cvFiles;
  } catch (error) {
    console.error("❌ Error scanning CV files:", error.message);
    throw error;
  }
}

/**
 * Find CV file for a given ground truth name with enhanced error handling
 */
async function findCvFile(cvName) {
  const possiblePaths = [
    // Prefer flat structure first
    path.join(CONFIG.testCvsFolder, `${cvName}.pdf`),
    // Fallback to folder structure for backward compatibility
    path.join(CONFIG.testCvsFolder, cvName, `${cvName}.pdf`),
    path.join(CONFIG.testCvsFolder, cvName, "cv.pdf"),
    path.join(CONFIG.testCvsFolder, cvName, "resume.pdf"),
  ];

  for (const filePath of possiblePaths) {
    try {
      await fs.access(filePath);
      // Verify file is readable and not empty
      const stats = await fs.stat(filePath);
      if (stats.size > 0) {
        return filePath;
      } else {
        console.warn(`⚠️  File ${filePath} is empty, skipping`);
      }
    } catch (error) {
      continue;
    }
  }

  return null;
}

/**
 * Calculate accuracy metrics against ground truth
 */
function calculateAccuracyMetrics(results, groundTruth) {
  const gtPublications = groundTruth.publications || [];
  const resultPublications = results.results || [];

  if (gtPublications.length === 0) {
    return {
      precision: null,
      recall: null,
      f1Score: null,
      verificationAccuracy: null,
      publicationCountAccuracy: resultPublications.length === 0 ? 1 : 0,
    };
  }

  // Publication count accuracy
  const detectedCount = resultPublications.length;
  const actualCount = gtPublications.length;
  const publicationCountAccuracy =
    1 -
    Math.abs(detectedCount - actualCount) /
      Math.max(detectedCount, actualCount, 1);

  // Verification accuracy (position-based comparison)
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let totalComparisons = 0;

  const comparisonCount = Math.min(detectedCount, actualCount);

  for (let i = 0; i < comparisonCount; i++) {
    const gtVerified = gtPublications[i]?.verifiedStatus === true;
    const resultVerified =
      resultPublications[i]?.verification?.displayData?.status === "verified";

    if (gtVerified && resultVerified) {
      truePositives++;
    } else if (!gtVerified && resultVerified) {
      falsePositives++;
    } else if (gtVerified && !resultVerified) {
      falseNegatives++;
    }
    totalComparisons++;
  }

  // Calculate metrics
  const precision =
    truePositives + falsePositives > 0
      ? truePositives / (truePositives + falsePositives)
      : null;
  const recall =
    truePositives + falseNegatives > 0
      ? truePositives / (truePositives + falseNegatives)
      : null;
  const f1Score =
    precision && recall
      ? (2 * (precision * recall)) / (precision + recall)
      : null;
  const verificationAccuracy =
    totalComparisons > 0
      ? (truePositives +
          (comparisonCount - truePositives - falsePositives - falseNegatives)) /
        totalComparisons
      : null;

  return {
    precision,
    recall,
    f1Score,
    verificationAccuracy,
    publicationCountAccuracy,
    truePositives,
    falsePositives,
    falseNegatives,
    detectedCount,
    actualCount,
  };
}

/**
 * Calculate quality metrics
 */
function calculateQualityMetrics(results) {
  const publications = results.results || [];

  if (publications.length === 0) {
    return {
      linkProvisionRate: 0,
      citationCountAvailability: 0,
      metadataRichness: 0,
    };
  }

  const withLinks = publications.filter(
    (pub) =>
      pub.verification?.link ||
      pub.verification?.displayData?.link ||
      pub.verification?.googleScholar?.link
  ).length;

  const withCitations = publications.filter(
    (pub) =>
      pub.verification?.citations !== undefined ||
      pub.verification?.displayData?.citations !== undefined
  ).length;

  // Average metadata richness
  const metadataFields = ["year", "venue", "doi", "authors", "title"];
  const totalMetadataScore = publications.reduce((sum, pub) => {
    const availableFields = metadataFields.filter(
      (field) =>
        pub[field] ||
        pub.verification?.[field] ||
        pub.verification?.displayData?.[field]
    ).length;
    return sum + availableFields / metadataFields.length;
  }, 0);

  return {
    linkProvisionRate: withLinks / publications.length,
    citationCountAvailability: withCitations / publications.length,
    metadataRichness: totalMetadataScore / publications.length,
  };
}

/**
 * Extract token usage from verification results
 */
function extractTokenUsage(method, results) {
  const publicationCount = results.results?.length || 0;

  // Try to extract actual token usage from results
  let inputTokens = 0;
  let outputTokens = 0;
  let apiCalls = 0;

  if (method === "traditional") {
    // Traditional method combines ML model + AI requests, so it does use tokens
    // Try to extract actual token usage from results
    if (results.tokenUsage) {
      inputTokens = results.tokenUsage.inputTokens || 0;
      outputTokens = results.tokenUsage.outputTokens || 0;
      apiCalls = results.tokenUsage.apiCalls || 0;
    } else if (results.usage) {
      inputTokens =
        results.usage.prompt_tokens || results.usage.input_tokens || 0;
      outputTokens =
        results.usage.completion_tokens || results.usage.output_tokens || 0;
      apiCalls = results.usage.api_calls || publicationCount * 2; // Fallback estimate
    } else {
      // Fallback: estimate tokens for ML model + AI processing
      const estimatedTokensPerPub = 300; // Lower than pure AI since ML helps
      inputTokens = publicationCount * estimatedTokensPerPub * 0.6; // 60% input
      outputTokens = publicationCount * estimatedTokensPerPub * 0.4; // 40% output
      apiCalls = publicationCount * 2; // ML processing + AI verification per publication
    }

    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      apiCalls,
      publicationCount,
    };
  }

  // For AI methods, try to extract actual token usage from response
  if (results.tokenUsage) {
    inputTokens = results.tokenUsage.inputTokens || 0;
    outputTokens = results.tokenUsage.outputTokens || 0;
    apiCalls = results.tokenUsage.apiCalls || 0;
  } else if (results.usage) {
    // Alternative format
    inputTokens =
      results.usage.prompt_tokens || results.usage.input_tokens || 0;
    outputTokens =
      results.usage.completion_tokens || results.usage.output_tokens || 0;
    apiCalls = results.usage.api_calls || Math.ceil(publicationCount / 5);
  } else {
    // Fallback: estimate tokens based on publication count
    const estimatedTokensPerPub = 500; // Conservative estimate
    inputTokens = publicationCount * estimatedTokensPerPub * 0.7; // Assume 70% input
    outputTokens = publicationCount * estimatedTokensPerPub * 0.3; // Assume 30% output
    apiCalls = Math.ceil(publicationCount / 5);
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    apiCalls,
    publicationCount,
  };
}

//=============================================================================
// TESTING FUNCTIONS
//=============================================================================

/**
 * Test a single CV with one verification method
 */
async function testSingleCV(cvName, cvPath, method, methodKey, retryCount = 0) {
  console.log(`  Testing ${method.name}...`);

  const startTime = performance.now();
  let error = null;
  let results = null;

  try {
    const fileObj = { path: cvPath };

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), CONFIG.timeoutMs)
    );

    const verificationPromise = method.fn(fileObj);
    results = await Promise.race([verificationPromise, timeoutPromise]);
  } catch (err) {
    error = err;
    console.error(`    ❌ Error: ${err.message}`);

    // Log specific error types
    if (err.message.includes("ENOENT")) {
      console.error(
        `    📁 File access error - file may have been deleted or moved`
      );
    } else if (err.message.includes("timeout") || err.message === "Timeout") {
      console.error(`    ⏱️  Operation timed out after ${CONFIG.timeoutMs}ms`);
    } else if (err.message.includes("API") || err.message.includes("quota")) {
      console.error(`    🔑 API error - check rate limits or credentials`);
    } else if (err.message.includes("JSON") || err.message.includes("parse")) {
      console.error(`    📄 Data parsing error - response format issue`);
    }

    if (retryCount < CONFIG.maxRetries && err.message !== "Timeout") {
      const retryDelay = CONFIG.delayBetweenRequests * Math.pow(2, retryCount); // Exponential backoff
      console.log(
        `    🔄 Retrying in ${retryDelay}ms (${retryCount + 1}/${
          CONFIG.maxRetries
        })...`
      );
      await sleep(retryDelay);
      return testSingleCV(cvName, cvPath, method, methodKey, retryCount + 1);
    } else {
      console.error(
        `    ❌ Max retries (${CONFIG.maxRetries}) exceeded for ${method.name}`
      );
    }
  }

  const endTime = performance.now();
  const processingTime = endTime - startTime;

  // Calculate quality metrics (accuracy metrics removed - no ground truth)
  const qualityMetrics = results ? calculateQualityMetrics(results) : null;
  const tokenUsage = extractTokenUsage(methodKey, results || {});

  return {
    cvName,
    method: method.name,
    methodKey,
    success: !error,
    error: error?.message || null,
    processingTime,

    // Results data
    candidateName: results?.candidateName,
    totalPublications: results?.total || 0,
    verifiedPublications: results?.verifiedPublications || 0,
    verifiedWithAuthorMatch: results?.verifiedWithAuthorMatch || 0,

    // Performance metrics
    totalProcessingTime: processingTime,
    timePerPublication:
      results?.results?.length > 0
        ? processingTime / results.results.length
        : null,

    // Quality metrics
    quality: qualityMetrics,

    // Token usage metrics
    tokenUsage: tokenUsage,

    timestamp: new Date().toISOString(),
  };
}

/**
 * Test all methods on a single CV
 */
async function testAllMethodsOnCV(cvName) {
  console.log(`\n=== Testing CV: ${cvName} ===`);

  const cvPath = await findCvFile(cvName);
  if (!cvPath) {
    console.log(`  ✗ CV file not found`);
    return null;
  }

  console.log(`  ✓ Found CV at: ${cvPath}`);

  const results = [];

  for (const [methodKey, method] of Object.entries(
    CONFIG.verificationMethods
  )) {
    if (!method.enabled) continue;

    try {
      const result = await testSingleCV(cvName, cvPath, method, methodKey);
      results.push(result);

      if (result.success) {
        console.log(
          `    ✓ ${method.name}: ${result.processingTime.toFixed(0)}ms, ${
            result.totalPublications
          } pubs`
        );
      } else {
        console.log(`    ✗ ${method.name}: ${result.error}`);
      }

      await sleep(CONFIG.delayBetweenRequests);
    } catch (error) {
      console.error(`    ✗ ${method.name}: ${error.message}`);
      results.push({
        cvName,
        method: method.name,
        methodKey,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return results;
}

//=============================================================================
// BATCH PROCESSING
//=============================================================================

async function processCVBatch(cvBatch, batchNumber) {
  const batchResults = [];
  let consecutiveErrors = 0;

  for (let i = 0; i < cvBatch.length; i++) {
    const cvName = cvBatch[i];

    try {
      console.log(
        `\n📄 Processing CV ${i + 1}/${
          cvBatch.length
        } in batch ${batchNumber}: ${cvName}`
      );

      const cvResults = await testAllMethodsOnCV(cvName);

      if (cvResults && cvResults.length > 0) {
        batchResults.push(...cvResults);
        consecutiveErrors = 0; // Reset error counter on success
      } else {
        console.warn(`⚠️  No results for ${cvName}`);
        consecutiveErrors++;
      }
    } catch (error) {
      console.error(`❌ Error processing ${cvName}:`, error.message);
      consecutiveErrors++;

      if (!CONFIG.continueOnError) {
        throw error;
      }

      // Stop if too many consecutive errors (might indicate systemic issue)
      if (consecutiveErrors >= CONFIG.maxConsecutiveErrors) {
        console.error(
          `❌ Too many consecutive errors (${consecutiveErrors}). Stopping batch processing.`
        );
        console.error(
          `   This might indicate a systemic issue. Check your configuration and try again.`
        );
        break;
      }
    }

    // Save progress periodically
    if (
      (i + 1) % CONFIG.saveProgressInterval === 0 &&
      batchResults.length > 0
    ) {
      await saveProgressBackup(batchResults, `${batchNumber}_partial_${i + 1}`);
    }
  }

  return batchResults;
}

//=============================================================================
// RESULTS PROCESSING
//=============================================================================

function generateSummaryStats(allResults) {
  const stats = {};

  // Group by method
  const methodGroups = {};
  allResults.forEach((result) => {
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
      avgTimePerPublication:
        successful > 0
          ? successfulResults
              .filter((r) => r.timePerPublication)
              .reduce((sum, r) => sum + r.timePerPublication, 0) /
            successfulResults.filter((r) => r.timePerPublication).length
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
    };
  });

  return stats;
}

async function exportResults(allResults, summaryStats) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  // Detailed CSV
  const detailedHeaders = [
    "CV Name",
    "Method",
    "Success",
    "Processing Time (ms)",
    "Time Per Publication (ms)",
    "Total Publications",
    "Verified Publications",
    "Verified With Author Match",
    "Link Provision Rate",
    "Citation Count Availability",
    "Metadata Richness",
    "Input Tokens",
    "Output Tokens",
    "Total Tokens",
    "API Calls",
    "Error",
  ];

  const detailedRows = allResults.map((result) => [
    result.cvName,
    result.method,
    result.success,
    result.processingTime?.toFixed(2) || "",
    result.timePerPublication?.toFixed(2) || "",
    result.totalPublications || "",
    result.verifiedPublications || "",
    result.verifiedWithAuthorMatch || "",
    result.quality?.linkProvisionRate?.toFixed(3) || "",
    result.quality?.citationCountAvailability?.toFixed(3) || "",
    result.quality?.metadataRichness?.toFixed(3) || "",
    result.tokenUsage?.inputTokens || "",
    result.tokenUsage?.outputTokens || "",
    result.tokenUsage?.totalTokens || "",
    result.tokenUsage?.apiCalls || "",
    result.error || "",
  ]);

  const detailedCSV = [detailedHeaders, ...detailedRows]
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");

  // Summary CSV
  const summaryHeaders = [
    "Method",
    "Total Tests",
    "Successful Tests",
    "Completion Rate",
    "Avg Processing Time (ms)",
    "Avg Time Per Publication (ms)",
    "Avg Link Provision Rate",
    "Avg Metadata Richness",
    "Avg Input Tokens",
    "Avg Output Tokens",
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
    stat.avgTimePerPublication?.toFixed(2) || "",
    stat.avgLinkProvisionRate?.toFixed(3) || "",
    stat.avgMetadataRichness?.toFixed(3) || "",
    stat.avgInputTokens?.toFixed(0) || "",
    stat.avgOutputTokens?.toFixed(0) || "",
    stat.totalInputTokens || "",
    stat.totalOutputTokens || "",
    stat.totalApiCalls || "",
  ]);

  const summaryCSV = [summaryHeaders, ...summaryRows]
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");

  // Write files
  await fs.writeFile(
    path.join(CONFIG.resultsFolder, `detailed_results_${timestamp}.csv`),
    detailedCSV
  );

  await fs.writeFile(
    path.join(CONFIG.resultsFolder, `summary_stats_${timestamp}.csv`),
    summaryCSV
  );

  await fs.writeFile(
    path.join(CONFIG.resultsFolder, `raw_results_${timestamp}.json`),
    JSON.stringify({ results: allResults, summary: summaryStats }, null, 2)
  );

  console.log(`\nResults exported to ${CONFIG.resultsFolder}:`);
  console.log(`- detailed_results_${timestamp}.csv`);
  console.log(`- summary_stats_${timestamp}.csv`);
  console.log(`- raw_results_${timestamp}.json`);
}

//=============================================================================
// MAIN EXECUTION
//=============================================================================

async function runComparison() {
  console.log("=".repeat(80));
  console.log("🔍 CV VERIFICATION METHODS COMPARISON");
  console.log("=".repeat(80));

  let allResults = [];
  let startTime = new Date();

  try {
    await ensureResultsDirectory();

    // Check for previous progress
    const previousProgress = await loadPreviousProgress();
    if (previousProgress && previousProgress.length > 0) {
      const continueChoice =
        process.argv.includes("--continue") || process.argv.includes("-c");
      if (continueChoice) {
        console.log(
          `🔄 Continuing from previous progress with ${previousProgress.length} results`
        );
        allResults = previousProgress;
      }
    }

    const cvFiles = await getCVFiles();
    const cvNames = cvFiles.map((file) => file.name);

    console.log(`\n📊 Found ${cvNames.length} CV files to process`);
    console.log(
      `🧪 Testing methods: ${Object.values(CONFIG.verificationMethods)
        .filter((m) => m.enabled)
        .map((m) => m.name)
        .join(", ")}`
    );

    // Check test_cvs folder exists
    try {
      await fs.access(CONFIG.testCvsFolder);
    } catch (error) {
      console.error(`❌ test_cvs folder not found: ${CONFIG.testCvsFolder}`);
      console.error(`Please create this folder and add your CV files.`);
      console.error(`Run: node scripts/cv-test-setup-helper.js to check setup`);
      process.exit(1);
    }

    // Process in batches
    const batches = [];
    for (let i = 0; i < cvNames.length; i += CONFIG.batchSize) {
      batches.push(cvNames.slice(i, i + CONFIG.batchSize));
    }

    console.log(
      `\n📦 Processing ${batches.length} batches of up to ${CONFIG.batchSize} CVs each`
    );
    console.log(
      `⚙️  Configuration: ${CONFIG.delayBetweenRequests}ms between requests, ${CONFIG.maxRetries} max retries`
    );

    for (let i = 0; i < batches.length; i++) {
      console.log(`\n--- 📦 Batch ${i + 1}/${batches.length} ---`);

      try {
        const batchResults = await processCVBatch(batches[i], i + 1);
        allResults.push(...batchResults);

        // Save progress after each batch
        await saveProgressBackup(allResults, i + 1);

        console.log(
          `✅ Batch ${i + 1} completed: ${batchResults.length} results`
        );
      } catch (error) {
        console.error(`❌ Batch ${i + 1} failed:`, error.message);

        if (!CONFIG.continueOnError) {
          throw error;
        }

        console.log(
          `⚠️  Continuing with next batch due to continueOnError=true`
        );
      }

      if (i < batches.length - 1) {
        console.log(
          `⏳ Waiting ${CONFIG.delayBetweenBatches}ms before next batch...`
        );
        await sleep(CONFIG.delayBetweenBatches);
      }
    }

    // Generate summary
    console.log("\n=== GENERATING SUMMARY ===");
    const summaryStats = generateSummaryStats(allResults);

    // Display quick summary
    console.log("\n=== RESULTS SUMMARY ===");
    Object.entries(summaryStats).forEach(([method, stats]) => {
      console.log(`\n${stats.method}:`);
      console.log(
        `  Completion Rate: ${(stats.completionRate * 100).toFixed(1)}%`
      );
      console.log(
        `  Avg Processing Time: ${stats.avgProcessingTime?.toFixed(0)}ms`
      );
      console.log(
        `  Avg Link Provision: ${(stats.avgLinkProvisionRate * 100)?.toFixed(
          1
        )}%`
      );
      console.log(
        `  Total Input Tokens: ${
          stats.totalInputTokens?.toLocaleString() || "N/A"
        }`
      );
      console.log(
        `  Total Output Tokens: ${
          stats.totalOutputTokens?.toLocaleString() || "N/A"
        }`
      );
      console.log(
        `  Total API Calls: ${stats.totalApiCalls?.toLocaleString() || "N/A"}`
      );
    });

    // Export results
    console.log("\n💾 === EXPORTING RESULTS ===");
    await exportResults(allResults, summaryStats);

    console.log("\n🎉 === COMPARISON COMPLETE ===");
    console.log(`📊 Total tests: ${allResults.length}`);
    console.log(
      `✅ Successful tests: ${allResults.filter((r) => r.success).length}`
    );
    console.log(
      `⏱️  Total time: ${Math.round((new Date() - startTime) / 1000)}s`
    );
  } catch (error) {
    console.error("\n❌ === COMPARISON FAILED ===");
    console.error(`💥 Error: ${error.message}`);

    if (error.stack) {
      console.error("\n📋 Stack trace:");
      console.error(error.stack);
    }

    // Try to save partial results if any exist
    if (allResults.length > 0) {
      console.log(
        `\n💾 Attempting to save ${allResults.length} partial results...`
      );
      try {
        await saveProgressBackup(allResults, "error_recovery");
        const summaryStats = generateSummaryStats(allResults);
        await exportResults(allResults, summaryStats);
        console.log("✅ Partial results saved successfully");
      } catch (saveError) {
        console.error("❌ Failed to save partial results:", saveError.message);
      }
    }

    throw error;
  }
}

//=============================================================================
// SCRIPT EXECUTION
//=============================================================================

if (require.main === module) {
  runComparison()
    .then(() => {
      console.log("\n✓ Comparison completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n✗ Comparison failed:", error);
      process.exit(1);
    });
}

module.exports = {
  runComparison,
  testSingleCV,
  testAllMethodsOnCV,
  calculateQualityMetrics,
  generateSummaryStats,
};
