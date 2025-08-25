/**
 * Training Data Generator for Header Detection
 *
 * This script processes CV PDFs and generates labeled training data
 * for the header detection ML model.
 */

const fs = require("fs");
const path = require("path");
const { extractTextFromPDF } = require("../utils/pdfUtils");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const {
  TextProcessor,
  RateLimiter,
  MLFileUtils,
  ML_CONFIG,
} = require("../utils/headerFilterUtils");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "../.env") });

const { PATHS } = ML_CONFIG;

// Rate Limiter for API calls
class RateLimiter {
  constructor() {
    this.delay = 4400; // 4.4 seconds between requests
    this.lastRequest = 0;
    this.resetTime = Date.now(); // Track when we last reset counts
    this.monthlyTokenLimit = 250000; // 250k tokens per minute limit
  }

  checkTokenLimits() {
    const now = Date.now();
    const minuteElapsed = (now - this.resetTime) / (1000 * 60); // Convert to minutes

    if (minuteElapsed >= 1) {
      // Reset counters after a minute
      console.log(
        `Resetting token counters after ${Math.floor(minuteElapsed)} minutes`
      );
      this.resetTime = now;
      return true;
    }

    // Check if we're approaching token limit
    if (this.totalTokens >= this.monthlyTokenLimit) {
      throw new Error(
        `Token limit of ${this.monthlyTokenLimit} reached for this minute. Please wait.`
      );
    }

    return true;
  }

  updateTokenCount(tokens) {
    // No longer tracking tokens or request count
  }

  async wait() {
    const now = Date.now();
    const elapsed = now - this.lastRequest;

    // Check token limits first
    this.checkTokenLimits();

    // Always wait full delay time
    console.log(
      `Rate limiting: Enforcing ${this.delay}ms delay between requests...`
    );
    await new Promise((r) => setTimeout(r, this.delay));

    // Set lastRequest AFTER waiting but BEFORE the actual request
    this.lastRequest = Date.now();
    console.log("Rate limiting: Ready for next request");
  }
}

const rateLimiter = new RateLimiter();

// Configuration
const OUTPUT_FILE = path.join(PATHS.training, "header_training_data.json");

// Function to check if a line likely contains a publication

/**
 * Generates features for a line of text
 */
async function detectHeadersWithAI(model, text) {
  // Track token usage for this request
  const inputTokenCount = Math.ceil(text.length / 4); // Approximate token count
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
    await rateLimiter.wait();
    console.log("Making API request to Gemini...");

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        topP: 0.1,
        maxOutputTokens: 1024,
      },
    });

    // Get response text first
    const responseText = result.response.text();

    // Calculate token usage
    const promptTokens =
      result.promptFeedback?.tokenCount || Math.ceil(prompt.length / 4);
    const responseTokens =
      result.response?.tokenCount || Math.ceil(responseText.length / 4);
    const totalTokensForRequest = promptTokens + responseTokens;

    // Update token count through rate limiter
    rateLimiter.updateTokenCount(totalTokensForRequest);

    console.log(
      `Token usage - Prompt: ${promptTokens}, Response: ${responseTokens}, Total for request: ${totalTokensForRequest}`
    );
    console.log("API request completed successfully");

    // Clean up the response to ensure it's valid JSON
    const cleanJson = responseText.replace(/```json\s*|\s*```/g, "").trim();
    const parsedHeaders = JSON.parse(cleanJson);
    console.log(`Detected ${parsedHeaders.length} headers in text`);
    return parsedHeaders;
  } catch (error) {
    console.error("Error in AI header detection:", error);
    // Return empty array as fallback
    return [];
  }
}

function generateLineFeatures(line, lineIndex, totalLines, knownHeaders) {
  return {
    text: line,
    features: {
      isAllUpperCase: line === line.toUpperCase(),
      containsYear: /\b(19|20)\d{2}\b/.test(line),
      length: line.length,
      positionRatio: lineIndex / totalLines,
      wordCount: line.split(/\s+/).length,
      hasColon: line.includes(":"),
      matchesPublicationPattern: knownHeaders.some((header) =>
        line.trim().toLowerCase().includes(header.toLowerCase())
      ),
    },
  };
}

/**
 * Processes a single CV file and generates training data
 */
async function processCV(filePath, model) {
  try {
    console.log(`Processing ${filePath}...`);
    const cvText = await extractTextFromPDF(filePath);
    const lines = cvText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    // Split text into chunks if needed
    // let allHeaders = [];
    // if (cvText.length > MAX_CHUNK_SIZE) {
    //   console.log(
    //     `CV text length (${cvText.length} chars) exceeds chunk size, splitting into chunks...`
    //   );
    //   const chunks = splitIntoChunks(cvText);
    //   console.log(`Split into ${chunks.length} chunks`);

    // Process each chunk
    //   for (const chunk of chunks) {
    //     const chunkHeaders = await detectHeadersWithAI(model, chunk);
    //     allHeaders = [...new Set([...allHeaders, ...chunkHeaders])];
    //   }
    // } else {
    //   // Process entire text if within size limit
    //   allHeaders = await detectHeadersWithAI(model, cvText);
    // }
    // console.log(`Found ${allHeaders.length} total unique headers`);
    // Load headers from detected_headers.json instead of AI
    const detectedHeadersPath = path.join(
      __dirname,
      "../ml/detected_headers.json"
    );
    const allHeaders = MLFileUtils.loadJsonFile(detectedHeadersPath, []);
    console.log(
      `Loaded ${allHeaders.length} headers from detected_headers.json`
    );

    const trainingData = [];

    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const features = generateLineFeatures(line, i, lines.length, allHeaders);

      // Use AI-detected headers instead of static patterns
      features.isHeader = allHeaders.includes(line.trim());

      trainingData.push(features);
    }

    return trainingData;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return [];
  }
}

/**
 * Main function to process all CVs and generate training data
 */
async function generateTrainingData() {
  // Initialize AI model
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite-preview-06-17",
    generationConfig: {
      temperature: 0.1,
      topP: 0.1,
      maxOutputTokens: 4096,
    },
  });

  // Create training directory if it doesn't exist
  MLFileUtils.ensureDirectoryExists(PATHS.training);

  const cvDir = path.join(PATHS.training, "cvs");
  MLFileUtils.ensureDirectoryExists(cvDir);

  const files = fs
    .readdirSync(cvDir)
    .filter((file) => file.toLowerCase().endsWith(".pdf"));

  if (files.length === 0) {
    console.log(`Created CV directory at ${cvDir}`);
    console.log(
      "Please add CV PDF files to this directory and run the script again."
    );
    return;
  }

  let allTrainingData = [];

  // Process each CV
  for (const file of files) {
    const filePath = path.join(cvDir, file);
    const trainingData = await processCV(filePath, model);
    allTrainingData = allTrainingData.concat(trainingData);
  }

  // Save the training data
  MLFileUtils.saveJsonFile(OUTPUT_FILE, allTrainingData);
  console.log(`Training data saved to ${OUTPUT_FILE}`);

  // Save detected headers separately
  const headersFile = path.join(PATHS.training, "detected_headers.json");
  const uniqueHeaders = [
    ...new Set(
      allTrainingData.filter((item) => item.isHeader).map((item) => item.text)
    ),
  ];

  MLFileUtils.saveJsonFile(headersFile, uniqueHeaders);
  console.log(`Headers saved to ${headersFile}`);

  console.log(
    `Processed ${files.length} CVs, generated ${allTrainingData.length} training examples`
  );
}

// Main execution
(async () => {
  if (require.main === module) {
    await generateTrainingData();
  }
})();

module.exports = {
  generateTrainingData,
  generateLineFeatures,
};
