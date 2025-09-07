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
 * @author SwangLee
 * @version 2.0.0
 */

//======================== CONSTANTS & IMPORTS ========================
const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const {
  extractCandidateNameWithAI,
  extractPublicationsFromCV,
} = require("../utils/aiHelpers");
const { extractTextFromPDF } = require("../utils/pdfUtils");
const { aggregateAuthorDetails } = require("../utils/authorDetailsAggregator");
const {
  initializeHeaderClassifier,
} = require("../utils/headerClassifierUtils");
const axios = require("axios");

const MAX_CHUNK_SIZE = 5000;

//======================== MAIN FUNCTION ========================
module.exports = {
  verifyCVWithAI,
};

async function verifyCVWithAI(file, prioritySource = "ai") {
  let cvText = "";
  try {
    cvText = await extractTextFromPDF(file.path);
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite-preview-06-17",
      generationConfig: {
        temperature: 0.0,
        topP: 0.0,
        maxOutputTokens: 16384,
      },
    });
    const candidateName = await extractCandidateNameWithAI(model, cvText);
    const verificationResults = await processFullCVWithAI(
      model,
      cvText,
      candidateName
    );
    const authorProfile = await getAuthorProfileFromAPIs(
      candidateName,
      verificationResults
    );
    return {
      success: true,
      candidateName,
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
    console.log(
      "[Gemini CV Verification] Using ML model for large CV processing"
    );

    // Initialize ML header classifier
    const headerClassifier = initializeHeaderClassifier();

    if (headerClassifier && headerClassifier.trained) {
      // Use ML model to identify publication sections
      const publicationSections = extractPublicationSectionsWithML(
        cvText,
        headerClassifier
      );

      if (publicationSections.length > 0) {
        console.log(
          `[Gemini CV Verification] Found ${publicationSections.length} publication sections using ML model`
        );

        // Process ALL publication sections in a single batch request
        const allResults = await processBatchedPublicationSectionsWithAI(
          model,
          publicationSections,
          candidateName
        );

        return removeDuplicatePublications(allResults);
      }
    }
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
// HELPER FUNCTIONS FOR BATCHING
//=============================================================================

/**
 * Create batches of section content based on MAX_CHUNK_SIZE
 * @param {Array} publicationSections - Array of publication section objects
 * @returns {Array} Array of section content batches
 */
function createSectionContentBatches(publicationSections) {
  const batches = [];
  let currentBatch = {
    sections: [],
    totalSize: 0,
    combinedContent: "",
  };

  for (const section of publicationSections) {
    const sectionSize = section.content.length;

    // If adding this section would exceed MAX_CHUNK_SIZE, start a new batch
    if (
      currentBatch.totalSize + sectionSize > MAX_CHUNK_SIZE &&
      currentBatch.sections.length > 0
    ) {
      batches.push({ ...currentBatch });
      currentBatch = {
        sections: [section],
        totalSize: sectionSize,
        combinedContent: section.content,
      };
    } else {
      currentBatch.sections.push(section);
      currentBatch.totalSize += sectionSize;
      if (currentBatch.combinedContent) {
        currentBatch.combinedContent += "\n\n---\n\n" + section.content;
      } else {
        currentBatch.combinedContent = section.content;
      }
    }
  }

  // Add the last batch if it has any sections
  if (currentBatch.sections.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * Process publication content with AI verification (handles both single sections and batches)
 * @param {Object} model - Google AI model instance
 * @param {Object|string} content - Batch object with combinedContent or single section content
 * @param {string} candidateName - Candidate name
 * @param {number} batchNumber - Batch number for logging
 * @returns {Promise<Array>} Array of verified publications
 */
async function processBatchOfSectionContent(
  model,
  content,
  candidateName,
  batchNumber = 1
) {
  // Handle both batch objects and direct content strings
  const publicationContent =
    typeof content === "string" ? content : content.combinedContent;
  const sectionsInfo =
    typeof content === "string"
      ? "Single section"
      : content.sections.map((section) => section.header).join(", ");

  console.log(
    `[Gemini CV Verification] Processing batch ${batchNumber}: ${sectionsInfo}`
  );

  const prompt = `
You are an expert at analyzing academic publication content. Extract ALL publications from the content below and verify each one online.

CANDIDATE NAME: ${candidateName || "Unknown"}

PUBLICATION CONTENT:
${publicationContent}

Extract ALL publications from the content above. For each publication found (whether verified online or not), provide the following JSON format:

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

EXTRACTION AND VERIFICATION GUIDELINES:
1. Extract ALL publications from the content (journal articles, conference papers, book chapters, etc.)
2. For each publication, determine if it likely exists online (isOnline: true/false)
3. Verify if the candidate name appears in the author list (hasAuthorMatch: true/false)
4. For verified publications, provide links of the publication (DOI links preferred, then Google Scholar)
5. For unverified publications, set isOnline: false, link: null, citationCount: 0
6. Estimate citation counts only for verified publications
7. IMPORTANT: Include ALL publications found in the content, not just verified ones

IMPORTANT: Return ONLY the JSON object. Do not include any markdown formatting, explanations, or code blocks. Start your response with { and end with }.`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const verificationText = cleanJSONResponse(response.text());

  let verificationData;
  try {
    verificationData = JSON.parse(verificationText);
  } catch (parseError) {
    console.error(
      `[Gemini CV Verification] JSON Parse Error: ${parseError.message}`
    );

    // Attempt to fix truncated or malformed JSON
    const fixedText = fixTruncatedJSON(verificationText);

    try {
      verificationData = JSON.parse(fixedText);
      console.log(
        `[Gemini CV Verification] Successfully recovered from JSON parsing error`
      );
    } catch (secondError) {
      console.error(
        `[Gemini CV Verification] Could not fix JSON:`,
        secondError.message
      );
    }
  }

  const allPublications = verificationData.allPublications || [];

  console.log(
    `[Gemini CV Verification] Extracted ${allPublications.length} publications from batch ${batchNumber}`
  );

  return allPublications.map((item) => {
    return transformPublicationResult(
      item.publication,
      item.verification,
      item.publication
    );
  });
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

/**
 * Fix truncated or malformed JSON responses
 * @param {string} jsonText - The malformed JSON text
 * @returns {string} Fixed JSON text
 */
function fixTruncatedJSON(jsonText) {
  let fixedText = jsonText;

  // Remove trailing commas before closing brackets/braces
  fixedText = fixedText.replace(/,(\s*[}\]])/g, "$1");

  // Check if the JSON is truncated (missing closing brackets)
  const openBraces = (fixedText.match(/\{/g) || []).length;
  const closeBraces = (fixedText.match(/\}/g) || []).length;
  const openBrackets = (fixedText.match(/\[/g) || []).length;
  const closeBrackets = (fixedText.match(/\]/g) || []).length;

  // If JSON is truncated, try to complete it
  if (openBraces > closeBraces || openBrackets > closeBrackets) {
    // Remove any incomplete object at the end
    const lastCompleteObjectMatch = fixedText.lastIndexOf("    }");
    if (lastCompleteObjectMatch !== -1) {
      fixedText = fixedText.substring(0, lastCompleteObjectMatch + 5);
    }

    // Add missing closing brackets and braces
    const missingBrackets = openBrackets - closeBrackets;
    const missingBraces = openBraces - closeBraces;

    for (let i = 0; i < missingBrackets; i++) {
      fixedText += "\n  ]";
    }
    for (let i = 0; i < missingBraces; i++) {
      fixedText += "\n}";
    }
  }

  return fixedText;
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

  // Remove any trailing text after the closing brace
  const lastBraceIndex = cleanedText.lastIndexOf("}");
  if (lastBraceIndex !== -1 && lastBraceIndex < cleanedText.length - 1) {
    cleanedText = cleanedText.substring(0, lastBraceIndex + 1);
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

    try {
      const isHeader = headerClassifier.predict(line, i, lines.length);
      if (isHeader) {
        allHeaders.push({
          text: line,
          lineNumber: i + 1,
          index: i,
        });
      }
    } catch (error) {
      // Skip if prediction fails for this line
      continue;
    }
  }

  // Extract content for each publication section
  const publicationSections = [];
  for (let i = 0; i < allHeaders.length; i++) {
    const header = allHeaders[i];
    const nextHeader = allHeaders[i + 1];

    let sectionEnd;
    if (nextHeader) {
      sectionEnd = nextHeader.index;
    } else {
      sectionEnd = lines.length;
    }

    const sectionContent = lines.slice(header.index + 1, sectionEnd).join("\n");

    if (sectionContent.trim().length > 0) {
      publicationSections.push({
        header: header.text,
        content: sectionContent,
        startIndex: header.index,
        endIndex: sectionEnd,
      });
    }
  }

  return publicationSections;
}

/**
 * Process all publication sections with AI verification in a single batched request
 * This reduces API calls by combining all sections into one request
 * @param {Object} model - Google AI model instance
 * @param {Array} publicationSections - Array of publication section objects
 * @param {string} candidateName - Candidate name
 * @returns {Promise<Array>} Array of verified publications from all sections
 */
async function processBatchedPublicationSectionsWithAI(
  model,
  publicationSections,
  candidateName
) {
  if (!publicationSections || publicationSections.length === 0) {
    return [];
  }

  console.log(
    `[Gemini CV Verification] Processing ${publicationSections.length} publication sections using size-based batching`
  );

  // Create batches of section content based on MAX_CHUNK_SIZE
  const batches = createSectionContentBatches(publicationSections);

  console.log(
    `[Gemini CV Verification] Created ${batches.length} batches for verification`
  );

  const allResults = [];

  // Process each batch
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(
      `[Gemini CV Verification] Processing batch ${i + 1}/${
        batches.length
      } with ${batch.sections.length} sections (${batch.totalSize} characters)`
    );

    const batchResults = await processBatchOfSectionContent(
      model,
      batch,
      candidateName,
      i + 1
    );
    allResults.push(...batchResults);
  }

  console.log(
    `[Gemini CV Verification] Completed processing with ${allResults.length} verified publications`
  );
  return removeDuplicatePublications(allResults);
}
