const mongoose = require("mongoose");
const Researcher = require("../models/Researcher");
const dotenv = require("dotenv");
const path = require("path");
dotenv.config({ path: path.join(__dirname, "../.env") });

// Simple slug generator - inline function
const generateSlug = (name) => {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters except hyphens
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
};

// Function to generate unique slug
const generateUniqueSlug = async (name, excludeId = null) => {
  let baseSlug = generateSlug(name);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const query = { slug };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existingResearcher = await Researcher.findOne(query);
    if (!existingResearcher) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

// Main migration function
const runMigration = async () => {
  try {
    // Connect to database
    await mongoose.connect(
      process.env.MONGODB_URI,
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );
    console.log("MongoDB connected successfully");

    console.log("Starting slug migration for researchers...");

    // Find all researchers without slugs
    const researchers = await Researcher.find({
      $or: [{ slug: { $exists: false } }, { slug: "" }, { slug: null }],
    });

    console.log(`Found ${researchers.length} researchers without slugs`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const researcher of researchers) {
      try {
        if (!researcher.name || researcher.name.trim() === "") {
          console.log(
            `Skipping researcher ${researcher._id} - no name provided`
          );
          continue;
        }

        const uniqueSlug = await generateUniqueSlug(
          researcher.name,
          researcher._id
        );

        await Researcher.findByIdAndUpdate(
          researcher._id,
          { slug: uniqueSlug },
          { new: true }
        );

        console.log(
          `Updated researcher "${researcher.name}" with slug: "${uniqueSlug}"`
        );
        updatedCount++;

        // Add a small delay every 100 updates
        if (updatedCount % 100 === 0) {
          console.log(`Processed ${updatedCount} researchers...`);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(
          `Error updating researcher ${researcher._id}:`,
          error.message
        );
        errorCount++;
      }
    }

    console.log(`\nMigration completed!`);
    console.log(`Successfully updated: ${updatedCount} researchers`);
    console.log(`Errors encountered: ${errorCount} researchers`);

    // Verify the results
    const totalResearchers = await Researcher.countDocuments();
    const researchersWithSlugs = await Researcher.countDocuments({
      slug: { $exists: true, $ne: "", $ne: null },
    });

    console.log(`\nVerification:`);
    console.log(`Total researchers: ${totalResearchers}`);
    console.log(`Researchers with slugs: ${researchersWithSlugs}`);
    console.log(
      `Researchers without slugs: ${totalResearchers - researchersWithSlugs}`
    );
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await mongoose.connection.close();
    console.log("Database connection closed");
  }
};

// Run the migration
runMigration();
