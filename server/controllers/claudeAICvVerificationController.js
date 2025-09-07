/**
 * Claude AI-Based CV Verification Controller
 *
 * This controller provides Anthropic Claude-powered academic CV verification that focuses on
 * publication verification and author matching without external API dependencies.
 * It uses Claude to:
 * - Verify if publications exist online
 * - Extract publication details and find links
 * - Match candidate names with publication authors
 * - Return results in the same format as traditional verification
 *
 * @module claudeAiCvVerification
 * @author SwangLee
 * @version 1.0.0
 */

//======================== CONSTANTS & CONFIG ========================
const fs = require("fs");
const Anthropic = require("@anthropic-ai/sdk");
const { extractTextFromPDF } = require("../utils/pdfUtils");
const { aggregateAuthorDetails } = require("../utils/authorDetailsAggregator");
const {
  initializeHeaderClassifier,
} = require("../utils/headerClassifierUtils");
const axios = require("axios");

const MAX_CHUNK_SIZE = 5000;

//=============================================================================
// MODULE EXPORTS
//=============================================================================

//======================== MAIN FUNCTION ========================

module.exports = {
  verifyCVWithClaude,
};

//=============================================================================
// MAIN CLAUDE CV VERIFICATION FUNCTION
//=============================================================================

/**
 * Main function for Claude-based academic CV verification
 *
 * Processes a CV file through Claude-powered verification pipeline:
 * 1. Parse PDF to extract text content
 * 2. Extract candidate name using Claude
 * 3. Extract publications using Claude
 * 4. Verify each publication exists online using Claude
 * 5. Match candidate name against publication authors
 * 6. Generate verification report in traditional format
 *
 * @param {Object} file - Uploaded CV file object with path property
 * @param {string} prioritySource - Priority source for verification (optional)
 * @returns {Promise<Object>} Verification results in traditional format
 */
async function verifyCVWithClaude(file, prioritySource = "claude") {
  let cvText = "";
  try {
    cvText = await extractTextFromPDF(file.path);
    const anthropic = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY,
    });
    const candidateName = await extractCandidateNameWithClaude(
      anthropic,
      cvText
    );
    const verificationResults = await processFullCVWithClaude(
      anthropic,
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
    console.error("[Claude CV Verification] Error:", error);
    return {
      success: false,
      error: error.message,
      candidateName: null,
      total: 0,
      verifiedPublications: 0,
      verifiedWithAuthorMatch: 0,
      verifiedButDifferentAuthor: 0,
      results: [],
      authorDetails: null,
    };
  } finally {
    if (file && file.path) {
      try {
        fs.unlinkSync(file.path);
      } catch (cleanupError) {
        console.warn(
          "[Claude CV Verification] File cleanup failed:",
          cleanupError.message
        );
      }
    }
  }
}

//=============================================================================
// CLAUDE-SPECIFIC FUNCTIONS
//=============================================================================

/**
 * Extract candidate name using Claude
 * @param {Anthropic} anthropic - Anthropic client instance
 * @param {string} cvText - CV text content
 * @returns {Promise<string>} Candidate name
 */
async function extractCandidateNameWithClaude(anthropic, cvText) {
  const prompt = `You are an expert CV analyzer.
From the text of this CV/resume, extract ONLY the full name of the candidate/person whose CV this is.
Return ONLY the name as plain text - no explanation, no JSON, no additional information.
If you cannot determine the name with high confidence, return "UNKNOWN".

CV TEXT:
${cvText.substring(0, 2000)}`; // Only need the beginning of the CV

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 100,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const candidateName = response.content[0]?.text?.trim();
    return candidateName === "UNKNOWN" ? null : candidateName;
  } catch (error) {
    console.error("Error extracting candidate name with Claude:", error);
    return null;
  }
}

/**
 * Process full CV content with Claude to directly verify publications online
 * Handles large CVs by chunking them into manageable pieces
 * @param {Anthropic} anthropic - Anthropic client instance
 * @param {string} cvText - Full CV text content
 * @param {string} candidateName - Candidate name
 * @returns {Promise<Array>} Verification results array
 */
async function processFullCVWithClaude(anthropic, cvText, candidateName) {
  try {
    // Check if CV is too large and needs chunking
    if (cvText.length > MAX_CHUNK_SIZE) {
      return await processLargeCVWithChunking(anthropic, cvText, candidateName);
    }

    // For smaller CVs, process directly
    return await processSmallCVDirectly(anthropic, cvText, candidateName);
  } catch (error) {
    console.error("Error in CV processing:", error);
  }
}

/**
 * Process small CV directly without chunking
 * @param {Anthropic} anthropic - Anthropic client instance
 * @param {string} cvText - Full CV text content
 * @param {string} candidateName - Candidate name
 * @returns {Promise<Array>} Verification results array
 */
async function processSmallCVDirectly(anthropic, cvText, candidateName) {
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
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16384,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: directVerificationPrompt,
        },
      ],
    });

    const verificationText = cleanJSONResponse(response.content[0]?.text);

    let verificationData;
    try {
      verificationData = JSON.parse(verificationText);
    } catch (jsonError) {
      console.error(
        `[Claude CV Verification] JSON Parse Error: ${jsonError.message}`
      );

      // Attempt to fix truncated or malformed JSON
      const fixedText = fixTruncatedJSON(verificationText);

      try {
        verificationData = JSON.parse(fixedText);
      } catch (secondError) {
        console.error(
          `[Claude CV Verification] Could not fix JSON:`,
          secondError.message
        );

        // Try to recover by attempting to fix incomplete JSON
        const recoveredData = attemptJSONRecovery(verificationText);
        if (recoveredData) {
          verificationData = recoveredData;
        } else {
          return [];
        }
      }
    }

    const allPublications =
      verificationData.allPublications || verificationData.publications || [];

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
    console.log(
      "[Claude CV Verification] Falling back to empty results due to error"
    );
    return []; // Return empty array instead of throwing
  }
}

/**
 * Process large CV by chunking it into smaller pieces
 * @param {Anthropic} anthropic - Anthropic client instance
 * @param {string} cvText - Full CV text content
 * @param {string} candidateName - Candidate name
 * @returns {Promise<Array>} Verification results array
 */
async function processLargeCVWithChunking(anthropic, cvText, candidateName) {
  try {
    console.log(
      "[Claude CV Verification] Using ML model for large CV processing"
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
        // Process ALL publication sections in a single batch request
        const allResults = await processBatchedPublicationSectionsWithClaude(
          anthropic,
          publicationSections,
          candidateName
        );

        return removeDuplicatePublications(allResults);
      }
    }

    // Fallback to chunking approach if ML model fails
    const chunks = [];
    let currentIndex = 0;

    // Split CV into chunks
    while (currentIndex < cvText.length) {
      const chunk = cvText.substring(
        currentIndex,
        currentIndex + MAX_CHUNK_SIZE
      );
      chunks.push(chunk);
      currentIndex += MAX_CHUNK_SIZE;
    }

    // Process all chunks in parallel for better performance
    const chunkPromises = chunks.map((chunk, i) => {
      return processSmallCVDirectly(anthropic, chunk, candidateName).catch(
        (error) => {
          console.error(`Error processing chunk ${i + 1}:`, error);
          return [];
        }
      );
    });

    const chunkResultsArray = await Promise.all(chunkPromises);
    const allResults = chunkResultsArray.flat();

    // Remove duplicates based on title similarity
    return removeDuplicatePublications(allResults);
  } catch (error) {
    console.error("Error in large CV chunked processing:", error);
    throw error;
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
    // Search in OpenAlex (most reliable and free)
    const openAlexResponse = await axios.get(
      `https://api.openalex.org/authors?search=${encodeURIComponent(
        candidateName
      )}&per_page=1`
    );

    if (openAlexResponse.data?.results?.length > 0) {
      const author = openAlexResponse.data.results[0];
      authorIds.openalex = author.id;
    }
  } catch (error) {
    console.error("Error searching OpenAlex:", error.message);
  }

  return authorIds;
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
      claude_verification: {
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
        claude_verified: verification?.hasAuthorMatch
          ? "claude_verified"
          : null,
      },
    },
  };
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
 * @param {string} response - Raw response text
 * @returns {string} Cleaned JSON string
 */
function cleanJSONResponse(response) {
  if (!response) return "{}";

  try {
    // Remove markdown code blocks
    let cleaned = response.replace(/```json\s*/g, "").replace(/```\s*/g, "");

    // Remove any extra text before the JSON
    const startIndex = cleaned.indexOf("{");
    const lastIndex = cleaned.lastIndexOf("}");

    if (startIndex !== -1 && lastIndex !== -1 && lastIndex > startIndex) {
      cleaned = cleaned.substring(startIndex, lastIndex + 1);
    }

    // Fix common JSON formatting issues
    cleaned = cleaned
      .replace(/,\s*}/g, "}") // Remove trailing commas before closing braces
      .replace(/,\s*]/g, "]") // Remove trailing commas before closing brackets
      .replace(/[\r\n\t]/g, " ") // Replace newlines and tabs with spaces
      .replace(/\s+/g, " ") // Normalize multiple spaces
      .trim();

    // Validate JSON structure before returning
    JSON.parse(cleaned);
    return cleaned;
  } catch (error) {
    console.warn(
      "JSON cleaning failed, attempting to fix structure:",
      error.message
    );

    // Fallback: Try to extract valid JSON more aggressively
    try {
      let fallbackCleaned = response.replace(/```[^`]*```/g, ""); // Remove all code blocks

      // Find the largest valid JSON object
      const jsonRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
      const matches = fallbackCleaned.match(jsonRegex);

      if (matches && matches.length > 0) {
        // Try each match until we find a valid one
        for (const match of matches) {
          try {
            JSON.parse(match);
            return match;
          } catch (e) {
            continue;
          }
        }
      }

      // Last resort: return empty structure
      console.warn("Could not extract valid JSON, returning empty structure");
      return '{"publications": []}';
    } catch (fallbackError) {
      console.error(
        "Fallback JSON cleaning also failed:",
        fallbackError.message
      );
      return '{"publications": []}';
    }
  }
}

/**
 * Attempt to recover a valid JSON structure from malformed/truncated JSON
 * @param {string} malformedJson - The malformed JSON string
 * @returns {Object|null} Recovered JSON object or null if recovery fails
 */
function attemptJSONRecovery(malformedJson) {
  try {
    // First, try to identify if it's a truncated array
    if (
      malformedJson.includes('"allPublications"') &&
      malformedJson.includes("[")
    ) {
      // Find the start of the allPublications array
      const startIndex = malformedJson.indexOf('"allPublications"');
      const arrayStartIndex = malformedJson.indexOf("[", startIndex);

      if (arrayStartIndex !== -1) {
        // Build the beginning of the JSON structure
        let workingJson = '{"allPublications":[';

        // Find all complete publication objects - improved regex
        const publicationRegex =
          /\{\s*"publication"\s*:\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}\s*,\s*"verification"\s*:\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}\s*\}/g;
        const matches = malformedJson.match(publicationRegex) || [];

        if (matches.length > 0) {
          // Add all complete publications
          workingJson += matches.join(",");
          workingJson += "]}";

          // Try to parse the recovered JSON
          const recovered = JSON.parse(workingJson);
          return recovered;
        }
      }
    }

    // Try simpler recovery: find any complete publication objects with more flexible regex
    const publicationRegex =
      /\{\s*"publication"\s*:\s*\{(?:[^{}]*(?:\{[^{}]*\})?)*[^{}]*\}\s*,\s*"verification"\s*:\s*\{(?:[^{}]*(?:\{[^{}]*\})?)*[^{}]*\}\s*\}/g;
    const matches = malformedJson.match(publicationRegex) || [];

    if (matches.length > 0) {
      const validPublications = [];
      for (const match of matches) {
        try {
          const parsed = JSON.parse(match);
          validPublications.push(parsed);
        } catch (e) {
          console.warn("Skipping invalid publication object:", e.message);
        }
      }

      if (validPublications.length > 0) {
        const recoveredStructure = {
          allPublications: validPublications,
        };
        console.log(
          `[Claude CV Verification] Recovered ${validPublications.length} publications using simple recovery`
        );
        return recoveredStructure;
      }
    }

    return null;
  } catch (error) {
    console.error("JSON recovery attempt failed:", error.message);
    return null;
  }
}

/**
 * Attempt to recover a simple publication list from malformed JSON
 * @param {string} malformedJson - The malformed JSON string
 * @returns {Object|null} Recovered JSON object or null if recovery fails
 */
function attemptSimplePublicationRecovery(malformedJson) {
  try {
    // Look for simple publication objects without verification - more flexible regex
    const simplePublicationRegex =
      /\{\s*"title"\s*:\s*"[^"]*"[^}]*"authors"\s*:\s*(?:"[^"]*"|\[[^\]]*\])[^}]*"year"\s*:\s*"[^"]*"[^}]*"venue"\s*:\s*"[^"]*"[^}]*\}/g;
    const matches = malformedJson.match(simplePublicationRegex) || [];

    if (matches.length > 0) {
      const recoveredPublications = [];
      for (const match of matches) {
        try {
          const parsed = JSON.parse(match);
          recoveredPublications.push(parsed);
        } catch (e) {
          console.warn(
            "Skipping invalid simple publication object:",
            e.message
          );
        }
      }

      if (recoveredPublications.length > 0) {
        console.log(
          `[Claude CV Verification] Recovered ${recoveredPublications.length} simple publications`
        );
        return { publications: recoveredPublications };
      }
    }

    // Try even simpler recovery - just find title/author pairs
    const titleAuthorRegex =
      /"title"\s*:\s*"([^"]+)"[^}]*"authors"\s*:\s*(?:"([^"]+)"|\[([^\]]+)\])/g;
    let match;
    const simplePublications = [];

    while ((match = titleAuthorRegex.exec(malformedJson)) !== null) {
      const title = match[1];
      const authors = match[2] || match[3];

      if (title && authors) {
        simplePublications.push({
          title: title,
          authors: authors,
          year: "Unknown",
          venue: "Unknown",
          fullText: `${title} by ${authors}`,
        });
      }
    }

    if (simplePublications.length > 0) {
      console.log(
        `[Claude CV Verification] Recovered ${simplePublications.length} minimal publications from title/author pairs`
      );
      return { publications: simplePublications };
    }

    return null;
  } catch (error) {
    console.error("Simple publication recovery failed:", error.message);
    return null;
  }
}

/**
 * Generate search link for publication
 * @param {string} title - Publication title
 * @returns {string} Search URL
 */
function generateSearchLink(title) {
  if (!title) return "#";
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
 * Process all publication sections with Claude verification using size-based batching
 * This batches publication sections by MAX_CHUNK_SIZE to reduce API calls while staying within limits
 * @param {Anthropic} anthropic - Anthropic client instance
 * @param {Array} publicationSections - Array of publication section objects
 * @param {string} candidateName - Candidate name
 * @returns {Promise<Array>} Array of verified publications from all sections
 */
async function processBatchedPublicationSectionsWithClaude(
  anthropic,
  publicationSections,
  candidateName
) {
  if (!publicationSections || publicationSections.length === 0) {
    return [];
  }

  console.log(
    `[Claude CV Verification] Processing ${publicationSections.length} publication sections using size-based batching`
  );

  // Create batches of section content based on MAX_CHUNK_SIZE
  const batches = createSectionContentBatches(publicationSections);

  console.log(
    `[Claude CV Verification] Created ${batches.length} batches for verification`
  );

  const allResults = [];

  // Process each batch
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    const batchResults = await processBatchOfSectionContentWithClaude(
      anthropic,
      batch,
      candidateName,
      i + 1
    );
    allResults.push(...batchResults);
  }

  console.log(
    `[Claude CV Verification] Completed processing with ${allResults.length} verified publications`
  );
  return removeDuplicatePublications(allResults);
}

/**
 * Process publication content with Claude verification (handles both single sections and batches)
 * @param {Anthropic} anthropic - Anthropic client instance
 * @param {Object|string} content - Batch object with combinedContent or single section content
 * @param {string} candidateName - Candidate name
 * @param {number} batchNumber - Batch number for logging
 * @returns {Promise<Array>} Array of verified publications
 */
async function processBatchOfSectionContentWithClaude(
  anthropic,
  content,
  candidateName,
  batchNumber = 1
) {
  // Handle both batch objects and direct content strings
  const publicationContent =
    typeof content === "string" ? content : content.combinedContent;

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

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16384,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const rawResponse = response.content[0]?.text;
  const verificationText = cleanJSONResponse(rawResponse);

  let verificationData;
  try {
    verificationData = JSON.parse(verificationText);
  } catch (parseError) {
    console.error(
      `[Claude CV Verification] JSON Parse Error: ${parseError.message}`
    );

    // Attempt to fix truncated or malformed JSON
    const fixedText = fixTruncatedJSON(verificationText);

    try {
      verificationData = JSON.parse(fixedText);
    } catch (secondError) {
      console.error(
        `[Claude CV Verification] Could not fix JSON:`,
        secondError.message
      );
      throw new Error(
        `Failed to parse AI response as JSON: ${parseError.message}`
      );
    }
  }

  const allPublications = verificationData.allPublications || [];

  console.log(
    `[Claude CV Verification] Extracted ${allPublications.length} publications from batch ${batchNumber}`
  );

  return allPublications.map((item) => {
    return transformPublicationResult(
      item.publication,
      item.verification,
      item.publication
    );
  });
}

/**
 * Process a publication section with Claude AI verification
 * @param {Anthropic} anthropic - Anthropic client instance
 * @param {Object} section - Publication section object
 * @param {string} candidateName - Candidate name
 * @returns {Promise<Array>} Array of verified publications
 */
async function processPublicationSectionWithClaude(
  anthropic,
  section,
  candidateName
) {
  // Use the unified batch processing function for single sections
  return await processBatchOfSectionContentWithClaude(
    anthropic,
    section.content,
    candidateName,
    1
  );
}
