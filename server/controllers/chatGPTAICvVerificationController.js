/**
 * ChatGPT AI-Based CV Verification Controller
 *
 * This controller provides ChatGPT-powered academic CV verification that focuses on
 * publication verification and author matching without external API dependencies.
 * It uses ChatGPT to:
 * - Verify if publications exist online
 * - Extract publication details and find links
 * - Match candidate names with publication authors
 * - Return results in the same format as traditional verification
 *
 * @module chatGPTAiCvVerification
 * @author SwangLee
 * @version 1.0.0
 */

//======================== CONSTANTS & IMPORTS ========================
const fs = require("fs");
const OpenAI = require("openai");
const {
  initializeHeaderClassifier,
} = require("../utils/headerClassifierUtils");
const { extractTextFromPDF } = require("../utils/pdfUtils");
const { aggregateAuthorDetails } = require("../utils/authorDetailsAggregator");
const axios = require("axios");

const MAX_CHUNK_SIZE = 5000;

//======================== MAIN FUNCTION ========================
module.exports = {
  verifyCVWithChatGPT,
};

async function verifyCVWithChatGPT(file, prioritySource = "chatgpt") {
  let cvText = "";
  try {
    cvText = await extractTextFromPDF(file.path);
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY,
    });
    const candidateName = await extractCandidateNameWithChatGPT(openai, cvText);
    const verificationResults = await processFullCVWithChatGPT(
      openai,
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
    console.error("[ChatGPT CV Verification] Error:", error);
    throw error;
  } finally {
    if (file && file.path) {
      try {
        fs.unlinkSync(file.path);
      } catch (cleanupError) {
        console.warn(
          "[ChatGPT CV Verification] File cleanup failed:",
          cleanupError.message
        );
      }
    }
  }
}

//=============================================================================
// CHATGPT-SPECIFIC FUNCTIONS
//=============================================================================

/**
 * Extract candidate name using ChatGPT
 * @param {OpenAI} openai - OpenAI client instance
 * @param {string} cvText - CV text content
 * @returns {Promise<string>} Candidate name
 */
async function extractCandidateNameWithChatGPT(openai, cvText) {
  const prompt = `You are an expert CV analyzer.
From the text of this CV/resume, extract ONLY the full name of the candidate/person whose CV this is.
Return ONLY the name as plain text - no explanation, no JSON, no additional information.
If you cannot determine the name with high confidence, return "UNKNOWN".

CV TEXT:
${cvText.substring(0, 2000)}`; // Only need the beginning of the CV

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content:
            "You are an expert CV analyzer. Extract only the candidate's name.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],

      max_completion_tokens: 100,
    });

    const candidateName = response.choices[0]?.message?.content?.trim();
    return candidateName === "UNKNOWN" ? null : candidateName;
  } catch (error) {
    console.error("Error extracting candidate name with ChatGPT:", error);
    return null;
  }
}

/**
 * Process full CV content with ChatGPT to directly verify publications online
 * Handles large CVs by chunking them into manageable pieces
 * @param {OpenAI} openai - OpenAI client instance
 * @param {string} cvText - Full CV text content
 * @param {string} candidateName - Candidate name
 * @returns {Promise<Array>} Verification results array
 */
async function processFullCVWithChatGPT(openai, cvText, candidateName) {
  try {
    // Check if CV is too large and needs chunking
    if (cvText.length > MAX_CHUNK_SIZE) {
      return await processLargeCVWithChunking(openai, cvText, candidateName);
    }

    // For smaller CVs, process directly
    return await processSmallCVDirectly(openai, cvText, candidateName);
  } catch (error) {
    console.error("Error in CV processing:", error);
    // Fallback: Try to extract publications using the existing AI helper with a generic model
    return await fallbackPublicationExtraction(openai, cvText, candidateName);
  }
}

/**
 * Process small CV directly without chunking
 * @param {OpenAI} openai - OpenAI client instance
 * @param {string} cvText - Full CV text content
 * @param {string} candidateName - Candidate name
 * @returns {Promise<Array>} Verification results array
 */
async function processSmallCVDirectly(openai, cvText, candidateName) {
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
    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content:
            "You are an expert academic CV analyzer and publication verifier.",
        },
        {
          role: "user",
          content: directVerificationPrompt,
        },
      ],

      max_completion_tokens: 16384,
    });

    const verificationText = cleanJSONResponse(
      response.choices[0]?.message?.content
    );

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
 * Process large CV by chunking it into smaller pieces
 * @param {OpenAI} openai - OpenAI client instance
 * @param {string} cvText - Full CV text content
 * @param {string} candidateName - Candidate name
 * @returns {Promise<Array>} Verification results array
 */
async function processLargeCVWithChunking(openai, cvText, candidateName) {
  try {
    console.log(
      "[ChatGPT CV Verification] Using ML model for large CV processing"
    );

    // Initialize ML header classifier
    const headerClassifier = initializeHeaderClassifier(
      "ChatGPT CV Verification"
    );

    if (headerClassifier && headerClassifier.trained) {
      // Use ML model to identify publication sections
      const publicationSections = extractPublicationSectionsWithML(
        cvText,
        headerClassifier
      );

      if (publicationSections.length > 0) {
        console.log(
          `[ChatGPT CV Verification] Found ${publicationSections.length} publication sections using ML model`
        );

        // Process ALL publication sections in a single batch request
        const allResults = await processBatchedPublicationSectionsWithChatGPT(
          openai,
          publicationSections,
          candidateName
        );

        return removeDuplicatePublications(allResults);
      }
    }

    // Fallback to chunking approach if ML model fails
    console.log(
      "[ChatGPT CV Verification] Falling back to traditional chunked processing"
    );
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

    console.log(
      `[ChatGPT CV Verification] Processing ${chunks.length} chunks in batched requests`
    );

    // Process chunks in batches to reduce API calls
    const allResults = await processBatchedChunksWithChatGPT(
      openai,
      chunks,
      candidateName
    );

    // Remove duplicates based on title similarity
    return removeDuplicatePublications(allResults);
  } catch (error) {
    console.error("Error in large CV chunked processing:", error);
    throw error;
  }
}

/**
 * Fallback publication extraction if direct verification fails
 * @param {OpenAI} openai - OpenAI client instance
 * @param {string} cvText - CV text content
 * @param {string} candidateName - Candidate name
 * @returns {Promise<Array>} Basic verification results
 */
async function fallbackPublicationExtraction(openai, cvText, candidateName) {
  console.log(
    "[ChatGPT CV Verification] Using fallback publication extraction"
  );

  try {
    // Extract publications using ChatGPT in a simpler way
    const extractPrompt = `Extract all academic publications from this CV. Return as JSON array:

CV TEXT:
${cvText}

Return format:
{
  "publications": [
    {
      "title": "publication title",
      "authors": "author list",
      "year": "year",
      "venue": "journal/conference",
      "fullText": "original text from CV"
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content:
            "You are an expert at extracting publications from academic CVs.",
        },
        {
          role: "user",
          content: extractPrompt,
        },
      ],

      max_completion_tokens: 3000,
    });

    const extractionText = cleanJSONResponse(
      response.choices[0]?.message?.content
    );
    const extractionData = JSON.parse(extractionText);
    const publications = extractionData.publications || [];

    // Transform to expected format with basic verification
    return publications.map((pub) => {
      return transformPublicationResult(
        pub,
        { isOnline: false, hasAuthorMatch: false }, // Basic not verified
        pub
      );
    });
  } catch (error) {
    console.error("Fallback extraction failed:", error);
    return [];
  }
}

/**
 * Process multiple CV chunks in batched ChatGPT requests
 * Combines chunks to reduce API calls while staying within token limits
 * @param {OpenAI} openai - OpenAI client instance
 * @param {Array} chunks - Array of CV text chunks
 * @param {string} candidateName - Candidate name
 * @returns {Promise<Array>} Array of verified publications from all chunks
 */
async function processBatchedChunksWithChatGPT(openai, chunks, candidateName) {
  const MAX_COMBINED_SIZE = 15000; // Conservative limit for combined chunks
  const batchedChunks = [];

  // Group chunks into batches that fit within token limits
  let currentBatch = [];
  let currentSize = 0;

  for (const chunk of chunks) {
    if (
      currentSize + chunk.length > MAX_COMBINED_SIZE &&
      currentBatch.length > 0
    ) {
      // Start a new batch
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
    `[ChatGPT CV Verification] Grouped ${chunks.length} chunks into ${batchedChunks.length} batched requests`
  );

  const allResults = [];

  // Process each batch
  for (let i = 0; i < batchedChunks.length; i++) {
    const batch = batchedChunks[i];
    try {
      console.log(
        `[ChatGPT CV Verification] Processing batch ${i + 1}/${
          batchedChunks.length
        } with ${batch.length} chunks`
      );

      // Combine chunks in this batch
      const combinedChunkText = batch.join("\n\n--- NEXT CHUNK ---\n\n");

      const batchResults = await processSmallCVDirectly(
        openai,
        combinedChunkText,
        candidateName
      );

      allResults.push(...batchResults);
    } catch (error) {
      console.error(`Error processing batch ${i + 1}:`, error);

      // Fallback: Process chunks individually if batch fails
      console.log(
        `[ChatGPT CV Verification] Batch ${
          i + 1
        } failed, processing chunks individually`
      );
      for (let j = 0; j < batch.length; j++) {
        try {
          const chunkResults = await processSmallCVDirectly(
            openai,
            batch[j],
            candidateName
          );
          allResults.push(...chunkResults);
        } catch (chunkError) {
          console.error(
            `Error processing individual chunk in batch ${i + 1}, chunk ${
              j + 1
            }:`,
            chunkError
          );
          // Continue with other chunks
        }
      }
    }
  }

  return allResults;
}

//=============================================================================
// SHARED HELPER FUNCTIONS (same as Gemini controller)
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
      chatgpt_verification: {
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
        chatgpt_verified: verification?.hasAuthorMatch
          ? "chatgpt_verified"
          : null,
      },
    },
  };
}

/**
 * Fix truncated or malformed JSON responses from AI
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
 * Process ALL publication sections in a single batched ChatGPT request
 * This significantly reduces API calls compared to processing each section individually
 * @param {OpenAI} openai - OpenAI client instance
 * @param {Array} publicationSections - Array of publication section objects
 * @param {string} candidateName - Candidate name
 * @returns {Promise<Array>} Array of verified publications from all sections
 */
async function processBatchedPublicationSectionsWithChatGPT(
  openai,
  publicationSections,
  candidateName
) {
  if (!publicationSections || publicationSections.length === 0) {
    return [];
  }

  console.log(
    `[ChatGPT CV Verification] Processing ${publicationSections.length} publication sections using size-based batching`
  );

  // Create batches of section content based on MAX_CHUNK_SIZE
  const batches = createSectionContentBatches(publicationSections);

  console.log(
    `[ChatGPT CV Verification] Created ${batches.length} batches for verification`
  );

  const allResults = [];

  // Process each batch
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    const batchResults = await processBatchOfSectionContentWithChatGPT(
      openai,
      batch,
      candidateName,
      i + 1
    );
    allResults.push(...batchResults);
  }

  return removeDuplicatePublications(allResults);
}

/**
 * Process publication content with ChatGPT verification (handles both single sections and batches)
 * @param {OpenAI} openai - OpenAI client instance
 * @param {Object|string} content - Batch object with combinedContent or single section content
 * @param {string} candidateName - Candidate name
 * @param {number} batchNumber - Batch number for logging
 * @returns {Promise<Array>} Array of verified publications
 */
async function processBatchOfSectionContentWithChatGPT(
  openai,
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

  const response = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      {
        role: "system",
        content:
          "You are an expert academic CV analyzer and publication verifier.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    max_completion_tokens: 16384,
  });

  const verificationText = cleanJSONResponse(
    response.choices[0]?.message?.content
  );

  let verificationData;
  try {
    verificationData = JSON.parse(verificationText);
  } catch (parseError) {
    console.error(
      `[ChatGPT CV Verification] JSON Parse Error: ${parseError.message}`
    );

    // Attempt to fix truncated or malformed JSON
    const fixedText = fixTruncatedJSON(verificationText);

    try {
      verificationData = JSON.parse(fixedText);
    } catch (secondError) {
      console.error(
        `[ChatGPT CV Verification] Could not fix JSON:`,
        secondError.message
      );
      throw new Error(
        `Failed to parse AI response as JSON: ${parseError.message}`
      );
    }
  }

  const allPublications = verificationData.allPublications || [];

  return allPublications.map((item) => {
    return transformPublicationResult(
      item.publication,
      item.verification,
      item.publication
    );
  });
}

/**
 * Process a publication section with ChatGPT verification
 * @param {OpenAI} openai - OpenAI client instance
 * @param {Object} section - Publication section object
 * @param {string} candidateName - Candidate name
 * @returns {Promise<Array>} Array of verified publications
 */
async function processPublicationSectionWithChatGPT(
  openai,
  section,
  candidateName
) {
  // Use the unified batch processing function for single sections
  return await processBatchOfSectionContentWithChatGPT(
    openai,
    section.content,
    candidateName,
    1
  );
}

//=============================================================================
// ML MODEL UTILITIES
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

    // Get content between headers
    const sectionLines = lines.slice(header.index + 1, sectionEnd);
    const content = sectionLines.join("\n");

    publicationSections.push({
      header: header.text,
      content: content,
      startLine: header.lineNumber,
      endLine: nextHeader ? nextHeader.lineNumber - 1 : lines.length,
    });
  }

  return publicationSections;
}

/**
 * Chunk CV text into smaller pieces for processing
 * @param {string} cvText - Full CV text content
 * @param {number} maxSize - Maximum chunk size
 * @returns {Array} Array of text chunks
 */
function chunkCVText(cvText, maxSize = 8000) {
  // Split on newlines to avoid cutting in middle of text
  const lines = cvText.split(/\n+/).filter(Boolean);
  const chunks = [];
  let currentChunk = "";

  for (const line of lines) {
    if (currentChunk.length + line.length + 1 > maxSize) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }
    currentChunk += line + "\n";
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
