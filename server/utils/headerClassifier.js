/**
 * Header Classifier using Natural Language Processing
 *
 * This module uses the natural library to classify header lines in CVs.
 */

const natural = require("natural");
const { LogisticRegressionClassifier } = natural;
const fs = require("fs");
const path = require("path");
const { PUBLICATION_PATTERNS } = require("./constants");

class HeaderClassifier {
  constructor() {
    this.classifier = new LogisticRegressionClassifier();
    this.trained = false;
  }

  /**
   * Extract features from a line of text
   */
  extractFeatures(line, lineIndex, totalLines) {
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

  /**
   * Train the classifier using labeled data
   */
  train(trainingData) {
    trainingData.forEach((item) => {
      // Use the features directly from the training data
      const featureString = Object.entries(item.features)
        .map(([key, value]) => `${key}:${value}`)
        .join(" ");

      this.classifier.addDocument(
        featureString,
        item.isHeader ? "header" : "not-header"
      );
    });

    this.classifier.train();
    this.trained = true;
  }

  /**
   * Predict if a line is a header
   */
  predict(line, lineIndex, totalLines) {
    if (!this.trained) {
      throw new Error("Classifier not trained yet");
    }

    const features = this.extractFeatures(line, lineIndex, totalLines);
    const featureString = Object.entries(features.features)
      .map(([key, value]) => `${key}:${value}`)
      .join(" ");

    const classification = this.classifier.classify(featureString);
    return classification === "header";
  }

  /**
   * Save the trained model to disk
   */
  save(modelPath) {
    if (!this.trained) {
      throw new Error("No trained model to save");
    }

    const modelData = {
      classifier: this.classifier.save(),
      trained: true,
    };

    fs.writeFileSync(modelPath, JSON.stringify(modelData));
  }

  /**
   * Load a trained model from disk
   */
  load(modelPath) {
    const modelData = JSON.parse(fs.readFileSync(modelPath));
    this.classifier.restore(modelData.classifier);
    this.trained = modelData.trained;
  }
}

module.exports = { HeaderClassifier };
