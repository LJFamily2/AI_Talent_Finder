/**
 * Training Data Generator for Header Detection
 *
 * This script processes CV PDFs and generates labeled training data
 * for the header detection ML model.
 */

const fs = require("fs");
const path = require("path");
const { extractTextFromPDF } = require("../utils/pdfUtils");
// Removed PUBLICATION_PATTERNS, now using AI-detected headers
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "../.env") });

const MAX_CHUNK_SIZE = 8000;

// Split text into chunks of maximum size while preserving complete paragraphs
function splitIntoChunks(text) {
  const chunks = [];
  let currentChunk = "";

  // Split into paragraphs (double newlines)
  const paragraphs = text.split(/\n\s*\n/);

  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed chunk size, start new chunk
    if (
      (currentChunk + paragraph).length > MAX_CHUNK_SIZE &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }

    // If single paragraph exceeds chunk size, split on sentences
    if (paragraph.length > MAX_CHUNK_SIZE) {
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
      for (const sentence of sentences) {
        if (
          (currentChunk + sentence).length > MAX_CHUNK_SIZE &&
          currentChunk.length > 0
        ) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
        }
        currentChunk += sentence + " ";
      }
    } else {
      currentChunk += paragraph + "\n\n";
    }
  }

  // Add final chunk if not empty
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

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
const TRAINING_DIR = path.join(__dirname, "../data/training");
const OUTPUT_FILE = path.join(__dirname,"header_training_data.json");
// Function to check if a line likely contains a publication

/**
 * Split text into chunks of maximum size while preserving line integrity
 */
function splitIntoChunks(text, maxSize = MAX_CHUNK_SIZE) {
  const lines = text.split("\n");
  const chunks = [];
  let currentChunk = "";

  for (const line of lines) {
    if (
      currentChunk.length + line.length + 1 > maxSize &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }
    currentChunk += line + "\n";
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

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
    const allHeaders = JSON.parse(fs.readFileSync(detectedHeadersPath, "utf8"));
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
  if (!fs.existsSync(TRAINING_DIR)) {
    fs.mkdirSync(TRAINING_DIR, { recursive: true });
  }

  const cvDir = path.join(TRAINING_DIR, "cvs");
  if (!fs.existsSync(cvDir)) {
    fs.mkdirSync(cvDir, { recursive: true });
    console.log(`Created CV directory at ${cvDir}`);
    console.log(
      "Please add CV PDF files to this directory and run the script again."
    );
    return;
  }

  const files = fs
    .readdirSync(cvDir)
    .filter((file) => file.toLowerCase().endsWith(".pdf"));
  if (files.length === 0) {
    console.log("No PDF files found in the CV directory.");
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
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allTrainingData, null, 2));
  console.log(`Training data saved to ${OUTPUT_FILE}`);

  // Save detected headers separately
  const headersFile = path.join(TRAINING_DIR, "detected_headers.json");
  const uniqueHeaders = [
    ...new Set(
      allTrainingData.filter((item) => item.isHeader).map((item) => item.text)
    ),
  ];

  fs.writeFileSync(headersFile, JSON.stringify(uniqueHeaders, null, 2));
  console.log(`Headers saved to ${headersFile}`);

  console.log(
    `Processed ${files.length} CVs, generated ${allTrainingData.length} training examples`
  );

  // Token usage statistics removed
}

// Run the script if directly
if (require.main === module) {
  generateTrainingData().catch(console.error);
}

module.exports = {
  generateTrainingData,
  generateLineFeatures,
};
