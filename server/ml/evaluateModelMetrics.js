/**
 * ML Model Metrics Evaluation Script
 *
 * This script evaluates the header detection ML model using standard metrics:
 * - Accuracy: (TP + TN) / (TP + TN + FP + FN)
 * - Precision: TP / (TP + FP)
 * - Recall: TP / (TP + FN)
 * - F1 Score: 2 * (Precision * Recall) / (Precision + Recall)
 *
 * It also provides cross-validation and detailed classification reports.
 */

const fs = require("fs");
const path = require("path");
const { SimpleHeaderClassifier } = require("./simpleHeaderClassifier");

const TRAINING_DIR = path.join(__dirname, "../ml");
const MODEL_DIR = path.join(__dirname, "../models");
const MODEL_PATH = path.join(MODEL_DIR, "header_classifier.json");

/**
 * Split data into train/test sets
 * @param {Array} data - Full dataset
 * @param {number} testRatio - Ratio of data to use for testing (default: 0.2)
 * @returns {Object} Object with train and test arrays
 */
function trainTestSplit(data, testRatio = 0.2) {
  // Shuffle data randomly
  const shuffled = [...data].sort(() => Math.random() - 0.5);

  const testSize = Math.floor(data.length * testRatio);
  const testData = shuffled.slice(0, testSize);
  const trainData = shuffled.slice(testSize);

  return { trainData, testData };
}

/**
 * Evaluate model performance with detailed metrics
 */
async function evaluateModelMetrics() {
  try {
    console.log("🔍 Loading training data...");

    // Load training data
    const trainingDataPath = path.join(
      TRAINING_DIR,
      "header_training_data.json"
    );
    if (!fs.existsSync(trainingDataPath)) {
      console.error(
        "❌ Training data not found. Please run trainingDataGenerator.js first."
      );
      return;
    }

    const allData = JSON.parse(fs.readFileSync(trainingDataPath));
    console.log(`📊 Loaded ${allData.length} total examples`);

    // Create train/test split
    const { trainData, testData } = trainTestSplit(allData, 0.4);
    console.log(
      `🔄 Split: ${trainData.length} training, ${testData.length} testing`
    );

    // Class distribution analysis
    const trainHeaders = trainData.filter((item) => item.isHeader).length;
    const trainNonHeaders = trainData.length - trainHeaders;
    const testHeaders = testData.filter((item) => item.isHeader).length;
    const testNonHeaders = testData.length - testHeaders;

    console.log("\n📈 Class Distribution:");
    console.log(
      `Training set: ${trainHeaders} headers (${(
        (trainHeaders / trainData.length) *
        100
      ).toFixed(1)}%), ${trainNonHeaders} non-headers (${(
        (trainNonHeaders / trainData.length) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `Test set: ${testHeaders} headers (${(
        (testHeaders / testData.length) *
        100
      ).toFixed(1)}%), ${testNonHeaders} non-headers (${(
        (testNonHeaders / testData.length) *
        100
      ).toFixed(1)}%)`
    );

    // Train the model
    console.log("\n🤖 Training model...");
    const classifier = new SimpleHeaderClassifier();
    classifier.train(trainData);

    // Evaluate on test set
    console.log("📊 Evaluating on test set...");
    const testMetrics = classifier.evaluateMetrics(testData);

    // Display main metrics
    console.log("\n🎯 MODEL PERFORMANCE METRICS:");
    console.log("=".repeat(50));
    console.log(`Accuracy:  ${testMetrics.accuracy}%`);
    console.log(`Precision: ${testMetrics.precision}%`);
    console.log(`Recall:    ${testMetrics.recall}%`);
    console.log(`F1 Score:  ${testMetrics.f1Score}%`);

    // Display confusion matrix
    console.log("\n📋 CONFUSION MATRIX:");
    console.log("=".repeat(30));
    console.log("                Predicted");
    console.log("              Header | Non-Header");
    console.log(
      `Actual Header    ${testMetrics.confusionMatrix.truePositives
        .toString()
        .padStart(3)} |    ${testMetrics.confusionMatrix.falseNegatives
        .toString()
        .padStart(3)}`
    );
    console.log(
      `    Non-Header   ${testMetrics.confusionMatrix.falsePositives
        .toString()
        .padStart(3)} |    ${testMetrics.confusionMatrix.trueNegatives
        .toString()
        .padStart(3)}`
    );

    // Generate detailed classification report
    console.log("\n📝 Generating classification report...");
    const report = classifier.generateClassificationReport(testData, 1000);

    // Show misclassified examples
    if (report.misclassified.falsePositives.length > 0) {
      console.log(
        "\n❌ FALSE POSITIVES (Predicted Header, Actually Non-Header):"
      );
      console.log("-".repeat(60));
      report.misclassified.falsePositives.forEach((example, i) => {
        console.log(`${i + 1}. "${example.text}"`);
      });
    }

    if (report.misclassified.falseNegatives.length > 0) {
      console.log(
        "\n❌ FALSE NEGATIVES (Predicted Non-Header, Actually Header):"
      );
      console.log("-".repeat(60));
      report.misclassified.falseNegatives.slice(0, 5).forEach((example, i) => {
        console.log(
          `${i + 1}. "${example.text.substring(0, 60)}${
            example.text.length > 60 ? "..." : ""
          }"`
        );
      });
      if (report.misclassified.falseNegatives.length > 5) {
        console.log(
          `... and ${report.misclassified.falseNegatives.length - 5} more`
        );
      }
    }

    // Cross-validation evaluation
    console.log("\n🔄 Performing 5-fold cross-validation...");
    const cvResults = classifier.crossValidate(allData.slice(0, 1000), 5); // Use subset for faster CV

    console.log("\n🎯 CROSS-VALIDATION RESULTS:");
    console.log("=".repeat(50));
    console.log(
      `Accuracy:  ${cvResults.accuracy.mean}% ± ${cvResults.accuracy.stdDev}%`
    );
    console.log(
      `Precision: ${cvResults.precision.mean}% ± ${cvResults.precision.stdDev}%`
    );
    console.log(
      `Recall:    ${cvResults.recall.mean}% ± ${cvResults.recall.stdDev}%`
    );
    console.log(
      `F1 Score:  ${cvResults.f1Score.mean}% ± ${cvResults.f1Score.stdDev}%`
    );

    // Save metrics to file
    const metricsReport = {
      timestamp: new Date().toISOString(),
      datasetSize: {
        total: allData.length,
        train: trainData.length,
        test: testData.length,
      },
      testMetrics,
      crossValidation: cvResults,
      classificationReport: report,
    };

    const metricsPath = path.join(MODEL_DIR, "model_metrics.json");
    fs.writeFileSync(metricsPath, JSON.stringify(metricsReport, null, 2));

    // Performance interpretation
    console.log("\n💡 PERFORMANCE INTERPRETATION:");
    console.log("=".repeat(50));

    if (testMetrics.accuracy >= 90) {
      console.log("✅ Excellent accuracy - Model performs very well");
    } else if (testMetrics.accuracy >= 80) {
      console.log("✅ Good accuracy - Model performs well");
    } else if (testMetrics.accuracy >= 70) {
      console.log("⚠️  Fair accuracy - Model needs improvement");
    } else {
      console.log("❌ Poor accuracy - Model needs significant improvement");
    }

    if (testMetrics.precision >= 85 && testMetrics.recall >= 85) {
      console.log("✅ Well-balanced precision and recall");
    } else if (testMetrics.precision > testMetrics.recall + 10) {
      console.log(
        "⚠️  High precision, low recall - Model is conservative (misses headers)"
      );
    } else if (testMetrics.recall > testMetrics.precision + 10) {
      console.log(
        "⚠️  High recall, low precision - Model is aggressive (false alarms)"
      );
    }
  } catch (error) {
    console.error("❌ Error during evaluation:", error);
  }
}

/**
 * Quick metrics check for existing model
 */
async function quickMetricsCheck() {
  try {
    if (!fs.existsSync(MODEL_PATH)) {
      console.log(
        "❌ No trained model found. Please run trainHeaderClassifier.js first."
      );
      return;
    }

    const trainingDataPath = path.join(
      TRAINING_DIR,
      "header_training_data.json"
    );
    if (!fs.existsSync(trainingDataPath)) {
      console.log("❌ Training data not found.");
      return;
    }

    const data = JSON.parse(fs.readFileSync(trainingDataPath));
    const testData = data.slice(0, 200); // Quick test on subset

    const classifier = new SimpleHeaderClassifier();
    classifier.load(MODEL_PATH);

    const metrics = classifier.evaluateMetrics(testData);

    console.log("🚀 QUICK METRICS CHECK:");
    console.log("=".repeat(30));
    console.log(`Accuracy:  ${metrics.accuracy}%`);
    console.log(`Precision: ${metrics.precision}%`);
    console.log(`Recall:    ${metrics.recall}%`);
    console.log(`F1 Score:  ${metrics.f1Score}%`);
  } catch (error) {
    console.error("❌ Error during quick check:", error);
  }
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes("--quick")) {
    quickMetricsCheck();
  } else {
    evaluateModelMetrics();
  }
}

module.exports = {
  evaluateModelMetrics,
  quickMetricsCheck,
  trainTestSplit,
};
