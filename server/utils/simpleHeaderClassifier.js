/**
 * Simple Header Classifier
 *
 * A lightweight rule-based classifier that learns from training data
 */

const fs = require("fs");

class SimpleHeaderClassifier {
  constructor() {
    this.rules = {
      isAllUpperCase: { weight: 0 },
      startsWithNumberOrBracket: { weight: 0 },
      containsYear: { weight: 0 },
      lengthRange: { weight: 0, minLength: 3, maxLength: 50 },
      positionRatio: { weight: 0 },
      wordCount: { weight: 0, maxWords: 8 },
      hasColon: { weight: 0 },
      matchesPublicationPattern: { weight: 0 },
      endsWithPeriodOrPercent: { weight: 0 },
      isShort: { weight: 0 },
      indentationLevel: { weight: 0 },
    };
    this.trained = false;
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
      case "startsWithNumberOrBracket":
        return features.startsWithNumberOrBracket;
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
      case "endsWithPeriodOrPercent":
        return features.endsWithPeriodOrPercent;
      case "isShort":
        return features.isShort;
      case "indentationLevel":
        return features.indentationLevel === 0;
      default:
        return false;
    }
  }

  /**
   * Extract features from a line
   */
  extractFeatures(line, lineIndex, totalLines) {
    const { PUBLICATION_PATTERNS } = require("./constants");
    return {
      isAllUpperCase: line === line.toUpperCase(),
      startsWithNumberOrBracket: /^\s*(\[\w+\]|\d+\.)/.test(line),
      containsYear: /\b(19|20)\d{2}\b/.test(line),
      length: line.length,
      positionRatio: lineIndex / totalLines,
      wordCount: line.split(/\s+/).filter(Boolean).length,
      hasColon: line.includes(":"),
      matchesPublicationPattern: PUBLICATION_PATTERNS.some((pattern) =>
        pattern.test(line)
      ),
      endsWithPeriodOrPercent: /[\.%)]\s*$/.test(line),
      isShort: line.trim().length < 5,
      indentationLevel: line.search(/\S/),
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

    // Post-processing filter: only accept as header if matchesPublicationPattern is true
    if (!features.matchesPublicationPattern) {
      return false;
    }

    return score > 1.2;
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
}

module.exports = { SimpleHeaderClassifier };
