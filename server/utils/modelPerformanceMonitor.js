/**
 * Model Performance Monitor
 *
 * This utility provides ongoing monitoring of the ML model performance
 * and alerts when performance degrades significantly.
 */

const fs = require("fs");
const path = require("path");
const { SimpleHeaderClassifier } = require("./simpleHeaderClassifier");

const MODEL_DIR = path.join(__dirname, "../models");
const METRICS_HISTORY_PATH = path.join(MODEL_DIR, "metrics_history.json");
const MODEL_PATH = path.join(MODEL_DIR, "header_classifier.json");

/**
 * Performance thresholds for alerts
 */
const PERFORMANCE_THRESHOLDS = {
  accuracy: 75, // Minimum acceptable accuracy
  precision: 70, // Minimum acceptable precision
  recall: 70, // Minimum acceptable recall
  f1Score: 70, // Minimum acceptable F1 score
};

/**
 * Log performance metrics to history
 * @param {Object} metrics - Performance metrics object
 * @param {string} modelVersion - Model version identifier
 */
function logMetricsToHistory(metrics, modelVersion = null) {
  let history = [];

  // Load existing history
  if (fs.existsSync(METRICS_HISTORY_PATH)) {
    try {
      history = JSON.parse(fs.readFileSync(METRICS_HISTORY_PATH));
    } catch (error) {
      console.warn("Could not load metrics history:", error.message);
    }
  }

  // Add new entry
  const entry = {
    timestamp: new Date().toISOString(),
    modelVersion: modelVersion || `v${Date.now()}`,
    metrics: {
      accuracy: metrics.accuracy,
      precision: metrics.precision,
      recall: metrics.recall,
      f1Score: metrics.f1Score,
    },
    confusionMatrix: metrics.confusionMatrix,
  };

  history.push(entry);

  // Keep only last 50 entries
  if (history.length > 50) {
    history = history.slice(-50);
  }

  // Save updated history
  try {
    fs.writeFileSync(METRICS_HISTORY_PATH, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error("Could not save metrics history:", error.message);
  }
}

/**
 * Check if performance meets minimum thresholds
 * @param {Object} metrics - Performance metrics
 * @returns {Object} Alert status and details
 */
function checkPerformanceAlerts(metrics) {
  const alerts = [];

  if (metrics.accuracy < PERFORMANCE_THRESHOLDS.accuracy) {
    alerts.push({
      type: "ACCURACY_LOW",
      message: `Accuracy ${metrics.accuracy}% below threshold ${PERFORMANCE_THRESHOLDS.accuracy}%`,
      severity: "HIGH",
    });
  }

  if (metrics.precision < PERFORMANCE_THRESHOLDS.precision) {
    alerts.push({
      type: "PRECISION_LOW",
      message: `Precision ${metrics.precision}% below threshold ${PERFORMANCE_THRESHOLDS.precision}%`,
      severity: "MEDIUM",
    });
  }

  if (metrics.recall < PERFORMANCE_THRESHOLDS.recall) {
    alerts.push({
      type: "RECALL_LOW",
      message: `Recall ${metrics.recall}% below threshold ${PERFORMANCE_THRESHOLDS.recall}%`,
      severity: "MEDIUM",
    });
  }

  if (metrics.f1Score < PERFORMANCE_THRESHOLDS.f1Score) {
    alerts.push({
      type: "F1_LOW",
      message: `F1 Score ${metrics.f1Score}% below threshold ${PERFORMANCE_THRESHOLDS.f1Score}%`,
      severity: "MEDIUM",
    });
  }

  return {
    hasAlerts: alerts.length > 0,
    alerts,
    status: alerts.length === 0 ? "HEALTHY" : "NEEDS_ATTENTION",
  };
}

/**
 * Compare current performance with historical average
 * @param {Object} currentMetrics - Current performance metrics
 * @returns {Object} Comparison results
 */
function compareWithHistory(currentMetrics) {
  if (!fs.existsSync(METRICS_HISTORY_PATH)) {
    return { hasHistory: false };
  }

  try {
    const history = JSON.parse(fs.readFileSync(METRICS_HISTORY_PATH));

    if (history.length < 3) {
      return {
        hasHistory: false,
        message: "Insufficient history for comparison",
      };
    }

    // Calculate historical averages (last 10 entries)
    const recentHistory = history.slice(-10);
    const avgMetrics = {
      accuracy:
        recentHistory.reduce((sum, entry) => sum + entry.metrics.accuracy, 0) /
        recentHistory.length,
      precision:
        recentHistory.reduce((sum, entry) => sum + entry.metrics.precision, 0) /
        recentHistory.length,
      recall:
        recentHistory.reduce((sum, entry) => sum + entry.metrics.recall, 0) /
        recentHistory.length,
      f1Score:
        recentHistory.reduce((sum, entry) => sum + entry.metrics.f1Score, 0) /
        recentHistory.length,
    };

    // Calculate differences
    const differences = {
      accuracy: currentMetrics.accuracy - avgMetrics.accuracy,
      precision: currentMetrics.precision - avgMetrics.precision,
      recall: currentMetrics.recall - avgMetrics.recall,
      f1Score: currentMetrics.f1Score - avgMetrics.f1Score,
    };

    // Determine trend
    const significantThreshold = 5; // 5% change is significant
    const trends = {};

    Object.keys(differences).forEach((metric) => {
      const diff = differences[metric];
      if (Math.abs(diff) < significantThreshold) {
        trends[metric] = "STABLE";
      } else if (diff > 0) {
        trends[metric] = "IMPROVING";
      } else {
        trends[metric] = "DECLINING";
      }
    });

    return {
      hasHistory: true,
      historicalAverage: avgMetrics,
      currentMetrics,
      differences,
      trends,
      overallTrend: Object.values(trends).includes("DECLINING")
        ? "DECLINING"
        : Object.values(trends).includes("IMPROVING")
        ? "IMPROVING"
        : "STABLE",
    };
  } catch (error) {
    return { hasHistory: false, error: error.message };
  }
}

/**
 * Generate performance report
 * @param {Object} metrics - Current performance metrics
 * @returns {Object} Comprehensive performance report
 */
function generatePerformanceReport(metrics) {
  const alerts = checkPerformanceAlerts(metrics);
  const historical = compareWithHistory(metrics);

  return {
    timestamp: new Date().toISOString(),
    currentMetrics: metrics,
    alerts,
    historical,
    recommendations: generateRecommendations(metrics, alerts, historical),
  };
}

/**
 * Generate improvement recommendations based on performance
 * @param {Object} metrics - Performance metrics
 * @param {Object} alerts - Alert information
 * @param {Object} historical - Historical comparison
 * @returns {Array} Array of recommendations
 */
function generateRecommendations(metrics, alerts, historical) {
  const recommendations = [];

  // Low precision recommendations
  if (metrics.precision < 80) {
    recommendations.push({
      type: "PRECISION",
      message:
        "Consider increasing classification threshold or adding more negative training examples",
      priority: "HIGH",
    });
  }

  // Low recall recommendations
  if (metrics.recall < 80) {
    recommendations.push({
      type: "RECALL",
      message:
        "Consider decreasing classification threshold or adding more positive training examples",
      priority: "HIGH",
    });
  }

  // Imbalanced classes
  const { truePositives, falsePositives, trueNegatives, falseNegatives } =
    metrics.confusionMatrix;
  const totalPositives = truePositives + falseNegatives;
  const totalNegatives = trueNegatives + falsePositives;
  const imbalanceRatio =
    Math.max(totalPositives, totalNegatives) /
    Math.min(totalPositives, totalNegatives);

  if (imbalanceRatio > 10) {
    recommendations.push({
      type: "CLASS_IMBALANCE",
      message:
        "Severe class imbalance detected. Consider balancing training data or using class weights",
      priority: "MEDIUM",
    });
  }

  // Historical declining trend
  if (historical.hasHistory && historical.overallTrend === "DECLINING") {
    recommendations.push({
      type: "PERFORMANCE_DECLINE",
      message:
        "Performance is declining over time. Consider model retraining with fresh data",
      priority: "HIGH",
    });
  }

  return recommendations;
}

/**
 * Monitor model performance and save report
 * @param {Object} testData - Test dataset for evaluation
 */
async function monitorPerformance(testData = null) {
  try {
    if (!fs.existsSync(MODEL_PATH)) {
      console.log("❌ No trained model found for monitoring");
      return;
    }

    // Load model
    const classifier = new SimpleHeaderClassifier();
    classifier.load(MODEL_PATH);

    // Use provided test data or load from training data
    let evaluationData = testData;
    if (!evaluationData) {
      const trainingDataPath = path.join(
        __dirname,
        "../data/training/header_training_data.json"
      );
      if (fs.existsSync(trainingDataPath)) {
        const allData = JSON.parse(fs.readFileSync(trainingDataPath));
        evaluationData = allData.slice(0, 200); // Quick evaluation
      } else {
        console.log("❌ No test data available for monitoring");
        return;
      }
    }

    // Evaluate performance
    const metrics = classifier.evaluateMetrics(evaluationData);

    // Generate report
    const report = generatePerformanceReport(metrics);

    // Log to history
    logMetricsToHistory(metrics);

    // Display summary
    console.log("🔍 MODEL PERFORMANCE MONITOR");
    console.log("=".repeat(40));
    console.log(`Status: ${report.alerts.status}`);
    console.log(`Accuracy: ${metrics.accuracy}%`);
    console.log(`F1 Score: ${metrics.f1Score}%`);

    if (report.alerts.hasAlerts) {
      console.log("\n⚠️  PERFORMANCE ALERTS:");
      report.alerts.alerts.forEach((alert) => {
        console.log(`[${alert.severity}] ${alert.message}`);
      });
    }

    if (report.historical.hasHistory) {
      console.log(`\nTrend: ${report.historical.overallTrend}`);
    }

    if (report.recommendations.length > 0) {
      console.log("\n💡 RECOMMENDATIONS:");
      report.recommendations.forEach((rec) => {
        console.log(`[${rec.priority}] ${rec.message}`);
      });
    }

    // Save detailed report
    const reportPath = path.join(MODEL_DIR, "performance_report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📊 Full report saved to: ${reportPath}`);

    return report;
  } catch (error) {
    console.error("❌ Error during performance monitoring:", error);
  }
}

// Main execution when script is run directly
if (require.main === module) {
  monitorPerformance()
    .then(() => {
      console.log("✅ Performance monitoring completed");
    })
    .catch((error) => {
      console.error("❌ Performance monitoring failed:", error);
    });
}

module.exports = {
  monitorPerformance,
  checkPerformanceAlerts,
  compareWithHistory,
  generatePerformanceReport,
  logMetricsToHistory,
  PERFORMANCE_THRESHOLDS,
};
