/**
 * Test Script for AI CV Verification
 *
 * This script demonstrates how to test the AI CV verification functionality
 * and can be used for development and debugging purposes.
 */

const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

// Configuration
const SERVER_URL = "http://localhost:3001"; // Adjust based on your server configuration
const TEST_CV_PATH = path.join(__dirname, "test-cv.pdf"); // Path to a test CV file

/**
 * Test the AI CV verification endpoint
 */
async function testAICVVerification() {
  try {
    console.log("🧪 Testing AI CV Verification System...\n");

    // Check if test CV file exists
    if (!fs.existsSync(TEST_CV_PATH)) {
      console.log("⚠️  No test CV file found at:", TEST_CV_PATH);
      console.log(
        '   Please place a test PDF CV file in the server directory named "test-cv.pdf"'
      );
      return;
    }

    // Create form data
    const formData = new FormData();
    formData.append("cvFile", fs.createReadStream(TEST_CV_PATH));
    formData.append("prioritySource", "ai");

    console.log("📤 Uploading CV file for verification...");

    // Make request to AI verification endpoint
    const response = await axios.post(
      `${SERVER_URL}/api/ai-verify-cv`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 120000, // 2 minute timeout for AI processing
      }
    );

    const result = response.data;

    if (result.success) {
      console.log("✅ AI CV Verification completed successfully!\n");

      // Display summary
      console.log("📊 VERIFICATION SUMMARY");
      console.log("=" * 50);
      console.log(`👤 Candidate Name: ${result.candidateName}`);
      console.log(`📚 Total Publications: ${result.total}`);
      console.log(`✅ Verified Publications: ${result.verifiedPublications}`);
      console.log(
        `⭐ High Quality Publications: ${result.highQualityPublications}`
      );
      console.log(
        `⚠️  Suspicious Publications: ${result.suspiciousPublications}\n`
      );

      // Display author metrics
      if (result.authorDetails && result.authorDetails.metrics) {
        const metrics = result.authorDetails.metrics;
        console.log("📈 AUTHOR METRICS");
        console.log("=" * 50);
        console.log(`H-Index: ${metrics.h_index}`);
        console.log(`Document Count: ${metrics.documentCount}`);
        console.log(`i10-Index: ${metrics.i10_index}`);
        console.log(`Citation Count: ${metrics.citationCount}`);
        console.log(
          `Average Citations per Paper: ${metrics.averageCitationsPerPaper}`
        );
        console.log(`Career Start Year: ${metrics.careerStartYear}\n`);
      }

      // Display top publications
      console.log("📄 TOP PUBLICATIONS");
      console.log("=" * 50);
      const topPubs = result.results
        .filter((r) => r.verification && r.verification.credibilityScore)
        .sort(
          (a, b) =>
            b.verification.credibilityScore - a.verification.credibilityScore
        )
        .slice(0, 3);

      topPubs.forEach((pub, index) => {
        console.log(
          `${index + 1}. ${pub.publication?.title || "Title not extracted"}`
        );
        console.log(
          `   Quality: ${pub.verification?.qualityAssessment || "Unknown"}`
        );
        console.log(
          `   Credibility Score: ${pub.verification?.credibilityScore || 0}%`
        );
        console.log(`   Year: ${pub.publication?.year || "Unknown"}`);
        console.log(`   Venue: ${pub.publication?.venue || "Unknown"}\n`);
      });

      // Display recommendations
      if (result.recommendations && result.recommendations.length > 0) {
        console.log("💡 RECOMMENDATIONS");
        console.log("=" * 50);
        result.recommendations.forEach((rec, index) => {
          console.log(`${index + 1}. ${rec.title} (${rec.priority} priority)`);
          console.log(`   ${rec.description}`);
          if (rec.actionItems && rec.actionItems.length > 0) {
            console.log(`   Action Items:`);
            rec.actionItems.forEach((item) => console.log(`   - ${item}`));
          }
          console.log("");
        });
      }
    } else {
      console.error("❌ Verification failed:", result.error);
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);

    if (error.code === "ECONNREFUSED") {
      console.log("💡 Make sure the server is running on", SERVER_URL);
    } else if (error.response) {
      console.log("📝 Server response:", error.response.data);
    }
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log("🚀 Starting AI CV Verification Tests\n");

  await testAICVVerification();

  console.log("🏁 Test suite completed");
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testAICVVerification,
  runTests,
};
