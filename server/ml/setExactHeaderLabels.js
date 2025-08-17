/**
 * Updates isHeader to true for exact matches with detected_headers.json
 * @param {string} trainingDataPath - Path to header_training_data.json
 * @param {string} detectedHeadersPath - Path to detected_headers.json
 */
const fs = require("fs");
function setExactHeaderLabels(trainingDataPath, detectedHeadersPath) {
  const trainingData = JSON.parse(fs.readFileSync(trainingDataPath, "utf8"));
  const detectedHeaders = JSON.parse(
    fs.readFileSync(detectedHeadersPath, "utf8")
  );
  const detectedSet = new Set(
    detectedHeaders.map((h) => h.trim().toLowerCase())
  );

  let updatedCount = 0;
  trainingData.forEach((item) => {
    if (item.text && detectedSet.has(item.text.trim().toLowerCase())) {
      item.isHeader = true;
      updatedCount++;
    }
  });

  fs.writeFileSync(trainingDataPath, JSON.stringify(trainingData, null, 2));
  console.log(
    `Updated ${updatedCount} items as headers in ${trainingDataPath}`
  );
}

module.exports = { setExactHeaderLabels };

// Allow running as a standalone script
if (require.main === module) {
  const path = require("path");
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log(
      "Usage: node setExactHeaderLabels.js <header_training_data.json> <detected_headers.json>"
    );
    process.exit(1);
  }
  const trainingDataPath = path.resolve(args[0]);
  const detectedHeadersPath = path.resolve(args[1]);
  setExactHeaderLabels(trainingDataPath, detectedHeadersPath);
}
