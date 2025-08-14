/**
 * Simple Header Classifier
 *
 * A lightweight rule-based classifier that learns from training data
 */

const fs = require("fs");
const path = require("path");

class SimpleHeaderClassifier {
  constructor() {
    this.rules = {
      isAllUpperCase: { weight: 0 },
      containsYear: { weight: 0 },
      lengthRange: { weight: 0, minLength: 5, maxLength: 80 },
      positionRatio: { weight: 0 },
      wordCount: { weight: 0, maxWords: 15 },
      hasColon: { weight: 0 },
      matchesPublicationPattern: { weight: 0 },
    };
    this.trained = false;
    this.threshold = 0; // Dynamic threshold learned during training
    this.knownHeaders = [];
    this.loadKnownHeaders();
  }

  /**
   * Load known headers from detected_headers.json
   */
  loadKnownHeaders() {
    try {
      const headersPath = path.join(__dirname, "../ml/detected_headers.json");
      this.knownHeaders = JSON.parse(fs.readFileSync(headersPath));
      console.log(
        `Loaded ${this.knownHeaders.length} known publication headers`
      );
    } catch (error) {
      console.warn("Could not load detected headers:", error);
      this.knownHeaders = [];
    }
  }

  /**
   * Train the classifier using labeled data
   */
  train(trainingData) {
    // Balance the dataset to address class imbalance
    const balancedData = this.balanceDataset(trainingData);
    // Stratified split for threshold learning
    const { trainData, validationData } = this.stratifiedSplit(
      balancedData,
      0.2
    );

    const headerExamples = trainData.filter((item) => item.isHeader);
    const nonHeaderExamples = trainData.filter((item) => !item.isHeader);

    console.log(
      `Headers: ${headerExamples.length}, Non-headers: ${nonHeaderExamples.length}`
    );

    // Calculate weights based on feature prevalence in headers vs non-headers
    Object.keys(this.rules).forEach((feature) => {
      let headerCount = 0;
      let nonHeaderCount = 0;

      headerExamples.forEach((item) => {
        if (this.evaluateFeature(feature, item.features)) headerCount++;
      });

      nonHeaderExamples.forEach((item) => {
        if (this.evaluateFeature(feature, item.features)) nonHeaderCount++;
      });

      const headerRatio =
        headerExamples.length > 0 ? headerCount / headerExamples.length : 0;
      const nonHeaderRatio =
        nonHeaderExamples.length > 0
          ? nonHeaderCount / nonHeaderExamples.length
          : 0;

      // Weight is positive if feature is more common in headers
      let weight = headerRatio - nonHeaderRatio;

      this.rules[feature].weight = weight;

      console.log(
        `${feature}: header=${headerRatio.toFixed(
          3
        )}, non-header=${nonHeaderRatio.toFixed(3)}, weight=${this.rules[
          feature
        ].weight.toFixed(3)}`
      );
    });

    // Learn optimal threshold using validation set
    this.threshold = this.findOptimalThreshold(validationData);

    this.trained = true;
    console.log(
      `Training completed! Optimal threshold: ${this.threshold.toFixed(3)}`
    );
  }

  /**
   * Balance the dataset by undersampling non-headers
   */
  balanceDataset(data) {
    const headers = data.filter((item) => item.isHeader);
    const nonHeaders = data.filter((item) => !item.isHeader);
    // Undersample non-headers to 3x headers (or all if less)
    const targetSize = Math.min(headers.length * 3, nonHeaders.length);
    const shuffledNonHeaders = nonHeaders.sort(() => Math.random() - 0.5);
    const balancedNonHeaders = shuffledNonHeaders.slice(0, targetSize);
    return [...headers, ...balancedNonHeaders].sort(() => Math.random() - 0.5);
  }

  /**
   * Stratified split for train/validation
   */
  stratifiedSplit(data, valRatio = 0.2) {
    const headers = data.filter((item) => item.isHeader);
    const nonHeaders = data.filter((item) => !item.isHeader);
    const valHeadersCount = Math.floor(headers.length * valRatio);
    const valNonHeadersCount = Math.floor(nonHeaders.length * valRatio);
    const shuffledHeaders = headers.sort(() => Math.random() - 0.5);
    const shuffledNonHeaders = nonHeaders.sort(() => Math.random() - 0.5);
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
   * Find optimal threshold using validation data
   */
  findOptimalThreshold(validationData) {
    let bestThreshold = 0;
    let bestF1 = 0;

    // Test different thresholds
    for (let threshold = -3; threshold <= 3; threshold += 0.1) {
      let truePositives = 0;
      let falsePositives = 0;
      let falseNegatives = 0;

      validationData.forEach((example, index) => {
        const features = this.extractFeatures(
          example.text,
          index,
          validationData.length
        );
        let score = 0;

        Object.keys(this.rules).forEach((feature) => {
          if (this.evaluateFeature(feature, features)) {
            score += this.rules[feature].weight;
          }
        });

        const predicted = score > threshold;
        const actual = example.isHeader;

        if (predicted && actual) {
          truePositives++;
        } else if (predicted && !actual) {
          falsePositives++;
        } else if (!predicted && actual) {
          falseNegatives++;
        }
      });

      const precision =
        truePositives > 0
          ? truePositives / (truePositives + falsePositives)
          : 0;
      const recall =
        truePositives > 0
          ? truePositives / (truePositives + falseNegatives)
          : 0;
      const f1Score =
        precision + recall > 0
          ? (2 * precision * recall) / (precision + recall)
          : 0;

      if (f1Score > bestF1) {
        bestF1 = f1Score;
        bestThreshold = threshold;
      }
    }

    console.log(
      `Best threshold: ${bestThreshold.toFixed(3)} with F1: ${bestF1.toFixed(
        3
      )}`
    );
    return bestThreshold;
  }

  /**
   * Evaluate a feature for a given feature set
   */
  evaluateFeature(featureName, features) {
    switch (featureName) {
      case "isAllUpperCase":
        return features.isAllUpperCase;
      case "containsYear":
        return features.containsYear;
      case "lengthRange":
        // More nuanced length scoring
        return features.length >= 5 && features.length <= 80;
      case "positionRatio":
        // More flexible position logic - headers can appear almost anywhere
        return features.positionRatio > 0.05 && features.positionRatio < 0.95;
      case "wordCount":
        // Allow longer headers for complex publication titles
        return features.wordCount >= 1 && features.wordCount <= 20;
      case "hasColon":
        return features.hasColon;
      case "matchesPublicationPattern":
        return features.matchesPublicationPattern;
      
        default:
        return false;
    }
  }

  /**
   * Extract features from a line
   */
  extractFeatures(line, lineIndex, totalLines) {
    // Add text to features for use in evaluateFeature
    const keywords = [
      "publication",
      "paper",
      "article",
      "journal",
      "conference",
      "book",
      "chapter",
      "research",
      "scholarly",
      "academic",
      "peer",
      "reviewed",
      "proceedings",
      "manuscript",
      "thesis",
      "patent",
      "report",
      "working paper",
      "magazine",
      "editorial",
      "commentary",
      "talk",
      "panel",
      "seminar",
      "presentation",
      "poster",
      "abstract",
      "dissertation",
      "monograph",
      "volume",
      "issue",
      "newsletter",
      "review",
      "case study",
      "white paper",
      "policy",
      "book chapter",
      "newspaper",
      "non-academic",
      "selected",
      "invited",
    ];
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
      matchesPublicationPattern: this.knownHeaders.some(
        (header) => line.trim().toLowerCase() === header.trim().toLowerCase()
      ),
    };
  }

  /**
   * Predict if a line is a header
   */
  predict(line, lineIndex, totalLines) {
    if (!this.trained) {
      throw new Error("Classifier not trained yet");
    }

    const features = this.extractFeatures(line, lineIndex, totalLines);
    let score = 0;

    Object.keys(this.rules).forEach((feature) => {
      if (this.evaluateFeature(feature, features)) {
        score += this.rules[feature].weight;
      }
    });

    // Use learned threshold instead of hard-coded logic
    return score > this.threshold;
  }

  /**
   * Save the trained model
   */
  save(modelPath) {
    if (!this.trained) {
      throw new Error("No trained model to save");
    }

    const modelData = {
      rules: this.rules,
      threshold: this.threshold,
      trained: true,
    };

    fs.writeFileSync(modelPath, JSON.stringify(modelData, null, 2));
  }

  /**
   * Load a trained model
   */
  load(modelPath) {
    const modelData = JSON.parse(fs.readFileSync(modelPath));
    this.rules = modelData.rules;
    this.threshold = modelData.threshold || 0;
    this.trained = modelData.trained;
  }

  /**
   * Evaluate model performance using standard ML metrics
   * @param {Array} testData - Array of test examples with {text, features, isHeader} structure
   * @param {number} totalLines - Total number of lines for position ratio calculation
   * @returns {Object} Object containing accuracy, precision, recall, F1 score, and confusion matrix
   */
  evaluateMetrics(testData, totalLines = 1000) {
    if (!this.trained) {
      throw new Error("Classifier not trained yet");
    }

    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;

    const predictions = [];
    const actualLabels = [];

    testData.forEach((example, index) => {
      const predicted = this.predict(example.text, index, totalLines);
      const actual = example.isHeader;

      predictions.push(predicted);
      actualLabels.push(actual);

      if (predicted && actual) {
        truePositives++;
      } else if (predicted && !actual) {
        falsePositives++;
      } else if (!predicted && !actual) {
        trueNegatives++;
      } else if (!predicted && actual) {
        falseNegatives++;
      }
    });

    // Calculate metrics
    const accuracy = (truePositives + trueNegatives) / testData.length;
    const precision =
      truePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;
    const recall =
      truePositives > 0 ? truePositives / (truePositives + falseNegatives) : 0;
    const f1Score =
      precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : 0;

    // Support metrics
    const support = {
      positive: truePositives + falseNegatives,
      negative: trueNegatives + falsePositives,
      total: testData.length,
    };

    return {
      accuracy: Math.round(accuracy * 10000) / 100,
      precision: Math.round(precision * 10000) / 100,
      recall: Math.round(recall * 10000) / 100,
      f1Score: Math.round(f1Score * 10000) / 100,
      confusionMatrix: {
        truePositives,
        falsePositives,
        trueNegatives,
        falseNegatives,
      },
      support,
    };
  }

  /**
   * Perform cross-validation to get more robust performance estimates
   * @param {Array} data - Full dataset for cross-validation
   * @param {number} folds - Number of cross-validation folds (default: 5)
   * @returns {Object} Cross-validation results with mean and std dev of metrics
   */
  crossValidate(data, folds = 5) {
    if (!data || data.length < folds) {
      throw new Error(`Dataset too small for ${folds}-fold cross-validation`);
    }

    const foldSize = Math.floor(data.length / folds);
    const results = [];

    for (let i = 0; i < folds; i++) {
      // Create train/test split
      const testStart = i * foldSize;
      const testEnd = i === folds - 1 ? data.length : (i + 1) * foldSize;

      const testData = data.slice(testStart, testEnd);
      const trainData = [...data.slice(0, testStart), ...data.slice(testEnd)];

      // Train on fold
      const foldClassifier = new SimpleHeaderClassifier();
      foldClassifier.train(trainData);

      // Evaluate on test fold
      const metrics = foldClassifier.evaluateMetrics(testData);
      results.push(metrics);
    }

    // Calculate mean and standard deviation
    const calculateStats = (values) => {
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance =
        values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
        values.length;
      const stdDev = Math.sqrt(variance);
      return {
        mean: Math.round(mean * 100) / 100,
        stdDev: Math.round(stdDev * 100) / 100,
      };
    };

    return {
      folds,
      accuracy: calculateStats(results.map((r) => r.accuracy)),
      precision: calculateStats(results.map((r) => r.precision)),
      recall: calculateStats(results.map((r) => r.recall)),
      f1Score: calculateStats(results.map((r) => r.f1Score)),
      individualFolds: results,
    };
  }

  /**
   * Generate a detailed classification report
   * @param {Array} testData - Test dataset
   * @param {number} totalLines - Total lines for position calculation
   * @returns {Object} Detailed report with per-class metrics and examples
   */
  generateClassificationReport(testData, totalLines = 100) {
    const metrics = this.evaluateMetrics(testData, totalLines);

    // Find misclassified examples
    const misclassified = {
      falsePositives: [],
      falseNegatives: [],
    };

    testData.forEach((example, index) => {
      const predicted = this.predict(example.text, index, totalLines);
      const actual = example.isHeader;

      if (predicted && !actual) {
        misclassified.falsePositives.push({
          text: example.text,
          features: example.features,
          index,
        });
      } else if (!predicted && actual) {
        misclassified.falseNegatives.push({
          text: example.text,
          features: example.features,
          index,
        });
      }
    });

    return {
      summary: {
        totalSamples: testData.length,
        headerSamples: metrics.support.positive,
        nonHeaderSamples: metrics.support.negative,
      },
      metrics,
      misclassified,
      classDistribution: {
        headers:
          Math.round((metrics.support.positive / testData.length) * 10000) /
          100,
        nonHeaders:
          Math.round((metrics.support.negative / testData.length) * 10000) /
          100,
      },
    };
  }
}

module.exports = { SimpleHeaderClassifier };
