/**
 * Header Filter and ML Utilities
 *
 * This module contains shared utilities for header detection and machine learning operations.
 * Consolidates common functions used across different ML components.
 */

const fs = require("fs");
const path = require("path");

/**
 * Configuration constants for ML operations
 */
const ML_CONFIG = {
  MAX_CHUNK_SIZE: 8000,
  DEFAULT_TEST_RATIO: 0.2,
  DEFAULT_VALIDATION_RATIO: 0.2,
  CV_FOLDS: 5,
  API_RATE_LIMIT_MS: 4400,
  TOKEN_LIMIT_PER_MINUTE: 250000,
  GEMINI_MODEL: "gemini-2.5-flash-lite-preview-06-17",
  GENERATION_CONFIG: {
    temperature: 0.1,
    topP: 0.1,
    maxOutputTokens: 4096,
  },
};

/**
 * File paths configuration
 */
const PATHS = {
  TRAINING_DIR: path.join(__dirname, "../ml"),
  ML_DIR: path.join(__dirname, "../ml"),
  MODEL_DIR: path.join(__dirname, "../models"),
  CV_DIR: path.join(__dirname, "../data/training/cvs"),
  TRAINING_DATA: path.join(__dirname, "../ml/header_training_data.json"),
  DETECTED_HEADERS: path.join(__dirname, "../ml/detected_headers.json"),
  MODEL_FILE: path.join(__dirname, "../ml/header_classifier.json"),
  METRICS_FILE: path.join(__dirname, "../models/model_metrics.json"),
};

/**
 * Utility to filter headers based on publication pattern
 * Returns all headers unless any header matches publication pattern, in which case only those are returned.
 *
 * @param {Array} headers - Array of header objects { text, lineNumber, index }
 * @param {Object} classifier - Instance of SimpleHeaderClassifier
 * @param {Array} lines - Array of all lines from CV text
 * @returns {Array} Filtered header objects
 */
function getFilteredHeaders(headers, classifier, lines) {
  if (!Array.isArray(headers) || !classifier || !Array.isArray(lines)) {
    return headers;
  }
  const publicationHeaders = [];
  for (const header of headers) {
    const features = classifier.extractFeatures(
      header.text,
      header.index,
      lines.length
    );
    if (features.matchesPublicationPattern) {
      publicationHeaders.push(header);
    }
  }
  return publicationHeaders.length > 0 ? publicationHeaders : headers;
}

/**
 * Data splitting utilities
 */
class DataSplitter {
  /**
   * Split data into train/test sets with stratification
   * @param {Array} data - Full dataset
   * @param {number} testRatio - Ratio of data to use for testing
   * @returns {Object} Object with trainData and testData arrays
   */
  static trainTestSplit(data, testRatio = ML_CONFIG.DEFAULT_TEST_RATIO) {
    const headers = data.filter((item) => item.isHeader);
    const nonHeaders = data.filter((item) => !item.isHeader);

    const headerTestSize = Math.floor(headers.length * testRatio);
    const nonHeaderTestSize = Math.floor(nonHeaders.length * testRatio);

    // Shuffle both classes
    const shuffledHeaders = this.shuffleArray([...headers]);
    const shuffledNonHeaders = this.shuffleArray([...nonHeaders]);

    const testData = [
      ...shuffledHeaders.slice(0, headerTestSize),
      ...shuffledNonHeaders.slice(0, nonHeaderTestSize),
    ];

    const trainData = [
      ...shuffledHeaders.slice(headerTestSize),
      ...shuffledNonHeaders.slice(nonHeaderTestSize),
    ];

    // Shuffle final datasets
    return {
      trainData: this.shuffleArray(trainData),
      testData: this.shuffleArray(testData),
    };
  }

  /**
   * Stratified split for train/validation
   * @param {Array} data - Dataset to split
   * @param {number} valRatio - Validation ratio
   * @returns {Object} Object with trainData and validationData
   */
  static stratifiedSplit(data, valRatio = ML_CONFIG.DEFAULT_VALIDATION_RATIO) {
    const headers = data.filter((item) => item.isHeader);
    const nonHeaders = data.filter((item) => !item.isHeader);

    const valHeadersCount = Math.floor(headers.length * valRatio);
    const valNonHeadersCount = Math.floor(nonHeaders.length * valRatio);

    const shuffledHeaders = this.shuffleArray([...headers]);
    const shuffledNonHeaders = this.shuffleArray([...nonHeaders]);

    const validationData = [
      ...shuffledHeaders.slice(0, valHeadersCount),
      ...shuffledNonHeaders.slice(0, valNonHeadersCount),
    ];

    const trainData = [
      ...shuffledHeaders.slice(valHeadersCount),
      ...shuffledNonHeaders.slice(valNonHeadersCount),
    ];

    return { trainData, validationData };
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   * @param {Array} array - Array to shuffle
   * @returns {Array} Shuffled array
   */
  static shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

/**
 * Dataset balancing utilities
 */
class DatasetBalancer {
  /**
   * Balance dataset by undersampling majority class
   * @param {Array} data - Original dataset
   * @param {number} ratio - Ratio of non-headers to headers (default: 3)
   * @returns {Array} Balanced dataset
   */
  static balanceDataset(data, ratio = 3) {
    const headers = data.filter((item) => item.isHeader);
    const nonHeaders = data.filter((item) => !item.isHeader);

    console.log(
      `Original distribution - Headers: ${headers.length}, Non-headers: ${nonHeaders.length}`
    );

    // Undersample non-headers to desired ratio
    const targetSize = Math.min(headers.length * ratio, nonHeaders.length);
    const balancedNonHeaders = DataSplitter.shuffleArray(nonHeaders).slice(
      0,
      targetSize
    );

    console.log(
      `Balanced distribution - Headers: ${headers.length}, Non-headers: ${balancedNonHeaders.length}`
    );

    return DataSplitter.shuffleArray([...headers, ...balancedNonHeaders]);
  }
}

/**
 * Text processing utilities
 */
class TextProcessor {
  /**
   * Split text into chunks of maximum size while preserving line integrity
   * @param {string} text - Text to split
   * @param {number} maxSize - Maximum chunk size
   * @returns {Array<string>} Array of text chunks
   */
  static splitIntoChunks(text, maxSize = ML_CONFIG.MAX_CHUNK_SIZE) {
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
   * Split text into chunks preserving complete paragraphs
   * @param {string} text - Text to split
   * @param {number} maxSize - Maximum chunk size
   * @returns {Array<string>} Array of text chunks
   */
  static splitIntoParagraphChunks(text, maxSize = ML_CONFIG.MAX_CHUNK_SIZE) {
    const chunks = [];
    let currentChunk = "";

    // Split into paragraphs (double newlines)
    const paragraphs = text.split(/\n\s*\n/);

    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed chunk size, start new chunk
      if (
        (currentChunk + paragraph).length > maxSize &&
        currentChunk.length > 0
      ) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }

      // If single paragraph exceeds chunk size, split on sentences
      if (paragraph.length > maxSize) {
        const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
        for (const sentence of sentences) {
          if (
            (currentChunk + sentence).length > maxSize &&
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
}

/**
 * Feature extraction utilities
 */
class FeatureExtractor {
  /**
   * Extract features from a line of text
   * @param {string} line - Text line to analyze
   * @param {number} lineIndex - Index of the line in document
   * @param {number} totalLines - Total number of lines in document
   * @param {Array} knownHeaders - Array of known headers for pattern matching
   * @returns {Object} Feature object
   */
  static extractFeatures(line, lineIndex, totalLines, knownHeaders = []) {
    return {
      text: line,
      isAllUpperCase:
        line.replace(/[^A-Za-z]/g, "").length > 0 &&
        line.replace(/[^A-Za-z]/g, "") ===
          line.replace(/[^A-Za-z]/g, "").toUpperCase(),
      containsYear: /\b(19|20)\d{2}\b/.test(line),
      length: line.length,
      positionRatio: totalLines > 1 ? lineIndex / (totalLines - 1) : 0,
      wordCount: line.split(/\s+/).filter(Boolean).length,
      hasColon: line.includes(":"),
      matchesPublicationPattern: knownHeaders.some(
        (header) => line.trim().toLowerCase() === header.trim().toLowerCase()
      ),
    };
  }

  /**
   * Generate training data features for a line
   * @param {string} line - Text line
   * @param {number} lineIndex - Line index
   * @param {number} totalLines - Total lines
   * @param {Array} knownHeaders - Known headers
   * @returns {Object} Training data object with features
   */
  static generateLineFeatures(line, lineIndex, totalLines, knownHeaders) {
    return {
      text: line,
      features: this.extractFeatures(line, lineIndex, totalLines, knownHeaders),
    };
  }
}

/**
 * Metrics calculation utilities
 */
class MetricsCalculator {
  /**
   * Calculate standard classification metrics
   * @param {number} tp - True positives
   * @param {number} fp - False positives
   * @param {number} tn - True negatives
   * @param {number} fn - False negatives
   * @returns {Object} Metrics object
   */
  static calculateMetrics(tp, fp, tn, fn) {
    const total = tp + fp + tn + fn;
    const accuracy = total > 0 ? (tp + tn) / total : 0;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1Score =
      precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : 0;

    return {
      accuracy: Math.round(accuracy * 10000) / 100,
      precision: Math.round(precision * 10000) / 100,
      recall: Math.round(recall * 10000) / 100,
      f1Score: Math.round(f1Score * 10000) / 100,
      confusionMatrix: {
        truePositives: tp,
        falsePositives: fp,
        trueNegatives: tn,
        falseNegatives: fn,
      },
      support: {
        positive: tp + fn,
        negative: tn + fp,
        total: total,
      },
    };
  }

  /**
   * Calculate mean and standard deviation for cross-validation results
   * @param {Array<number>} values - Array of metric values
   * @returns {Object} Statistics object with mean and stdDev
   */
  static calculateStats(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    const stdDev = Math.sqrt(variance);
    return {
      mean: Math.round(mean * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
    };
  }

  /**
   * Find optimal threshold based on different objectives
   * @param {Array<number>} thresholds - Threshold values
   * @param {Array<number>} precisions - Precision values
   * @param {Array<number>} recalls - Recall values
   * @returns {Object} Optimal thresholds for different metrics
   */
  static findOptimalThresholds(thresholds, precisions, recalls) {
    let bestF1Threshold = 0;
    let bestF1 = 0;
    let precisionThreshold95 = null;

    for (let i = 0; i < thresholds.length; i++) {
      const precision = precisions[i];
      const recall = recalls[i];
      const f1 =
        precision + recall > 0
          ? (2 * precision * recall) / (precision + recall)
          : 0;

      if (f1 > bestF1) {
        bestF1 = f1;
        bestF1Threshold = thresholds[i];
      }

      if (precision >= 95 && precisionThreshold95 === null) {
        precisionThreshold95 = thresholds[i];
      }
    }

    return {
      optimalF1Threshold: bestF1Threshold,
      optimalF1Score: bestF1,
      precisionThreshold95: precisionThreshold95,
    };
  }
}

/**
 * API Rate limiter for external services
 */
class RateLimiter {
  constructor(delay = ML_CONFIG.API_RATE_LIMIT_MS) {
    this.delay = delay;
    this.lastRequest = 0;
    this.resetTime = Date.now();
    this.tokenLimit = ML_CONFIG.TOKEN_LIMIT_PER_MINUTE;
  }

  /**
   * Check if we're within token limits
   * @returns {boolean} True if within limits
   */
  checkTokenLimits() {
    const now = Date.now();
    const minuteElapsed = (now - this.resetTime) / (1000 * 60);

    if (minuteElapsed >= 1) {
      console.log(
        `Resetting token counters after ${Math.floor(minuteElapsed)} minutes`
      );
      this.resetTime = now;
      return true;
    }

    if (this.totalTokens >= this.tokenLimit) {
      throw new Error(
        `Token limit of ${this.tokenLimit} reached for this minute. Please wait.`
      );
    }

    return true;
  }

  /**
   * Wait for rate limit compliance
   */
  async wait() {
    this.checkTokenLimits();

    console.log(
      `Rate limiting: Enforcing ${this.delay}ms delay between requests...`
    );
    await new Promise((r) => setTimeout(r, this.delay));

    this.lastRequest = Date.now();
    console.log("Rate limiting: Ready for next request");
  }

  /**
   * Update token count (placeholder for future implementation)
   * @param {number} tokens - Number of tokens used
   */
  updateTokenCount(tokens) {
    // Placeholder for token tracking
  }
}

/**
 * File system utilities for ML operations
 */
class MLFileUtils {
  /**
   * Ensure directory exists, create if not
   * @param {string} dirPath - Directory path
   */
  static ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Load JSON file safely
   * @param {string} filePath - File path
   * @param {*} defaultValue - Default value if file doesn't exist
   * @returns {*} Parsed JSON or default value
   */
  static loadJsonFile(filePath, defaultValue = null) {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
      }
      return defaultValue;
    } catch (error) {
      console.warn(`Error loading JSON file ${filePath}:`, error.message);
      return defaultValue;
    }
  }

  /**
   * Save JSON file safely
   * @param {string} filePath - File path
   * @param {*} data - Data to save
   * @param {boolean} createDir - Whether to create directory if it doesn't exist
   */
  static saveJsonFile(filePath, data, createDir = true) {
    try {
      if (createDir) {
        this.ensureDirectoryExists(path.dirname(filePath));
      }
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`Error saving JSON file ${filePath}:`, error.message);
      throw error;
    }
  }

  /**
   * Get PDF files from a directory
   * @param {string} dirPath - Directory path
   * @returns {Array<string>} Array of PDF file paths
   */
  static getPdfFiles(dirPath) {
    if (!fs.existsSync(dirPath)) {
      return [];
    }
    return fs
      .readdirSync(dirPath)
      .filter((file) => file.toLowerCase().endsWith(".pdf"))
      .map((file) => path.join(dirPath, file));
  }
}

module.exports = {
  ML_CONFIG,
  PATHS,
  getFilteredHeaders,
  DataSplitter,
  DatasetBalancer,
  TextProcessor,
  FeatureExtractor,
  MetricsCalculator,
  RateLimiter,
  MLFileUtils,
};
