/**
 * Grok AI-Based CV Verification Controller
 *
 * This controller provides Grok AI-powered academic CV verification that focuses on
 * publication verification and author matching without external API dependencies.
 * It uses Grok AI (via OpenRouter) to:
 * - Verify if publications exist online
 * - Extract publication details and find links
 * - Match candidate names with publication authors
 * - Return results in the same format as traditional verification
 *
 * @module grokAiCvVerification
 * @author SwangLee
 * @version 1.0.0
 */

const fs = require("fs");
const OpenAI = require("openai");
const { extractTextFromPDF } = require("../utils/pdfUtils");
const { aggregateAuthorDetails } = require("../utils/authorDetailsAggregator");
const {
  initializeHeaderClassifier,
} = require("../utils/headerClassifierUtils");
const axios = require("axios");
const path = require("path");

//=============================================================================
// CONSTANTS
//=============================================================================

const MAX_CHUNK_SIZE = 8000;
const MAX_COMBINED_SIZE = 8000;

//=============================================================================
// ML MODEL INITIALIZATION
//=============================================================================

// Initialize the header classifier
const headerClassifier = initializeHeaderClassifier("Grok CV Verification");

//=============================================================================
// MODULE EXPORTS
//=============================================================================

module.exports = {
  verifyCVWithGrok,
};

//=============================================================================
// MAIN GROK CV VERIFICATION FUNCTION
//=============================================================================

/**
 * Main function for Grok AI-based academic CV verification
 *
 * Processes a CV file through Grok AI-powered verification pipeline:
 * 1. Parse PDF to extract text content
 * 2. Extract candidate name using Grok AI
 * 3. Extract publications using Grok AI
 * 4. Verify each publication exists online using Grok AI
 * 5. Match candidate name against publication authors
 * 6. Generate verification report in traditional format
 *
 * @param {Object} file - Uploaded CV file object with path property
 * @param {string} prioritySource - Priority source for verification (optional)
 * @returns {Promise<Object>} Verification results in traditional format
 */
async function verifyCVWithGrok(file, prioritySource = "grok") {
  let cvText = "";

  try {
    console.log("[Grok CV Verification] Starting CV verification process");

    // Parse PDF to text (with OCR fallback)
    cvText = await extractTextFromPDF(file.path);

    if (!cvText || cvText.trim().length === 0) {
      throw new Error("Failed to extract text from CV file");
    }

    console.log(
      `[Grok CV Verification] Extracted CV text: ${cvText.length} characters`
    );

    // Initialize OpenRouter client for Grok AI
    const grokClient = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    });

    // Extract candidate name using Grok AI
    const candidateName = await extractCandidateNameWithGrok(
      grokClient,
      cvText
    );
    console.log(
      `[Grok CV Verification] Extracted candidate name: ${candidateName}`
    );

    // Process CV with Grok AI for publication verification
    let verificationResults = [];
    verificationResults = await processFullCVWithGrok(
      grokClient,
      cvText,
      candidateName
    );

    // Remove duplicates
    verificationResults = removeDuplicatePublications(verificationResults);

    console.log(
      `[Grok CV Verification] Completed verification for ${verificationResults.length} publications`
    );

    // Get author profile from APIs (not AI-generated)
    const authorProfile = await getAuthorProfileFromAPIs(
      candidateName,
      verificationResults
    );

    return {
      success: true,
      candidateName: candidateName,
      total: verificationResults.length,
      verifiedPublications: verificationResults.filter(
        (r) =>
          r.verification.displayData.status === "verified" ||
          r.verification.displayData.status ===
            "verified but not same author name"
      ).length,
      verifiedWithAuthorMatch: verificationResults.filter(
        (r) => r.verification.displayData.status === "verified"
      ).length,
      verifiedButDifferentAuthor: verificationResults.filter(
        (r) =>
          r.verification.displayData.status ===
          "verified but not same author name"
      ).length,
      results: verificationResults,
      authorDetails: authorProfile,
    };
  } catch (error) {
    console.error("[Grok CV Verification] Error during verification:", error);
    throw new Error(`CV verification failed: ${error.message}`);
  } finally {
    // Clean up temporary file
    if (file && file.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
        console.log("[Grok CV Verification] Cleaned up temporary file");
      } catch (cleanupError) {
        console.warn(
          "[Grok CV Verification] Failed to clean up temporary file:",
          cleanupError
        );
      }
    }
  }
}

//=============================================================================
// GROK AI-SPECIFIC FUNCTIONS
//=============================================================================

/**
 * Extract candidate name using Grok AI
 * @param {OpenAI} grokClient - OpenRouter client configured for Grok AI
 * @param {string} cvText - CV text content
 * @returns {Promise<string>} Candidate name
 */
async function extractCandidateNameWithGrok(grokClient, cvText) {
  const prompt = `You are an expert CV analyzer.
From the text of this CV/resume, extract ONLY the full name of the candidate/person whose CV this is.
Return ONLY the name as plain text - no explanation, no JSON, no additional information.
If you cannot determine the name with high confidence, return "UNKNOWN".

CV TEXT:
${cvText.substring(0, 2000)}`; // Only need the beginning of the CV

  try {
    const response = await grokClient.chat.completions.create({
      model: "x-ai/grok-code-fast-1",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0,
    });

    const candidateName = response.choices[0].message.content.trim();
    console.log(
      `[Grok CV Verification] Extracted candidate name: ${candidateName}`
    );
    return candidateName === "UNKNOWN" ? null : candidateName;
  } catch (error) {
    console.error(
      "[Grok CV Verification] Error extracting candidate name:",
      error
    );
    return null;
  }
}

/**
 * Process full CV content with Grok AI to directly verify publications online
 * Handles large CVs by chunking them into manageable pieces
 * @param {OpenAI} grokClient - OpenRouter client configured for Grok AI
 * @param {string} cvText - Full CV text content
 * @param {string} candidateName - Candidate name
 * @returns {Promise<Array>} Verification results array
 */
async function processFullCVWithGrok(grokClient, cvText, candidateName) {
  try {
    if (cvText.length <= MAX_CHUNK_SIZE) {
      console.log(
        "[Grok CV Verification] Processing small CV directly without chunking"
      );
      return await processSmallCVDirectly(grokClient, cvText, candidateName);
    } else {
      console.log(
        "[Grok CV Verification] Processing large CV with chunking or ML-based sections"
      );
      return await processLargeCVWithChunking(
        grokClient,
        cvText,
        candidateName
      );
    }
  } catch (error) {
    console.error(
      "[Grok CV Verification] Error in processFullCVWithGrok:",
      error
    );
    // Fallback to basic extraction
    return await fallbackPublicationExtraction(
      grokClient,
      cvText,
      candidateName
    );
  }
}

/**
 * Process small CV directly without chunking
 * @param {OpenAI} grokClient - OpenRouter client configured for Grok AI
 * @param {string} cvText - Full CV text content
 * @param {string} candidateName - Candidate name
 * @returns {Promise<Array>} Verification results array
 */
async function processSmallCVDirectly(grokClient, cvText, candidateName) {
  console.log(
    `[Grok CV Verification] Processing small CV for ${candidateName}`
  );
  const directVerificationPrompt = `
You are an expert at analyzing academic CV content. Your task is to extract ALL publications from this CV and verify each one online.

CANDIDATE NAME: ${candidateName || "Unknown"}

FULL CV CONTENT:
${cvText}

Extract ALL publications from the CV and verify each one. For each publication found (whether verified online or not), provide the following JSON format:

{
  "allPublications": [
    {
      "publication": {
        "title": "extracted title",
        "authors": ["list", "of", "authors"],
        "year": "publication year",
        "venue": "journal/conference name", 
        "type": "journal/conference/book chapter/etc",
        "doi": "DOI if available",
        "fullText": "original text from CV"
      },
      "verification": {
        "isOnline": true/false,
        "hasAuthorMatch": true/false,
        "link": "get the publication link or null",
        "citationCount": "get from real source"
      }
    }
  ]
}

EXTRACTION AND VERIFICATION GUIDELINES:
1. Extract ALL publications listed in the CV (journal articles, conference papers, book chapters, etc.)
2. For each publication, determine if it likely exists online (isOnline: true/false)
3. Verify if the candidate name appears in the author list (hasAuthorMatch: true/false)
4. For verified publications, provide links of the publication (DOI links preferred, then Google Scholar)
5. For unverified publications, set isOnline: false, link: null, citationCount: 0
6. Estimate citation counts only for verified publications
7. IMPORTANT: Include ALL publications found in CV, not just verified ones

IMPORTANT: Return ONLY the JSON object. Do not include any markdown formatting, explanations, or code blocks. Start your response with { and end with }.`;

  try {
    const response = await grokClient.chat.completions.create({
      model: "x-ai/grok-code-fast-1",
      messages: [
        {
          role: "user",
          content: directVerificationPrompt,
        },
      ],
      extra_headers: {
        "HTTP-Referer": "https://talent-finder.com",
        "X-Title": "AI Talent Finder",
      },
      temperature: 0.0,
      max_tokens: 4000,
    });

    const verificationText = cleanJSONResponse(
      response.choices[0].message.content
    );
    const parsedResult = JSON.parse(verificationText);

    if (
      parsedResult.allPublications &&
      Array.isArray(parsedResult.allPublications)
    ) {
      console.log(
        `[Grok CV Verification] Successfully extracted ${parsedResult.allPublications.length} publications`
      );

      return parsedResult.allPublications.map((item) =>
        transformPublicationResult(item.publication, item.verification)
      );
    } else {
      console.warn(
        "[Grok CV Verification] Unexpected response format, using fallback"
      );
      return await fallbackPublicationExtraction(
        grokClient,
        cvText,
        candidateName
      );
    }
  } catch (error) {
    console.error(
      "[Grok CV Verification] Error in processSmallCVDirectly:",
      error
    );
    return await fallbackPublicationExtraction(
      grokClient,
      cvText,
      candidateName
    );
  }
}

/**
 * Process large CV by chunking it into smaller pieces
 * @param {OpenAI} grokClient - OpenRouter client configured for Grok AI
 * @param {string} cvText - Full CV text content
 * @param {string} candidateName - Candidate name
 * @returns {Promise<Array>} Verification results array
 */
async function processLargeCVWithChunking(grokClient, cvText, candidateName) {
  try {
    // First try ML-based section detection if classifier is available
    if (headerClassifier) {
      console.log(
        "[Grok CV Verification] Using ML-based publication section detection"
      );
      const publicationSections = extractPublicationSectionsWithML(
        cvText,
        headerClassifier
      );

      if (publicationSections.length > 0) {
        return await processBatchedPublicationSectionsWithGrok(
          grokClient,
          publicationSections,
          candidateName
        );
      }
    }

    // Fallback to chunking approach
    console.log("[Grok CV Verification] Using chunking approach for large CV");
    const chunks = chunkCVText(cvText, MAX_CHUNK_SIZE);
    return await processBatchedChunksWithGrok(
      grokClient,
      chunks,
      candidateName
    );
  } catch (error) {
    console.error(
      "[Grok CV Verification] Error in processLargeCVWithChunking:",
      error
    );
    return await fallbackPublicationExtraction(
      grokClient,
      cvText,
      candidateName
    );
  }
}

/**
 * Fallback publication extraction if direct verification fails
 * @param {OpenAI} grokClient - OpenRouter client configured for Grok AI
 * @param {string} cvText - CV text content
 * @param {string} candidateName - Candidate name
 * @returns {Promise<Array>} Basic verification results
 */
async function fallbackPublicationExtraction(
  grokClient,
  cvText,
  candidateName
) {
  console.log("[Grok CV Verification] Using fallback publication extraction");

  try {
    const extractionPrompt = `Extract all publications from this CV. Return a simple JSON array of publication titles only:

CV TEXT:
${cvText.substring(0, 5000)}

Return format: {"publications": ["title1", "title2", ...]}`;

    const response = await grokClient.chat.completions.create({
      model: "x-ai/grok-code-fast-1",
      messages: [
        {
          role: "user",
          content: extractionPrompt,
        },
      ],
      extra_headers: {
        "HTTP-Referer": "https://talent-finder.com",
        "X-Title": "AI Talent Finder",
      },
      temperature: 0.0,
      max_tokens: 2000,
    });

    const result = JSON.parse(
      cleanJSONResponse(response.choices[0].message.content)
    );

    if (result.publications && Array.isArray(result.publications)) {
      return result.publications.map((title) =>
        transformPublicationResult(
          { title, authors: [], year: "Unknown" },
          {
            isOnline: false,
            hasAuthorMatch: false,
            link: null,
            citationCount: 0,
          }
        )
      );
    }

    return [];
  } catch (error) {
    console.error(
      "[Grok CV Verification] Error in fallback extraction:",
      error
    );
    return [];
  }
}

/**
 * Process multiple CV chunks in batched Grok AI requests
 * Combines chunks to reduce API calls while staying within token limits
 * @param {OpenAI} grokClient - OpenRouter client configured for Grok AI
 * @param {Array} chunks - Array of CV text chunks
 * @param {string} candidateName - Candidate name
 * @returns {Promise<Array>} Array of verified publications from all chunks
 */
async function processBatchedChunksWithGrok(grokClient, chunks, candidateName) {
  const batchedChunks = [];

  // Group chunks into batches that fit within token limits
  let currentBatch = [];
  let currentSize = 0;

  for (const chunk of chunks) {
    if (
      currentSize + chunk.length > MAX_COMBINED_SIZE &&
      currentBatch.length > 0
    ) {
      batchedChunks.push(currentBatch);
      currentBatch = [chunk];
      currentSize = chunk.length;
    } else {
      currentBatch.push(chunk);
      currentSize += chunk.length;
    }
  }

  // Add the last batch
  if (currentBatch.length > 0) {
    batchedChunks.push(currentBatch);
  }

  console.log(
    `[Grok CV Verification] Grouped ${chunks.length} chunks into ${batchedChunks.length} batched requests`
  );

  const allResults = [];

  // Process each batch
  for (let i = 0; i < batchedChunks.length; i++) {
    const batch = batchedChunks[i];
    const combinedText = batch.join("\n\n---CHUNK SEPARATOR---\n\n");

    const batchPrompt = `
Extract ALL publications from these CV sections and verify each one online.

CANDIDATE NAME: ${candidateName || "Unknown"}

CV SECTIONS:
${combinedText}

Extract ALL publications from ALL sections above. For each publication found, provide the following JSON format:

{
  "allPublications": [
    {
      "publication": {
        "title": "extracted title",
        "authors": ["list", "of", "authors"],
        "year": "publication year",
        "venue": "journal/conference name", 
        "type": "journal/conference/book chapter/etc",
        "doi": "DOI if available",
        "fullText": "original text from CV"
      },
      "verification": {
        "isOnline": true/false,
        "hasAuthorMatch": true/false,
        "link": "publication link or null",
        "citationCount": "number or 0"
      }
    }
  ]
}

IMPORTANT: Return ONLY the JSON object. Start your response with { and end with }.`;

    try {
      const response = await grokClient.chat.completions.create({
        model: "x-ai/grok-code-fast-1",
        messages: [
          {
            role: "user",
            content: batchPrompt,
          },
        ],
        extra_headers: {
          "HTTP-Referer": "https://talent-finder.com",
          "X-Title": "AI Talent Finder",
        },
        temperature: 0.0,
        max_tokens: 4000,
      });

      const result = JSON.parse(
        cleanJSONResponse(response.choices[0].message.content)
      );

      if (result.allPublications && Array.isArray(result.allPublications)) {
        const transformedResults = result.allPublications.map((item) =>
          transformPublicationResult(item.publication, item.verification)
        );
        allResults.push(...transformedResults);
      }
    } catch (error) {
      console.error(
        `[Grok CV Verification] Error processing batch ${i + 1}:`,
        error
      );
    }
  }

  return allResults;
}

//=============================================================================
// SHARED HELPER FUNCTIONS (same as other AI controllers)
//=============================================================================

/**
 * Get author profile using APIs from sources (OpenAlex, Google Scholar, Scopus)
 * instead of generating with AI
 * @param {string} candidateName - Candidate name
 * @param {Array} verificationResults - Publication verification results
 * @returns {Promise<Object|null>} Author profile from API sources
 */
async function getAuthorProfileFromAPIs(candidateName, verificationResults) {
  try {
    console.log(
      `[Grok CV Verification] Attempting to get author profile from APIs for: ${candidateName}`
    );

    // Search for author in various APIs
    const authorIds = await searchAuthorInAPIs(candidateName);

    if (authorIds.openalex || authorIds.google_scholar || authorIds.scopus) {
      // Use the aggregateAuthorDetails utility to get comprehensive profile
      const authorProfile = await aggregateAuthorDetails(
        candidateName,
        authorIds,
        verificationResults
      );

      if (authorProfile) {
        console.log(
          "[Grok CV Verification] Successfully retrieved author profile from APIs"
        );
        return authorProfile;
      }
    }

    console.log(
      "[Grok CV Verification] No author profile found in APIs, creating basic profile"
    );
    return createBasicAuthorProfile(candidateName, verificationResults);
  } catch (error) {
    console.error(
      "[Grok CV Verification] Error getting author profile from APIs:",
      error
    );
    return createBasicAuthorProfile(candidateName, verificationResults);
  }
}

/**
 * Search for author in different APIs (OpenAlex, Google Scholar, Scopus)
 * @param {string} candidateName - Candidate name to search
 * @returns {Promise<Object>} Author IDs from different sources
 */
async function searchAuthorInAPIs(candidateName) {
  const authorIds = {
    google_scholar: null,
    scopus: null,
    openalex: null,
  };

  try {
    // Search OpenAlex first (most reliable)
    authorIds.openalex = await searchOpenAlexAuthor(candidateName);

    // Could add Google Scholar and Scopus search here
    // but keeping it simple for now
  } catch (error) {
    console.error(
      "[Grok CV Verification] Error searching for author in APIs:",
      error
    );
  }

  return authorIds;
}

/**
 * Search for author in OpenAlex API
 * @param {string} candidateName - Candidate name to search
 * @returns {Promise<string|null>} OpenAlex author ID if found
 */
async function searchOpenAlexAuthor(candidateName) {
  try {
    const response = await axios.get(
      `https://api.openalex.org/authors?search=${encodeURIComponent(
        candidateName
      )}&per-page=1`
    );

    if (response.data.results && response.data.results.length > 0) {
      const author = response.data.results[0];
      return author.id.replace("https://openalex.org/", "");
    }

    return null;
  } catch (error) {
    console.error("[Grok CV Verification] Error searching OpenAlex:", error);
    return null;
  }
}

/**
 * Create basic author profile from verification results
 * @param {string} candidateName - Candidate name
 * @param {Array} verificationResults - Verification results
 * @returns {Object} Basic author profile
 */
function createBasicAuthorProfile(candidateName, verificationResults) {
  const verifiedPublications = verificationResults.filter(
    (r) => r.verification.displayData.status === "verified"
  );

  return {
    author: {
      name: candidateName || "Unknown",
      email: null,
      profileImageUrl: null,
      profileUrl: null,
    },
    expertises: ["General"],
    metrics: {
      h_index: 0,
      documentCount: verifiedPublications.length,
      i10_index: 0,
      citationCount: 0,
      citations: [],
    },
  };
}

/**
 * Determine publication verification status based on AI verification results
 * @param {Object} verification - Verification object with isOnline and hasAuthorMatch
 * @returns {string} Status string
 */
function determinePublicationStatus(verification) {
  if (!verification || !verification.isOnline) {
    return "not verified";
  }

  return verification.hasAuthorMatch
    ? "verified"
    : "verified but not same author name";
}

/**
 * Transform publication data to expected format
 * @param {Object} publication - Publication data
 * @param {Object} verification - Verification data
 * @param {Object} originalPub - Original publication object (for fallback)
 * @returns {Object} Formatted result object
 */
function transformPublicationResult(
  publication,
  verification,
  originalPub = {}
) {
  const status = determinePublicationStatus(verification);

  return {
    publication: {
      title: publication.title || originalPub.title || "",
      doi: publication.doi || originalPub.doi || null,
      fullText: publication.fullText || originalPub.publication || "",
    },
    verification: {
      grok_verification: {
        status: status,
        details: verification,
      },
      displayData: {
        publication: publication.fullText || originalPub.publication || "",
        title: publication.title || originalPub.title || "Unable to extract",
        author: Array.isArray(publication.authors)
          ? publication.authors.join(", ")
          : "Unable to extract",
        type: publication.type || "Unknown",
        year: publication.year || "Unknown",
        citedBy: verification?.citationCount?.toString() || "0",
        link: verification?.link || generateSearchLink(publication.title),
        status: status,
      },
    },
    authorVerification: {
      hasAuthorMatch: verification?.hasAuthorMatch || false,
      authorIds: {
        grok_verified: verification?.hasAuthorMatch ? "grok_verified" : null,
      },
    },
  };
}

/**
 * Clean and extract JSON from AI response
 * @param {string} response - Raw response text
 * @returns {string} Cleaned JSON string
 */
function cleanJSONResponse(response) {
  if (!response) return "{}";

  // Remove markdown code blocks
  let cleaned = response.replace(/```json\s*/g, "").replace(/```\s*/g, "");

  // Find JSON content between { and }
  const startIndex = cleaned.indexOf("{");
  const lastIndex = cleaned.lastIndexOf("}");

  if (startIndex !== -1 && lastIndex !== -1 && lastIndex > startIndex) {
    cleaned = cleaned.substring(startIndex, lastIndex + 1);
  }

  return cleaned.trim();
}

/**
 * Generate search link for publication
 * @param {string} title - Publication title
 * @returns {string} Search URL
 */
function generateSearchLink(title) {
  if (!title) return "https://scholar.google.com/";
  const query = encodeURIComponent(title);
  return `https://scholar.google.com/scholar?q=${query}`;
}

/**
 * Remove duplicate publications based on title similarity
 * @param {Array} publications - Array of publication results
 * @returns {Array} Deduplicated publications
 */
function removeDuplicatePublications(publications) {
  const unique = [];
  const seen = new Set();

  for (const pub of publications) {
    const title = pub.verification?.displayData?.title || "";
    const normalizedTitle = title
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .trim();

    if (!seen.has(normalizedTitle) && normalizedTitle.length > 0) {
      seen.add(normalizedTitle);
      unique.push(pub);
    }
  }

  return unique;
}

//=============================================================================
// ML-BASED PUBLICATION SECTION EXTRACTION
//=============================================================================

/**
 * Extract publication sections using ML header classifier
 * @param {string} cvText - Full CV text content
 * @param {Object} headerClassifier - Trained ML header classifier
 * @returns {Array} Array of publication sections with content
 */
function extractPublicationSectionsWithML(cvText, headerClassifier) {
  const lines = cvText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  // Use ML model to detect all headers
  const allHeaders = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (headerClassifier.predict(line, i, lines.length)) {
      allHeaders.push({
        text: line,
        lineIndex: i,
      });
    }
  }

  console.log(
    `[Grok CV Verification] ML model detected ${allHeaders.length} headers, ${publicationHeaders.length} publication-related`
  );

  // Extract content for each publication section
  const publicationSections = [];
  for (let i = 0; i < allHeaders.length; i++) {
    const currentHeader = allHeaders[i];
    const nextHeader = allHeaders[i + 1];

    const startLine = currentHeader.lineIndex + 1;
    const endLine = nextHeader ? nextHeader.lineIndex : lines.length;

    const sectionContent = lines.slice(startLine, endLine).join("\n");

    if (sectionContent.trim().length > 0) {
      publicationSections.push({
        header: currentHeader.text,
        content: sectionContent,
        classification: currentHeader.classification,
      });
    }
  }

  return publicationSections;
}

/**
 * Process all publication sections with Grok AI verification in a single batched request
 * This reduces API calls by combining all sections into one request
 * @param {OpenAI} grokClient - OpenRouter client configured for Grok AI
 * @param {Array} publicationSections - Array of publication section objects
 * @param {string} candidateName - Candidate name
 * @returns {Promise<Array>} Array of verified publications from all sections
 */
async function processBatchedPublicationSectionsWithGrok(
  grokClient,
  publicationSections,
  candidateName
) {
  if (!publicationSections || publicationSections.length === 0) {
    return [];
  }

  console.log(
    `[Grok CV Verification] Processing ${publicationSections.length} publication sections in a single batch request`
  );

  // Combine all publication sections into a single prompt
  const sectionsText = publicationSections
    .map(
      (section, index) =>
        `SECTION ${index + 1} - ${section.header}:\n${section.content}`
    )
    .join("\n\n---\n\n");

  const batchedPrompt = `
You are an expert at analyzing academic publication sections. Extract ALL publications from ALL sections below and verify each one online.

CANDIDATE NAME: ${candidateName || "Unknown"}

ALL PUBLICATION SECTIONS:
${sectionsText}

Extract ALL publications from ALL sections above. For each publication found (whether verified online or not), provide the following JSON format:

{
  "allPublications": [
    {
      "publication": {
        "title": "extracted title",
        "authors": ["list", "of", "authors"],
        "year": "publication year",
        "venue": "journal/conference name", 
        "type": "journal/conference/book chapter/etc",
        "doi": "DOI if available",
        "fullText": "original text from CV",
        "sectionHeader": "which section this came from"
      },
      "verification": {
        "isOnline": true/false,
        "hasAuthorMatch": true/false,
        "link": "publication link or null",
        "citationCount": "number or 0"
      }
    }
  ]
}

EXTRACTION AND VERIFICATION GUIDELINES:
1. Extract ALL publications from ALL sections (journal articles, conference papers, book chapters, etc.)
2. For each publication, determine if it likely exists online (isOnline: true/false)
3. Verify if the candidate name appears in the author list (hasAuthorMatch: true/false)
4. For verified publications, provide links of the publication (DOI links preferred, then Google Scholar)
5. For unverified publications, set isOnline: false, link: null, citationCount: 0
6. Estimate citation counts only for verified publications
7. IMPORTANT: Include ALL publications found in ALL sections, not just verified ones

IMPORTANT: Return ONLY the JSON object. Do not include any markdown formatting, explanations, or code blocks. Start your response with { and end with }.`;

  try {
    const response = await grokClient.chat.completions.create({
      model: "x-ai/grok-code-fast-1",
      messages: [
        {
          role: "user",
          content: batchedPrompt,
        },
      ],
      extra_headers: {
        "HTTP-Referer": "https://talent-finder.com",
        "X-Title": "AI Talent Finder",
      },
      temperature: 0.0,
      max_tokens: 4000,
    });

    const result = JSON.parse(
      cleanJSONResponse(response.choices[0].message.content)
    );

    if (result.allPublications && Array.isArray(result.allPublications)) {
      console.log(
        `[Grok CV Verification] Successfully processed ${result.allPublications.length} publications from batched sections`
      );

      return result.allPublications.map((item) =>
        transformPublicationResult(item.publication, item.verification)
      );
    } else {
      console.warn("[Grok CV Verification] Unexpected batched response format");
      return [];
    }
  } catch (error) {
    console.error(
      "[Grok CV Verification] Error in batched publication sections processing:",
      error
    );
    return [];
  }
}

//=============================================================================
// UTILITY FUNCTIONS
//=============================================================================

/**
 * Chunk CV text into smaller pieces for processing
 * @param {string} cvText - Full CV text content
 * @param {number} maxSize - Maximum chunk size
 * @returns {Array} Array of text chunks
 */
function chunkCVText(cvText, maxSize = MAX_CHUNK_SIZE) {
  const chunks = [];
  let currentIndex = 0;

  while (currentIndex < cvText.length) {
    let endIndex = Math.min(currentIndex + maxSize, cvText.length);

    // Try to end at a natural break point (paragraph or line)
    if (endIndex < cvText.length) {
      const lastNewline = cvText.lastIndexOf("\n", endIndex);
      const lastParagraph = cvText.lastIndexOf("\n\n", endIndex);

      if (lastParagraph > currentIndex + maxSize * 0.7) {
        endIndex = lastParagraph;
      } else if (lastNewline > currentIndex + maxSize * 0.8) {
        endIndex = lastNewline;
      }
    }

    const chunk = cvText.substring(currentIndex, endIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    currentIndex = endIndex;
  }

  return chunks;
}
