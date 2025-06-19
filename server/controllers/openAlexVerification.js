/**
 * OpenAlex Verification Module
 *
 * This module handles verification of academic publications through OpenAlex API.
 * It provides functionality to:
 * - Search for publications using OpenAlex API
 * - Match titles and DOIs with high accuracy
 * - Extract author information from publication data
 * - Verify author names against candidate names
 * - Build detailed publication information
 *
 * @module openAlexVerification
 * @author AI Talent Finder Team
 * @version 1.0.0
 */

const axios = require("axios");
const { getTitleSimilarity } = require("../utils/textUtils");
const { checkAuthorNameMatch } = require("../utils/authorUtils");

//=============================================================================
// CONFIGURATION AND CONSTANTS
//=============================================================================

/** Minimum similarity threshold for title matching */
const TITLE_SIMILARITY_THRESHOLD = 98;

/** Minimum title length ratio for valid matches */
const MIN_TITLE_LENGTH_RATIO = 0.8;

//=============================================================================
// PUBLICATION VERIFICATION
//=============================================================================

/**
 * Verifies a publication using OpenAlex search
 *
 * @param {string} title - Publication title to search for
 * @param {string} doi - DOI of the publication (optional)
 * @param {string} candidateName - Name of the candidate to match against authors
 * @param {number} maxResultsToCheck - Maximum number of search results to examine
 * @returns {Promise<Object>} Verification result object with status and details
 *
 * @example
 * const result = await verifyWithOpenAlex(
 *   "Machine Learning in Medical Diagnosis",
 *   "10.1016/journal.123",
 *   "Dr. Jane Smith",
 *   5
 * );
 */
const verifyWithOpenAlex = async (
  title,
  doi,
  candidateName = null,
  maxResultsToCheck = 5
) => {
  try {
    console.log(`🔍 [OpenAlex] Verifying publication: "${title}"`);
    if (doi) {
      console.log(`📋 [OpenAlex] DOI: ${doi}`);
    }

    // Step 1: Search OpenAlex for the publication
    const searchResults = await searchOpenAlex(title, maxResultsToCheck);

    if (!searchResults.results || searchResults.results.length === 0) {
      console.log("❌ [OpenAlex] No search results found");
      return createOpenAlexResponse("unable to verify", null, searchResults);
    }

    console.log(
      `📊 [OpenAlex] Found ${searchResults.results.length} search results`
    );

    // Step 2: Find matching publication in search results
    const matchedPublication = findMatchingPublication(
      searchResults.results,
      title,
      doi
    );

    if (!matchedPublication) {
      console.log("❌ [OpenAlex] No matching publication found in results");
      return createOpenAlexResponse("unable to verify", null, searchResults);
    }

    console.log(
      `✅ [OpenAlex] Found matching publication: "${
        matchedPublication.title || matchedPublication.display_name
      }"`
    );

    // Step 3: Extract and process author information
    const authorInfo = extractAuthorInformation(
      matchedPublication,
      candidateName
    );

    console.log(
      `👥 [OpenAlex] Extracted ${authorInfo.extractedAuthors.length} authors`
    );
    console.log(
      `🔍 [OpenAlex] Author match found: ${authorInfo.hasAuthorMatch}`
    );

    // Step 4: Build detailed response with OpenAlex-specific data
    const details = buildPublicationDetails(matchedPublication, authorInfo);

    // Step 5: Determine verification status based on author match
    const verificationStatus = authorInfo.hasAuthorMatch
      ? "verified"
      : "verified but not same author name";

    console.log(
      `📋 [OpenAlex] Final verification status: ${verificationStatus}`
    );

    return createOpenAlexResponse(verificationStatus, details, searchResults);
  } catch (err) {
    console.error("❌ [OpenAlex] Verification error:", err.message);
    return createOpenAlexResponse("unable to verify", null, null);
  }
};

//=============================================================================
// HELPER FUNCTIONS FOR OPENALEX VERIFICATION
//=============================================================================

/**
 * Searches the OpenAlex database
 * @param {string} title - Publication title to search
 * @param {number} maxResults - Maximum results to retrieve
 * @returns {Promise<Object>} Search results object
 * @private
 */
const searchOpenAlex = async (title, maxResults) => {
  const openAlexApiUrl = `https://api.openalex.org/works?search=${encodeURIComponent(
    title
  )}&per-page=${maxResults}&select=id,doi,title,display_name,publication_year,type,type_crossref,authorships,topics`;

  console.log(`🌐 [OpenAlex] API call: ${openAlexApiUrl}`);
  const { data: openAlexResult } = await axios.get(openAlexApiUrl);
  return openAlexResult;
};

/**
 * Finds a matching publication in OpenAlex search results
 * @param {Array} results - Search results from OpenAlex
 * @param {string} title - Publication title to match
 * @param {string} doi - DOI to match (optional)
 * @returns {Object|null} Matched publication or null if not found
 * @private
 */
const findMatchingPublication = (results, title, doi) => {
  return results.find((item) => {
    // DOI match takes highest precedence
    if (doi && item.doi?.toLowerCase() === doi.toLowerCase()) {
      console.log(`✅ [OpenAlex] DOI match found: ${item.doi}`);
      return true;
    }

    // Title-based matching
    if (title && (item.title || item.display_name)) {
      const normalizedTitle = title.toLowerCase().trim();
      const normalizedItemTitle = (item.title || item.display_name)
        .toLowerCase()
        .trim();

      const similarity = getTitleSimilarity(
        normalizedTitle,
        normalizedItemTitle
      );

      // Check title length ratio to ensure reasonable match
      const titleLengthRatio =
        Math.min(normalizedTitle.length, normalizedItemTitle.length) /
        Math.max(normalizedTitle.length, normalizedItemTitle.length);

      console.log(
        `📊 [OpenAlex] Title similarity: ${similarity}%, Length ratio: ${titleLengthRatio.toFixed(
          2
        )}`
      );

      // Only verify if the similarity is very high and titles have reasonable length
      if (
        similarity >= TITLE_SIMILARITY_THRESHOLD &&
        titleLengthRatio >= MIN_TITLE_LENGTH_RATIO
      ) {
        console.log(
          `✅ [OpenAlex] Title match found: "${
            item.title || item.display_name
          }"`
        );
        return true;
      }
    }

    return false;
  });
};

/**
 * Extracts author information from an OpenAlex publication entry
 * @param {Object} publication - Publication object from OpenAlex
 * @param {string} candidateName - Candidate name to match against
 * @returns {Object} Author information object
 * @private
 */
const extractAuthorInformation = (publication, candidateName) => {
  const extractedAuthors = [];
  let hasAuthorMatch = false;
  let authorId = null;

  // Extract authors from authorships array
  if (publication.authorships && Array.isArray(publication.authorships)) {
    publication.authorships.forEach((authorship) => {
      if (authorship.author && authorship.author.display_name) {
        extractedAuthors.push(authorship.author.display_name);
      }
    });

    // Remove duplicates
    const uniqueAuthors = [...new Set(extractedAuthors)];
    console.log(`👥 [OpenAlex] Unique authors: ${uniqueAuthors.join(", ")}`);

    // Check if candidate name matches any extracted authors
    if (candidateName && uniqueAuthors.length > 0) {
      hasAuthorMatch = checkAuthorNameMatch(candidateName, uniqueAuthors);
      console.log(
        `🔍 [OpenAlex] Checking candidate "${candidateName}" against authors`
      );
    }

    // If there's a match, try to find the author ID
    if (hasAuthorMatch && publication.authorships) {
      for (const authorship of publication.authorships) {
        if (!authorship.author) continue;

        // Check if the author name matches the candidate
        if (
          checkAuthorNameMatch(candidateName, [authorship.author.display_name])
        ) {
          authorId = authorship.author.id;
          console.log(`🆔 [OpenAlex] Found author ID: ${authorId}`);
          break;
        }
      }
    }
  }

  return {
    extractedAuthors,
    hasAuthorMatch,
    authorId,
  };
};

/**
 * Builds detailed publication information for the response
 * @param {Object} publication - Matched publication from OpenAlex
 * @param {Object} authorInfo - Extracted author information
 * @returns {Object} Detailed publication object
 * @private
 */
const buildPublicationDetails = (publication, authorInfo) => {
  return {
    id: publication.id,
    title: publication.title || publication.display_name,
    doi: publication.doi,
    publication_year: publication.publication_year,
    type: publication.type || publication.type_crossref,
    extractedAuthors: authorInfo.extractedAuthors,
    hasAuthorMatch: authorInfo.hasAuthorMatch,
    authorId: authorInfo.authorId,
    topics: publication.topics?.map((topic) => topic.display_name) || [],
  };
};

/**
 * Creates a structured response for OpenAlex verification
 * @param {string} status - Verification status
 * @param {Object} details - Publication details
 * @param {Object} rawData - Raw data from OpenAlex
 * @returns {Object} Formatted verification response
 * @private
 */
const createOpenAlexResponse = (status, details, rawData) => {
  return {
    source: "openalex",
    status,
    details,
    rawData: rawData,
  };
};

module.exports = {
  verifyWithOpenAlex,
};
