/**
 * Training Data Generator for Header Detection
 *
 * This module processes CV PDFs and generates labeled training data
 * for the header detection ML model.
 * Enhanced with utilities from mlUtils for better code organization.
 */

const fs = require("fs");
const path = require("path");
const { extractTextFromPDF } = require("../utils/pdfUtils");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
const {
  TextProcessor,
  FeatureExtractor,
  RateLimiter,
  MLFileUtils,
  ML_CONFIG,
  PATHS,
} = require("./mlUtils");

dotenv.config({ path: path.join(__dirname, "../.env") });

class DataGenerator {
  constructor() {
    this.rateLimiter = new RateLimiter();
    this.model = null;
    this.initializeAI();
  }

  /**
   * Initialize AI model
   */
  initializeAI() {
    if (!process.env.GEMINI_API_KEY) {
      console.warn(
        "⚠️ GEMINI_API_KEY not found. AI header detection disabled."
      );
      return;
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = genAI.getGenerativeModel({
      model: ML_CONFIG.GEMINI_MODEL,
      generationConfig: ML_CONFIG.GENERATION_CONFIG,
    });
  }

  /**
   * Detect headers using AI
   */
  async detectHeadersWithAI(text) {
    if (!this.model) {
      console.warn("AI model not available, skipping AI header detection");
      return [];
    }

    const inputTokenCount = Math.ceil(text.length / 4);
    global.totalTokens = (global.totalTokens || 0) + inputTokenCount;

    const prompt = `
      Analyze this CV text and identify all section headers that contain publications, especially publication-related sections.
      Focus on finding headers like:
      - Publications
      - Journal Articles
      - Conference Papers
      - Book Chapters
      - Many other common academic and professional headers.
      Return ONLY a JSON array of strings containing the headers found, nothing else. 
      Example format: ["Publications", "Journal Articles", "Conference Papers"]
      Text:
      ${text}
    `;

    try {
      console.log("Starting rate-limited API request...");
      await this.rateLimiter.wait();
      console.log("Making API request to Gemini...");

      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: ML_CONFIG.GENERATION_CONFIG,
      });

      const responseText = result.response.text();

      // Calculate token usage
      const promptTokens =
        result.promptFeedback?.tokenCount || Math.ceil(prompt.length / 4);
      const responseTokens =
        result.response?.tokenCount || Math.ceil(responseText.length / 4);
      const totalTokensForRequest = promptTokens + responseTokens;

      this.rateLimiter.updateTokenCount(totalTokensForRequest);

      console.log(
        `Token usage - Prompt: ${promptTokens}, Response: ${responseTokens}, Total: ${totalTokensForRequest}`
      );
      console.log("API request completed successfully");

      // Clean up the response to ensure it's valid JSON
      const cleanJson = responseText.replace(/```json\\s*|\\s*```/g, "").trim();
      const parsedHeaders = JSON.parse(cleanJson);
      console.log(`Detected ${parsedHeaders.length} headers in text`);
      return parsedHeaders;
    } catch (error) {
      console.error("Error in AI header detection:", error);
      return [];
    }
  }

  /**
   * Process a single CV file and generate training data
   */
  async processCV(filePath) {
    try {
      console.log(`📄 Processing ${filePath}...`);
      const cvText = await extractTextFromPDF(filePath);
      const lines = cvText
        .split("\\n")
        .map((line) => line.trim())
        .filter(Boolean);

      // Load headers from detected_headers.json instead of AI
      const allHeaders = MLFileUtils.loadJsonFile(PATHS.DETECTED_HEADERS, []);
      console.log(
        `📚 Loaded ${allHeaders.length} headers from detected_headers.json`
      );

      const trainingData = [];

      // Process each line
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const features = FeatureExtractor.generateLineFeatures(
          line,
          i,
          lines.length,
          allHeaders
        );

        // Use known headers for labeling
        features.isHeader = allHeaders.includes(line.trim());

        trainingData.push(features);
      }

      console.log(
        `✅ Generated ${
          trainingData.length
        } training examples from ${path.basename(filePath)}`
      );
      return trainingData;
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Main function to process all CVs and generate training data
   */
  async generateTrainingData() {
    try {
      console.log("🚀 Starting training data generation...");

      // Create training directory if it doesn't exist
      MLFileUtils.ensureDirectoryExists(PATHS.TRAINING_DIR);

      // Ensure CV directory exists
      if (!fs.existsSync(PATHS.CV_DIR)) {
        MLFileUtils.ensureDirectoryExists(PATHS.CV_DIR);
        console.log(`📁 Created CV directory at ${PATHS.CV_DIR}`);
        console.log(
          "📋 Please add CV PDF files to this directory and run the script again."
        );
        return;
      }

      // Get PDF files
      const files = MLFileUtils.getPdfFiles(PATHS.CV_DIR);
      if (files.length === 0) {
        console.log("📄 No PDF files found in the CV directory.");
        return;
      }

      console.log(`📚 Found ${files.length} PDF files to process`);
      let allTrainingData = [];

      // Process each CV
      for (const filePath of files) {
        const trainingData = await this.processCV(filePath);
        allTrainingData = allTrainingData.concat(trainingData);
      }

      // Save the training data
      MLFileUtils.saveJsonFile(PATHS.TRAINING_DATA, allTrainingData);
      console.log(`💾 Training data saved to ${PATHS.TRAINING_DATA}`);

      // Save detected headers separately
      const uniqueHeaders = [
        ...new Set(
          allTrainingData
            .filter((item) => item.isHeader)
            .map((item) => item.text)
        ),
      ];

      if (uniqueHeaders.length > 0) {
        const headersFile = path.join(
          PATHS.TRAINING_DIR,
          "detected_headers.json"
        );
        MLFileUtils.saveJsonFile(headersFile, uniqueHeaders);
        console.log(`📋 Headers saved to ${headersFile}`);
      }

      console.log(
        `✅ Processed ${files.length} CVs, generated ${allTrainingData.length} training examples`
      );

      // Display statistics
      this.displayDataStatistics(allTrainingData);
    } catch (error) {
      console.error("❌ Error generating training data:", error);
      throw error;
    }
  }

  /**
   * Display training data statistics
   */
  displayDataStatistics(data) {
    const headers = data.filter((item) => item.isHeader);
    const nonHeaders = data.filter((item) => !item.isHeader);

    console.log("\\n📊 Training Data Statistics:");
    console.log("=".repeat(40));
    console.log(`Total examples: ${data.length}`);
    console.log(
      `Headers: ${headers.length} (${(
        (headers.length / data.length) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `Non-headers: ${nonHeaders.length} (${(
        (nonHeaders.length / data.length) *
        100
      ).toFixed(1)}%)`
    );

    if (headers.length > 0) {
      console.log(`\\n📋 Sample headers found:`);
      const sampleHeaders = [...new Set(headers.map((h) => h.text))].slice(
        0,
        10
      );
      sampleHeaders.forEach((header) => {
        console.log(`  • ${header}`);
      });
      if (headers.length > 10) {
        console.log(`  ... and ${headers.length - 10} more`);
      }
    }
  }

  /**
   * Generate additional training data from new CVs
   */
  async generateAdditionalData(newCvPaths) {
    console.log(
      `🔄 Generating additional training data from ${newCvPaths.length} new CVs...`
    );

    let additionalData = [];
    for (const filePath of newCvPaths) {
      const data = await this.processCV(filePath);
      additionalData = additionalData.concat(data);
    }

    // Load existing data and merge
    const existingData = MLFileUtils.loadJsonFile(PATHS.TRAINING_DATA, []);
    const mergedData = [...existingData, ...additionalData];

    // Save merged data
    MLFileUtils.saveJsonFile(PATHS.TRAINING_DATA, mergedData);
    console.log(
      `💾 Updated training data with ${additionalData.length} new examples`
    );

    return additionalData;
  }
}

// Export functions for backwards compatibility
async function generateTrainingData() {
  const generator = new DataGenerator();
  return await generator.generateTrainingData();
}

function generateLineFeatures(line, lineIndex, totalLines, knownHeaders) {
  return FeatureExtractor.generateLineFeatures(
    line,
    lineIndex,
    totalLines,
    knownHeaders
  );
}

// Command line interface
if (require.main === module) {
  generateTrainingData().catch(console.error);
}

module.exports = {
  DataGenerator,
  generateTrainingData,
  generateLineFeatures,
};
