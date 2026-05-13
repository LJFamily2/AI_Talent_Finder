const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");

// Ensure environment variables are loaded
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = process.env.SUPABASE_BUCKET_NAME || "cv-uploads";

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "[Supabase Storage] Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from .env"
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Uploads a file buffer to Supabase Storage
 * @param {Buffer} fileBuffer - The file content
 * @param {string} fileName - The name to store the file as
 * @param {string} mimetype - The MIME type of the file
 * @returns {Promise<{path: string, error: any}>}
 */
async function uploadToSupabase(fileBuffer, fileName, mimetype) {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, fileBuffer, {
        contentType: mimetype,
        upsert: true,
      });

    return { path: data?.path, error };
  } catch (err) {
    console.error("[Supabase Storage] Upload error:", err);
    return { path: null, error: err };
  }
}

/**
 * Downloads a file from Supabase Storage
 * @param {string} fileName - The name of the file to download
 * @returns {Promise<{data: Buffer, error: any}>}
 */
async function downloadFromSupabase(fileName) {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(fileName);

    if (error) return { data: null, error };
    
    // Convert Blob/Stream to Buffer
    const arrayBuffer = await data.arrayBuffer();
    return { data: Buffer.from(arrayBuffer), error: null };
  } catch (err) {
    console.error("[Supabase Storage] Download error:", err);
    return { data: null, error: err };
  }
}

/**
 * Deletes a file from Supabase Storage
 * @param {string} fileName - The name of the file to delete
 * @returns {Promise<{success: boolean, error: any}>}
 */
async function deleteFromSupabase(fileName) {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .remove([fileName]);

    return { success: !error, error };
  } catch (err) {
    console.error("[Supabase Storage] Delete error:", err);
    return { success: false, error: err };
  }
}

/**
 * Generates a signed URL for temporary access to a private file
 * @param {string} fileName - The name of the file
 * @param {number} expiresIn - Expiration time in seconds (default 300s / 5 mins)
 * @returns {Promise<{signedUrl: string, error: any}>}
 */
async function getSignedUrl(fileName, expiresIn = 300) {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(fileName, expiresIn);

    return { signedUrl: data?.signedUrl, error };
  } catch (err) {
    console.error("[Supabase Storage] Signed URL error:", err);
    return { signedUrl: null, error: err };
  }
}

module.exports = {
  supabase,
  uploadToSupabase,
  downloadFromSupabase,
  deleteFromSupabase,
  getSignedUrl,
};
