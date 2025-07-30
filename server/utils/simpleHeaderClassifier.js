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
      lengthRange: { weight: 0, minLength: 3, maxLength: 30 },
      positionRatio: { weight: 0 },
      wordCount: { weight: 0, maxWords: 10 },
      hasColon: { weight: 0 },
      matchesPublicationPattern: { weight: 0 },
    };
    this.trained = false;
    this.knownHeaders = [];
    this.loadKnownHeaders();
  }

  /**
   * Load known headers from detected_headers.json
   */
  loadKnownHeaders() {
    try {
      const headersPath = path.join(
        __dirname,
        "../data/training/detected_headers.json"
      );
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
    console.log(`Training with ${trainingData.length} examples...`);

    const headerExamples = trainingData.filter((item) => item.isHeader);
    const nonHeaderExamples = trainingData.filter((item) => !item.isHeader);

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

      const headerRatio = headerCount / headerExamples.length;
      const nonHeaderRatio = nonHeaderCount / nonHeaderExamples.length;

      // Weight is positive if feature is more common in headers
      this.rules[feature].weight = headerRatio - nonHeaderRatio;

      console.log(
        `${feature}: header=${headerRatio.toFixed(
          3
        )}, non-header=${nonHeaderRatio.toFixed(3)}, weight=${this.rules[
          feature
        ].weight.toFixed(3)}`
      );
    });

    this.trained = true;
    console.log("Training completed!");
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
        return (
          features.length >= this.rules.lengthRange.minLength &&
          features.length <= this.rules.lengthRange.maxLength &&
          features.length <= 50
        ); // Most headers are shorter
      case "positionRatio":
        return features.positionRatio < 0.8; // Headers usually appear earlier
      case "wordCount":
        return features.wordCount <= this.rules.wordCount.maxWords;
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
    return {
      isAllUpperCase: line === line.toUpperCase(),
      containsYear: /\b(19|20)\d{2}\b/.test(line),
      length: line.length,
      positionRatio: lineIndex / totalLines,
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

    // No need to check isKnownHeader separately since we're using it in matchesPublicationPattern
    if (
      this.knownHeaders.some(
        (header) => line.trim().toLowerCase() === header.trim().toLowerCase()
      )
    ) {
      score += 1; // Give boost only for exact header match
    }

    if (features.wordCount === 1) {
      score -= 1.0;
    }

    Object.keys(this.rules).forEach((feature) => {
      if (this.evaluateFeature(feature, features)) {
        score += this.rules[feature].weight;
      }
    });

    // Post-processing: Must match known publication headers
    if (!features.matchesPublicationPattern) {
      return false;
    }

    return score > 1.7;
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
