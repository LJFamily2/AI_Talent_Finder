/**
 * Header Classifier Utility
 *
 * Shared utility for initializing and managing the ML-based header classifier
 * used across multiple CV verification controllers.
 *
 * @module headerClassifierUtils
 * @author AI Talent Finder Team
 * @version 1.0.0
 */

const fs = require("fs");
const path = require("path");
const { SimpleHeaderClassifier } = require("../ml/simpleHeaderClassifier");

/**
 * Initialize and load the header classifier ML model
 * @param {string} controllerName - Name of the controller for logging (optional)
 * @returns {Object|null} Trained header classifier or null if loading fails
 */
function initializeHeaderClassifier(controllerName = "CV Verification") {
  try {
    const classifier = new SimpleHeaderClassifier();
    const modelPath = path.join(__dirname, "../ml/header_classifier.json");

    if (fs.existsSync(modelPath)) {
      classifier.load(modelPath);
      console.log(
        `[${controllerName}] Header classifier model loaded successfully`
      );
      return classifier;
    } else {
      console.warn(
        `[${controllerName}] Header classifier model not found, using fallback`
      );
      return null;
    }
  } catch (error) {
    console.error(
      `[${controllerName}] Error loading header classifier:`,
      error
    );
    return null;
  }
}

module.exports = {
  initializeHeaderClassifier,
};
