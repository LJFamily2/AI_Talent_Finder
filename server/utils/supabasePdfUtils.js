const fs = require("fs");
const path = require("path");
const os = require("os");
const { downloadFromSupabase } = require("./supabaseStorage");
const { extractTextFromPDF } = require("./pdfUtils");

/**
 * Downloads a PDF from Supabase, saves it to a temporary file,
 * extracts its text, and cleans up the temporary file.
 * @param {string} fileName - The name of the file in Supabase storage
 * @returns {Promise<string>} The extracted text
 */
async function extractTextFromSupabasePDF(fileName) {
  const tempFilePath = path.join(os.tmpdir(), `cv-${Date.now()}-${fileName}`);
  
  try {
    const { data, error } = await downloadFromSupabase(fileName);
    if (error) {
      throw new Error(`Failed to download file from Supabase: ${error.message}`);
    }

    // Write buffer to temp file
    fs.writeFileSync(tempFilePath, data);

    // Extract text from the temp file
    const text = await extractTextFromPDF(tempFilePath);
    return text;
  } catch (err) {
    console.error("[Supabase PDF Utils] Extraction error:", err);
    throw err;
  } finally {
    // Clean up temp file
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupErr) {
        console.warn("[Supabase PDF Utils] Temp file cleanup failed:", cleanupErr.message);
      }
    }
  }
}

module.exports = {
  extractTextFromSupabasePDF,
};
