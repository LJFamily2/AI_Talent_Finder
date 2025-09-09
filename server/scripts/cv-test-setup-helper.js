/**
 * CV Test Setup Helper
 *
 * This script helps you prepare the test_cvs folder structure
 * and verify that CV files exist for ground truth data.
 *
 * Usage:
 *   node cv-test-setup-helper.js [--create-structure] [--sample=5]
 */

const fs = require("fs").promises;
const path = require("path");

const CONFIG = {
  groundTruthPath: path.join(__dirname, "../data/ground_truth_final.json"),
  testCvsFolder: path.join(__dirname, "../data/test_cvs"),
};

async function loadGroundTruth() {
  try {
    console.log(`📖 Loading ground truth from: ${CONFIG.groundTruthPath}`);
    const data = await fs.readFile(CONFIG.groundTruthPath, "utf8");
    const parsed = JSON.parse(data);
    console.log(`✅ Successfully loaded ground truth data`);
    return parsed;
  } catch (error) {
    console.error("❌ Error loading ground truth:", error.message);
    if (error.code === "ENOENT") {
      console.error(`📁 File not found: ${CONFIG.groundTruthPath}`);
    } else if (error.name === "SyntaxError") {
      console.error(`📄 Invalid JSON format in ground truth file`);
    }
    throw error;
  }
}

/**
 * Create basic flat file structure for missing CVs
 */
async function createFolderStructure(missingCvs, limit = 10) {
  console.log(
    `\n📁 Creating flat file structure for ${Math.min(
      limit,
      missingCvs.length
    )} missing CVs...`
  );

  try {
    await fs.mkdir(CONFIG.testCvsFolder, { recursive: true });

    const cvsToCreate = missingCvs.slice(0, limit);

    // Create a single README file with instructions
    const readmePath = path.join(CONFIG.testCvsFolder, "README.txt");
    const readmeContent = `CV Test Files - Simple Structure

Place your CV files directly in this folder with these names:

${cvsToCreate.map((name) => `- ${name}.pdf`).join("\n")}

This folder structure was created by cv-test-setup-helper.js
Delete this README file after adding your CV files.

Expected structure:
test_cvs/
├── CV_Name_1.pdf
├── CV_Name_2.pdf
└── CV_Name_3.pdf

`;

    await fs.writeFile(readmePath, readmeContent);
    console.log(`  ✅ Created: test_cvs/README.txt with instructions`);
    console.log(`  📝 Add your CV files directly to test_cvs/ folder`);

    console.log(`\n📋 Expected files to create:`);
    cvsToCreate.forEach((name) => {
      console.log(`  - ${name}.pdf`);
    });

    console.log(
      `\n📝 Simple structure created. Just add PDF files directly to test_cvs/`
    );
  } catch (error) {
    console.error(`❌ Error creating folder structure:`, error.message);
  }
}

async function checkCVAvailability() {
  console.log("🔍 CV Test Setup Helper");
  console.log("=".repeat(50));

  try {
    const groundTruthData = await loadGroundTruth();
    const cvNames = Object.keys(groundTruthData);

    console.log(`\n📊 Ground truth contains ${cvNames.length} CVs`);

    // Check if test_cvs folder exists
    try {
      await fs.access(CONFIG.testCvsFolder);
      console.log(`✅ test_cvs folder exists at: ${CONFIG.testCvsFolder}`);
    } catch {
      console.log(`❌ test_cvs folder not found at: ${CONFIG.testCvsFolder}`);
      console.log(`📁 Creating test_cvs folder...`);
      await fs.mkdir(CONFIG.testCvsFolder, { recursive: true });
      console.log(`✅ Created test_cvs folder`);
    }

    const found = [];
    const missing = [];
    const corrupted = [];

    console.log(`\n🔍 Checking CV file availability:`);
    console.log("-".repeat(60));

    // Check all CVs, but only display first 10 in detail
    const samplesToShow = Math.min(10, cvNames.length);

    for (let idx = 0; idx < cvNames.length; idx++) {
      const cvName = cvNames[idx];
      const possiblePaths = [
        // Prefer flat structure first
        path.join(CONFIG.testCvsFolder, `${cvName}.pdf`),
        // Fallback to folder structure for backward compatibility
        path.join(CONFIG.testCvsFolder, cvName, `${cvName}.pdf`),
        path.join(CONFIG.testCvsFolder, cvName, "cv.pdf"),
        path.join(CONFIG.testCvsFolder, cvName, "resume.pdf"),
      ];

      let foundPath = null;
      let isCorrupted = false;

      for (const filePath of possiblePaths) {
        try {
          await fs.access(filePath);
          // Check if file is not empty
          const stats = await fs.stat(filePath);
          if (stats.size > 0) {
            foundPath = filePath;
            break;
          } else {
            isCorrupted = true;
          }
        } catch {
          continue;
        }
      }

      if (foundPath) {
        found.push({ name: cvName, path: foundPath });
        if (idx < samplesToShow) {
          console.log(`✅ ${cvName}`);
        }
      } else if (isCorrupted) {
        corrupted.push(cvName);
        if (idx < samplesToShow) {
          console.log(`⚠️  ${cvName} (empty file found)`);
        }
      } else {
        missing.push(cvName);
        if (idx < samplesToShow) {
          console.log(`❌ ${cvName}`);
        }
      }
    }

    if (cvNames.length > samplesToShow) {
      console.log(
        `... checked remaining ${cvNames.length - samplesToShow} CVs ...`
      );
    }

    console.log("\n" + "=".repeat(60));
    console.log(`📈 Summary:`);
    console.log(`✅ Found: ${found.length}/${cvNames.length} CVs`);
    console.log(`❌ Missing: ${missing.length}/${cvNames.length} CVs`);
    if (corrupted.length > 0) {
      console.log(`⚠️  Corrupted: ${corrupted.length}/${cvNames.length} CVs`);
    }

    if (missing.length > 0) {
      console.log(`\n📋 Missing CV files:`);
      missing.slice(0, 20).forEach((name) => console.log(`  - ${name}`));
      if (missing.length > 20) {
        console.log(`  ... and ${missing.length - 20} more`);
      }

      console.log(
        `\n📁 Expected file locations (simpler flat structure recommended):`
      );
      console.log(`  ${CONFIG.testCvsFolder}/<cv_name>.pdf`);
      console.log(`  `);
      console.log(`📁 Alternative folder structure also supported:`);
      console.log(`  ${CONFIG.testCvsFolder}/<cv_name>/<cv_name>.pdf`);
      console.log(`  ${CONFIG.testCvsFolder}/<cv_name>/cv.pdf`);
      console.log(`  ${CONFIG.testCvsFolder}/<cv_name>/resume.pdf`);
    }

    if (corrupted.length > 0) {
      console.log(`\n⚠️  Corrupted CV files (empty or unreadable):`);
      corrupted.slice(0, 10).forEach((name) => console.log(`  - ${name}`));
      if (corrupted.length > 10) {
        console.log(`  ... and ${corrupted.length - 10} more`);
      }
    }

    console.log(`\n📊 Ground truth statistics:`);

    // Analyze ground truth data
    let totalPublications = 0;
    let totalVerified = 0;
    let cvSizes = [];

    Object.values(groundTruthData).forEach((cv) => {
      totalPublications += cv.publications.length;
      totalVerified += cv.publications.filter(
        (p) => p.verifiedStatus === true
      ).length;
      if (cv.cvSize) cvSizes.push(cv.cvSize);
    });

    console.log(`  📄 Total publications: ${totalPublications}`);
    console.log(
      `  ✅ Verified publications: ${totalVerified} (${(
        (totalVerified / totalPublications) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `  📏 Avg CV size: ${
        cvSizes.length > 0
          ? Math.round(cvSizes.reduce((a, b) => a + b) / cvSizes.length)
          : "N/A"
      } chars`
    );

    // Sample CV names for reference
    console.log(`\n📋 Sample CV names from ground truth:`);
    cvNames.slice(0, 5).forEach((name) => {
      const cv = groundTruthData[name];
      console.log(
        `  - ${name} (${cv.publications.length} pubs, ${cv.candidateName})`
      );
    });

    // Check command line arguments for actions
    const args = process.argv.slice(2);
    const createStructure = args.includes("--create-structure");
    const sampleArg = args.find((arg) => arg.startsWith("--sample="));
    const sampleLimit = sampleArg ? parseInt(sampleArg.split("=")[1]) : 10;

    if (createStructure && missing.length > 0) {
      await createFolderStructure(missing, sampleLimit);
    }

    // Final recommendations
    console.log(`\n🎯 === RECOMMENDATIONS ===`);

    if (found.length > 0) {
      console.log(`✅ Ready to run comparison with ${found.length} CVs`);
      console.log(`🚀 Run: node enhanced-cv-verification-comparison.js`);
    }

    if (missing.length > 0) {
      console.log(`📁 ${missing.length} CV files are missing`);
      console.log(`💡 Run with --create-structure to create folder structure`);
      console.log(
        `   Example: node cv-test-setup-helper.js --create-structure --sample=20`
      );
    }

    if (corrupted.length > 0) {
      console.log(
        `⚠️  ${corrupted.length} CV files need to be fixed (empty or corrupted)`
      );
    }

    if (found.length === 0) {
      console.log(
        `⚠️  Please add CV files to the test_cvs folder before running comparison`
      );
    }
  } catch (error) {
    console.error("❌ Error during CV availability check:", error.message);
    throw error;
  }
}

if (require.main === module) {
  console.log("🔍 Starting CV Test Setup Helper...\n");

  checkCVAvailability()
    .then(() => {
      console.log("\n✅ Setup check completed successfully");
    })
    .catch((error) => {
      console.error("\n❌ Setup check failed:", error.message);
      if (error.stack) {
        console.error("\n📋 Stack trace:");
        console.error(error.stack);
      }
      process.exit(1);
    });
}

module.exports = {
  checkCVAvailability,
  loadGroundTruth,
  createFolderStructure,
};
