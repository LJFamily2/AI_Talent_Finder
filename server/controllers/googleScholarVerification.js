/**
 * Google Scholar Verification Module
 *
 * This module handles verification of academic publications through Google Scholar.
 * It provides functionality to:
 * - Search for publications using SerpAPI
 * - Match titles and DOIs with high accuracy
 * - Extract author information from publication data
 * - Verify author names against candidate names
 * - Fetch detailed author profiles and citation data
 *
 * @module googleScholarVerification
 * @author AI Talent Finder Team
 * @version 1.0.0
 */

const axios = require("axios");
const { getTitleSimilarity, normalizeTitle } = require("../utils/textUtils");
const {
  checkAuthorNameMatch,
  getAuthorDetails,
} = require("../utils/authorUtils");

//=============================================================================
// CONFIGURATION AND CONSTANTS
//=============================================================================

/** Minimum similarity threshold for title matching */
const TITLE_SIMILARITY_THRESHOLD = 90;

/** Minimum title length ratio for valid matches */
const MIN_TITLE_LENGTH_RATIO = 0.8;
//=============================================================================
// UTILITY FUNCTIONS
//=============================================================================

/**
 * Creates a Google Scholar search URL for a given publication title
 *
 * @param {string} title - The publication title to search for
 * @returns {string|null} Google Scholar search URL or null if no title provided
 *
 * @example
 * const url = createGoogleScholarSearchUrl("Machine Learning in Healthcare");
 * // Returns: "https://scholar.google.com/scholar?hl=en&as_sdt=0%2C5&q=Machine%20Learning%20in%20Healthcare"
 */
const createGoogleScholarSearchUrl = (title) => {
  if (!title) return null;
  const encodedTitle = encodeURIComponent(title);
  return `https://scholar.google.com/scholar?hl=en&as_sdt=0%2C5&q=${encodedTitle}`;
};

//=============================================================================
// PUBLICATION VERIFICATION
//=============================================================================

/**
 * Verifies a publication using Google Scholar search
 *
 * @param {string} title - Publication title to search for
 * @param {string} doi - DOI of the publication (optional)
 * @param {string} candidateName - Name of the candidate to match against authors
 * @param {number} maxResultsToCheck - Maximum number of search results to examine
 * @returns {Promise<Object>} Verification result object
 */

const verifyWithGoogleScholar = async (
  title,
  doi,
  candidateName = null,
  maxResultsToCheck = 3
) => {
  try {
    // Step 1: Search Google Scholar for the publication
    const searchResults = await searchGoogleScholar(title, maxResultsToCheck);

    if (!searchResults.organicResults.length) {
      return createVerificationResponse(
        "unable to verify",
        null,
        searchResults.rawResult
      );
    }

    // Step 2: Find matching publication in search results
    const matchedPublication = findMatchingPublication(
      searchResults.organicResults,
      title,
      doi
    );

    if (!matchedPublication) {
      return createVerificationResponse(
        "unable to verify",
        null,
        searchResults.rawResult
      );
    } // Step 3: Extract author information from the matched publication
    const authorInfo = extractAuthorInformation(
      matchedPublication,
      candidateName
    );

    // Step 4: Determine verification status and return result
    const verificationStatus = authorInfo.hasAuthorMatch
      ? "verified"
      : "verified but not same author name";

    return createVerificationResponse(
      verificationStatus,
      {
        ...matchedPublication,
        extractedAuthors: authorInfo.extractedAuthors,
        hasAuthorMatch: authorInfo.hasAuthorMatch,
        authorId: authorInfo.matchedAuthorId, // Include author ID for aggregation
      },
      searchResults.rawResult
    );
  } catch (err) {
    return createVerificationResponse("unable to verify", null, null);
  }
};

//=============================================================================
// HELPER FUNCTIONS FOR GOOGLE SCHOLAR VERIFICATION
//=============================================================================

/**
 * Searches Google Scholar using SerpAPI
 * @param {string} title - Publication title to search
 * @param {number} maxResults - Maximum results to retrieve
 * @returns {Promise<Object>} Search results object
 * @private
 */
const searchGoogleScholar = async (title, maxResults) => {
  const serpApiKey = process.env.GOOGLE_SCHOLAR_API_KEY;
  const scholarApiUrl = `https://serpapi.com/search?engine=google_scholar&q=${encodeURIComponent(
    title
  )}&hl=en&api_key=${serpApiKey}&num=${maxResults}`;

  const { data: scholarResult } = await axios.get(scholarApiUrl);
  const organicResults =
    scholarResult?.organic_results || scholarResult?.items || [];

  return {
    organicResults,
    rawResult: scholarResult,
  };
};

/**
 * Finds a matching publication in Google Scholar search results
 * @param {Array} results - Search results from Google Scholar
 * @param {string} title - Publication title to match
 * @param {string} doi - DOI to match (optional)
 * @returns {Object|null} Matched publication or null if not found
 * @private
 */

const findMatchingPublication = (results, title, doi) => {
  return results.find((item) => {
    // DOI match takes highest precedence
    if (doi && item.link?.toLowerCase().includes(doi.toLowerCase())) {
      return true;
    }

    // Title-based matching
    if (title && item.title) {
      const normalizedTitle = normalizeTitle(title);
      const normalizedItemTitle = normalizeTitle(item.title);

      // Check for substring matches
      if (
        normalizedItemTitle.includes(normalizedTitle) ||
        normalizedTitle.includes(normalizedItemTitle)
      ) {
        return true;
      }

      const titleLengthRatio =
        Math.min(normalizedTitle.length, normalizedItemTitle.length) /
        Math.max(normalizedTitle.length, normalizedItemTitle.length);

      // Check similarity score
      const similarity = getTitleSimilarity(
        normalizedTitle,
        normalizedItemTitle
      );

      if (
        similarity >= TITLE_SIMILARITY_THRESHOLD &&
        titleLengthRatio >= MIN_TITLE_LENGTH_RATIO
      ) {
        return true;
      }
    }

    return false;
  });
};

/**
 * Extracts author information from a Google Scholar publication entry
 * @param {Object} publication - Publication object from Google Scholar
 * @param {string} candidateName - Candidate name to match against
 * @returns {Object} Author information object
 * @private
 */
const extractAuthorInformation = (publication, candidateName) => {
  const extractedAuthors = [];
  let hasAuthorMatch = false;
  let matchedAuthorId = null;

  // Extract authors from publication summary
  if (publication.publication_info?.summary) {
    const authorNames = parseAuthorNamesFromSummary(
      publication.publication_info.summary
    );
    extractedAuthors.push(...authorNames);
  }

  // Extract authors from authors array
  if (publication.publication_info?.authors?.length > 0) {
    publication.publication_info.authors.forEach((author) => {
      if (author.name) {
        extractedAuthors.push(author.name);
      }
    });

    // Check for author match and get author ID
    if (candidateName && extractedAuthors.length > 0) {
      hasAuthorMatch = checkAuthorNameMatch(candidateName, extractedAuthors);

      if (hasAuthorMatch) {
        matchedAuthorId = findMatchedAuthorId(
          publication.publication_info.authors,
          candidateName
        );
      }
    }
  }

  return {
    extractedAuthors,
    hasAuthorMatch,
    matchedAuthorId,
    authorDetails: null,
  };
};

/**
 * Parses author names from publication summary string
 * @param {string} summary - Publication summary containing author information
 * @returns {Array<string>} Array of extracted author names
 * @private
 */
const parseAuthorNamesFromSummary = (summary) => {
  const authorPart = summary.split(" - ")[0].trim();

  if (authorPart && !authorPart.includes("…") && !authorPart.includes("...")) {
    return authorPart
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
  }

  return [];
};

/**
 * Finds the Google Scholar author ID for a matched author
 * @param {Array} authors - Array of author objects from Google Scholar
 * @param {string} candidateName - Candidate name to match
 * @returns {string|null} Author ID or null if not found
 * @private
 */
const findMatchedAuthorId = (authors, candidateName) => {
  // Try to find the specific author that matches the candidate name
  const matchedAuthor = authors.find((author) => {
    if (!author.name) return false;
    return checkAuthorNameMatch(candidateName, [author.name]);
  });

  if (matchedAuthor && matchedAuthor.author_id) {
    return matchedAuthor.author_id;
  }

  // Fallback: use the first author with an ID
  const firstAuthorWithId = authors.find((author) => author.author_id);
  return firstAuthorWithId ? firstAuthorWithId.author_id : null;
};

/**
 * Fetches detailed author information from Google Scholar
 * @param {string} authorId - Google Scholar author ID
 * @param {string} apiKey - SerpAPI key
 * @param {string} publicationTitle - Title of the publication
 * @returns {Promise<Object|null>} Author details or null if failed
 * @private
 */
const fetchAuthorDetails = async (authorId, apiKey, publicationTitle) => {
  try {
    const authorInfo = await getAuthorDetails(
      authorId,
      apiKey,
      publicationTitle
    );
    return authorInfo ? authorInfo.details : null;
  } catch (error) {
    return null;
  }
};

/**
 * Creates a standardized verification response object
 * @param {string} status - Verification status
 * @param {Object} details - Publication details
 * @param {Object} result - Raw API result
 * @returns {Object} Formatted verification response
 * @private
 */
const createVerificationResponse = (status, details, result) => {
  return {
    status,
    details,
    result,
  };
};

//=============================================================================
// MODULE EXPORTS
//=============================================================================

module.exports = {
  verifyWithGoogleScholar,
  createGoogleScholarSearchUrl,
};
