/**
 * AI-Based CV Verification Controller
 *
 * This controller provides AI-powered academic CV verification that focuses on
 * publication verification and author matching without external API dependencies.
 * It uses AI to:
 * - Verify if publications exist online
 * - Extract publication details and find links
 * - Match candidate names with publication authors
 * - Return results in the same format as traditional verification
 *
 * @module aiCvVerification
 * @author AI Talent Finder Team
 * @version 2.0.0
 */

const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const {
  extractCandidateNameWithAI,
  extractPublicationsFromCV,
} = require("../utils/aiHelpers");
const { extractTextFromPDF } = require("../utils/pdfUtils");
const { aggregateAuthorDetails } = require("../utils/authorDetailsAggregator");
const axios = require("axios");

//=============================================================================
// MODULE EXPORTS
//=============================================================================

module.exports = {
  verifyCVWithAI,
};

//=============================================================================
// MAIN AI CV VERIFICATION FUNCTION
//=============================================================================

/**
 * Main function for AI-based academic CV verification
 *
 * Processes a CV file through AI-powered verification pipeline:
 * 1. Parse PDF to extract text content
 * 2. Extract candidate name using AI
 * 3. Extract publications using AI
 * 4. Verify each publication exists online using AI
 * 5. Match candidate name against publication authors
 * 6. Generate verification report in traditional format
 *
 * @param {Object} file - Uploaded CV file object with path property
 * @param {string} prioritySource - Priority source for verification (optional)
 * @returns {Promise<Object>} Verification results in traditional format
 */
async function verifyCVWithAI(file, prioritySource = "ai") {
  let cvText = "";

  try {
    // Parse PDF to text (with OCR fallback)
    cvText = await extractTextFromPDF(file.path);

    // Initialize Google AI model
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite-preview-06-17",
      generationConfig: {
        temperature: 0.0,
        topP: 0.0,
        maxOutputTokens: 4096,
      },
    });

    // Extract candidate name using AI
    const candidateName = await extractCandidateNameWithAI(model, cvText);

    // Process CV and verify publications with AI
    const verificationResults = await processFullCVWithAI(
      model,
      cvText,
      candidateName
    );

    // Get author profile using APIs from sources instead of AI
    const authorProfile = await getAuthorProfileFromAPIs(
      candidateName,
      verificationResults
    );

    // Return results in traditional format
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
    console.error("[AI CV Verification] Error:", error);
    throw error;
  } finally {
    // Clean up uploaded file in finally block to ensure it always happens
    if (file && file.path) {
      try {
        fs.unlinkSync(file.path);
        console.log("[AI CV Verification] File cleaned up");
      } catch (cleanupError) {
        console.warn(
          "[AI CV Verification] File cleanup failed:",
          cleanupError.message
        );
      }
    }
  }
}

//=============================================================================
// TASK 1: GET AUTHOR PROFILE FROM APIs INSTEAD OF AI
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
    // Only proceed if we have verified publications
    const verifiedPublications = verificationResults.filter(
      (r) => r.verification.displayData.status === "verified"
    );

    if (verifiedPublications.length === 0) {
      console.log(
        "No verified publications found, skipping API author profile lookup"
      );
      return null;
    }

    // Search for author using different APIs
    const authorIds = await searchAuthorInAPIs(candidateName);

    if (!authorIds || !Object.values(authorIds).some((id) => id)) {
      console.log(`No author found in APIs for: ${candidateName}`);
      return createBasicAuthorProfile(candidateName, verificationResults);
    }

    // Use the aggregator to get comprehensive author details from APIs
    try {
      const rawAuthorDetails = await aggregateAuthorDetails(
        authorIds,
        candidateName,
        "openalex" // Use OpenAlex as primary source
      );

      if (rawAuthorDetails) {
        // Transform to expected format
        return {
          author: rawAuthorDetails.author,
          expertises: rawAuthorDetails.expertise || ["General"],
          metrics: {
            h_index: rawAuthorDetails.h_index || 0,
            documentCount:
              rawAuthorDetails.documentCount || verifiedPublications.length,
            i10_index: rawAuthorDetails.i10_index || 0,
            citationCount: rawAuthorDetails.citationCount || 0,
            citations: rawAuthorDetails.graph || [],
          },
        };
      }
    } catch (aggregatorError) {
      console.error("Error using aggregator:", aggregatorError);
    }

    // Fallback to basic profile if aggregator fails
    return createBasicAuthorProfile(candidateName, verificationResults);
  } catch (error) {
    console.error("Error getting author profile from APIs:", error);
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
    // Search in OpenAlex first (most reliable)
    const openAlexId = await searchOpenAlexAuthor(candidateName);
    if (openAlexId) {
      authorIds.openalex = openAlexId;
    }

    // Can add Google Scholar and Scopus searches here if needed
    // For now, focus on OpenAlex as it's most comprehensive

    return authorIds;
  } catch (error) {
    console.error("Error searching author in APIs:", error);
    return authorIds;
  }
}

/**
 * Search for author in OpenAlex API
 * @param {string} candidateName - Candidate name to search
 * @returns {Promise<string|null>} OpenAlex author ID if found
 */
async function searchOpenAlexAuthor(candidateName) {
  try {
    const OPENALEX_BASE = "https://api.openalex.org";
    const searchUrl = `${OPENALEX_BASE}/authors?search=${encodeURIComponent(
      candidateName
    )}&per_page=5`;

    console.log(`Searching OpenAlex for author: ${candidateName}`);
    const response = await axios.get(searchUrl);

    if (
      response.data &&
      response.data.results &&
      response.data.results.length > 0
    ) {
      // Get the first match (most relevant)
      const firstMatch = response.data.results[0];

      // Basic name matching to ensure it's the right person
      const searchName = candidateName.toLowerCase().trim();
      const foundName = (firstMatch.display_name || "").toLowerCase().trim();

      // Check if names are reasonably similar (basic matching)
      if (foundName.includes(searchName) || searchName.includes(foundName)) {
        console.log(
          `Found OpenAlex author: ${firstMatch.display_name} (${firstMatch.id})`
        );
        return firstMatch.id;
      }
    }

    return null;
  } catch (error) {
    console.error("Error searching OpenAlex:", error);
    return null;
  }
}

/**
 * Create basic author profile when API search fails
 * @param {string} candidateName - Candidate name
 * @param {Array} verificationResults - Verification results
 * @returns {Object} Basic author profile
 */
function createBasicAuthorProfile(candidateName, verificationResults) {
  const verifiedCount = verificationResults.filter(
    (r) => r.verification.displayData.status === "verified"
  ).length;

  return {
    author: {
      name: candidateName || "Unknown",
      affiliation: "Not specified",
      position: "Not specified",
      email: "Not specified",
    },
    expertises: ["General"],
    metrics: {
      h_index: Math.min(verifiedCount, 10),
      documentCount: verificationResults.length,
      i10_index: Math.max(0, verifiedCount - 5),
      citationCount: verifiedCount * 5, // Rough estimate
      citations: [],
    },
  };
}

//=============================================================================
// TASK 2: DIRECT CV VERIFICATION WITH AI
//=============================================================================

/**
 * Process full CV content with AI to directly verify publications online
 * Handles large CVs by chunking them into manageable pieces
 * @param {Object} model - Google AI model instance
 * @param {string} cvText - Full CV text content
 * @param {string} candidateName - Candidate name
 * @returns {Promise<Array>} Verification results array
 */
async function processFullCVWithAI(model, cvText, candidateName) {
  const MAX_CHUNK_SIZE = 8000;

  try {
    // Check if CV is too large and needs chunking
    if (cvText.length > MAX_CHUNK_SIZE) {
      console.log(
        `[AI CV Verification] Large CV detected (${cvText.length} chars), using chunked processing`
      );
      return await processLargeCVWithChunking(model, cvText, candidateName);
    }

    // For smaller CVs, process directly
    return await processSmallCVDirectly(model, cvText, candidateName);
  } catch (error) {
    console.error("Error in CV processing:", error);
    // Fallback: Try to extract publications using the existing AI helper
    return await fallbackPublicationExtraction(model, cvText, candidateName);
  }
}

/**
 * Process small CV directly without chunking
 * @param {Object} model - Google AI model instance
 * @param {string} cvText - Full CV text content
 * @param {string} candidateName - Candidate name
 * @returns {Promise<Array>} Verification results array
 */
async function processSmallCVDirectly(model, cvText, candidateName) {
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

  const result = await model.generateContent(directVerificationPrompt);
  const response = await result.response;
  const verificationText = cleanJSONResponse(response.text());

  try {
    const verificationData = JSON.parse(verificationText);
    const allPublications = verificationData.allPublications || [];

    // Transform to expected format using helper function
    return allPublications.map((item) => {
      return transformPublicationResult(
        item.publication,
        item.verification,
        item.publication
      );
    });
  } catch (error) {
    console.error("Error parsing small CV verification result:", error);
    throw error;
  }
}

/**
 * Process large CV using chunking and ML model for section detection
 * @param {Object} model - Google AI model instance
 * @param {string} cvText - Full CV text content
 * @param {string} candidateName - Candidate name
 * @returns {Promise<Array>} Verification results array
 */
async function processLargeCVWithChunking(model, cvText, candidateName) {
  try {
    console.log("[AI CV Verification] Using ML model for large CV processing");

    // Extract publications using the existing chunked approach
    const rawPublications = await extractPublicationsFromCV(model, cvText);

    if (!Array.isArray(rawPublications)) {
      console.warn("No publications extracted from large CV");
      return [];
    }

    console.log(
      `[AI CV Verification] Extracted ${rawPublications.length} publications from large CV`
    );

    // Process each publication with AI verification in batches to avoid rate limits
    const batchSize = 5; // Process 5 publications at a time
    const allResults = [];

    for (let i = 0; i < rawPublications.length; i += batchSize) {
      const batch = rawPublications.slice(i, i + batchSize);
      console.log(
        `[AI CV Verification] Processing batch ${
          Math.floor(i / batchSize) + 1
        } of ${Math.ceil(rawPublications.length / batchSize)}`
      );

      const batchResults = await Promise.all(
        batch.map((pub) =>
          verifyIndividualPublication(model, pub, candidateName)
        )
      );

      allResults.push(...batchResults);

      // Add small delay between batches to avoid rate limiting
      if (i + batchSize < rawPublications.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
      }
    }

    return allResults.filter(Boolean); // Remove any null results
  } catch (error) {
    console.error("Error in large CV chunked processing:", error);
    throw error;
  }
}

/**
 * Verify individual publication with AI
 * @param {Object} model - Google AI model instance
 * @param {Object} pub - Publication object
 * @param {string} candidateName - Candidate name
 * @returns {Promise<Object>} Verification result
 */
async function verifyIndividualPublication(model, pub, candidateName) {
  try {
    const verificationPrompt = `
You are an expert at verifying academic publications. Analyze this publication and determine if it exists online.

CANDIDATE NAME: ${candidateName || "Unknown"}

PUBLICATION TO VERIFY:
${pub.publication || pub.title || JSON.stringify(pub)}

Provide verification in JSON format:
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

GUIDELINES:
1. Extract publication details from the text
2. Determine if this publication likely exists online
3. Check if candidate name appears in author list
4. Provide links when possible (DOI preferred)
5. Estimate citation count for verified publications

IMPORTANT: Return ONLY the JSON object. Start with { and end with }.`;

    const result = await model.generateContent(verificationPrompt);
    const response = await result.response;
    const verificationText = cleanJSONResponse(response.text());

    try {
      const verificationData = JSON.parse(verificationText);
      const publication = verificationData.publication;
      const verification = verificationData.verification;

      return transformPublicationResult(publication, verification, pub);
    } catch (parseError) {
      console.error(
        "Failed to parse individual publication verification:",
        parseError.message
      );
      // Return basic not verified result using helper function
      return transformPublicationResult(
        { title: pub.title || "Unable to extract" },
        { isOnline: false, hasAuthorMatch: false },
        pub
      );
    }
  } catch (error) {
    console.error("Error verifying individual publication:", error);
    return null;
  }
}

//=============================================================================
// HELPER FUNCTIONS
//=============================================================================

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
      ai_verification: {
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
        ai_verified: verification?.hasAuthorMatch ? "ai_verified" : null,
      },
    },
  };
}

/**
 * Clean and extract JSON from AI response
 * @param {string} responseText - Raw AI response text
 * @returns {string} Cleaned JSON string
 */
function cleanJSONResponse(responseText) {
  let cleanedText = responseText.trim();

  // Remove markdown code blocks if present
  if (cleanedText.startsWith("```")) {
    const lines = cleanedText.split("\n");
    lines.shift(); // Remove first ```json or ```
    if (lines[lines.length - 1].trim() === "```") {
      lines.pop(); // Remove last ```
    }
    cleanedText = lines.join("\n").trim();
  }

  // Extract JSON object if wrapped in other text
  const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleanedText = jsonMatch[0];
  }

  return cleanedText;
}

/**
 * Generate search link for publication verification
 * @param {string} title - Publication title
 * @returns {string} Search URL
 */
function generateSearchLink(title) {
  if (!title) return "No link available";
  const encodedTitle = encodeURIComponent(title);
  return `https://scholar.google.com/scholar?hl=en&as_sdt=0%2C5&q=${encodedTitle}`;
}

/**
 * Fallback function to extract publications when direct verification fails
 * @param {Object} model - Google AI model instance
 * @param {string} cvText - Full CV text content
 * @param {string} candidateName - Candidate name
 * @returns {Promise<Array>} Array of unverified publications
 */
async function fallbackPublicationExtraction(model, cvText, candidateName) {
  try {
    // Use the existing publication extraction function
    const rawPublications = await extractPublicationsFromCV(model, cvText);

    if (!Array.isArray(rawPublications)) {
      return [];
    }

    // Convert to expected format but mark all as not verified using helper function
    return rawPublications.map((pub) => {
      return transformPublicationResult(
        { title: pub.title || "Unable to extract" },
        { isOnline: false, hasAuthorMatch: false },
        pub
      );
    });
  } catch (fallbackError) {
    console.error(
      "Fallback publication extraction also failed:",
      fallbackError
    );
    return [];
  }
}
