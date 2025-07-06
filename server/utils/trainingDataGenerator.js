/**
 * Training Data Generator for Header Detection
 *
 * This script processes CV PDFs and generates labeled training data
 * for the header detection ML model.
 */

const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const { PUBLICATION_PATTERNS } = require("./constants");

// Configuration
const TRAINING_DIR = path.join(__dirname, "../data/training");
const OUTPUT_FILE = path.join(TRAINING_DIR, "header_training_data.json");

/**
 * Generates features for a line of text
 */
function generateLineFeatures(line, lineIndex, totalLines) {
  return {
    text: line,
    features: {
      isAllUpperCase: line === line.toUpperCase(),
      startsWithNumber: /^\d+\./.test(line),
      containsYear: /\b(19|20)\d{2}\b/.test(line),
      length: line.length,
      positionRatio: lineIndex / totalLines,
      wordCount: line.split(/\s+/).length,
      hasColon: line.includes(":"),
      matchesPublicationPattern: PUBLICATION_PATTERNS.some((pattern) =>
        pattern.test(line)
      ),
      precedingBlankLine: false, // Will be set during processing
      followingBlankLine: false, // Will be set during processing
      indentationLevel: line.search(/\S/), // Number of leading spaces
    },
  };
}

// Load manual header labels if available
const HEADER_LABELS_FILE = path.join(TRAINING_DIR, "header_labels.json");
let manualLabels = {};
if (fs.existsSync(HEADER_LABELS_FILE)) {
  manualLabels = JSON.parse(fs.readFileSync(HEADER_LABELS_FILE, "utf-8"));
}

/**
 * Processes a single CV file and generates training data
 */
async function processCV(filePath) {
  try {
    console.log(`Processing ${filePath}...`);
    const pdfBuffer = fs.readFileSync(filePath);
    const parsedData = await pdfParse(pdfBuffer);
    const lines = parsedData.text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const trainingData = [];
    const fileName = path.basename(filePath);
    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const features = generateLineFeatures(line, i, lines.length);

      // Set blank line context
      features.features.precedingBlankLine = i > 0 && !lines[i - 1].trim();
      features.features.followingBlankLine =
        i < lines.length - 1 && !lines[i + 1].trim();

      // Only use fallback rules (no manual labels)
      features.isHeader =
        (line === line.toUpperCase() &&
        PUBLICATION_PATTERNS.some((pattern) => pattern.test(line)));

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
    const trainingData = await processCV(filePath);
    allTrainingData = allTrainingData.concat(trainingData);
  }

  // Save the training data
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allTrainingData, null, 2));
  console.log(`Training data saved to ${OUTPUT_FILE}`);
  console.log(
    `Processed ${files.length} CVs, generated ${allTrainingData.length} training examples`
  );
}

// Run the script if called directly
if (require.main === module) {
  generateTrainingData().catch(console.error);
}

module.exports = {
  generateTrainingData,
  generateLineFeatures,
};
