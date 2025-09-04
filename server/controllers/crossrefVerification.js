/**
 * Crossref Verification Module
 *
 * This module handles verification of academic publications through Crossref API.
 * It provides functionality to:
 * - Search for publications using Crossref API
 * - Match titles and DOIs with high accuracy
 * - Extract author information from publication data
 * - Verify author names against candidate names
 * - Build detailed publication information
 *
 * @module crossrefVerification
 * @author AI Talent Finder Team
 * @version 1.0.0
 */

const axios = require("axios");
const { getTitleSimilarity, normalizeTitle } = require("../utils/textUtils");
const { checkAuthorNameMatch } = require("../utils/authorUtils");

//=============================================================================
// CONFIGURATION AND CONSTANTS
//=============================================================================

/** Minimum similarity threshold for title matching */
const TITLE_SIMILARITY_THRESHOLD = 90;

/** Minimum title length ratio for valid matches */
const MIN_TITLE_LENGTH_RATIO = 0.8;

/** Email for Crossref API requests */
const CROSSREF_EMAIL = "s3977794@rmit.edu.vn";

/** Selected fields for efficient Crossref API calls */
const CROSSREF_SELECT_FIELDS = [
  "DOI",
  "title",
  "author",
  "publisher",
  "container-title",
  "volume",
  "issue",
  "page",
  "published",
  "published-print",
  "type",
  "is-referenced-by-count",
  "references-count",
  "subject",
  "URL",
].join(",");

//=============================================================================
// PUBLICATION VERIFICATION
//=============================================================================

/**
 * Verifies a publication using Crossref search
 *
 * @param {string} title - Publication title to search for
 * @param {string} doi - DOI of the publication (optional)
 * @param {string} candidateName - Name of the candidate to match against authors
 * @param {number} maxResultsToCheck - Maximum number of search results to examine
 * @returns {Promise<Object>} Verification result object with status and details
 *
 * @example
 * const result = await verifyWithCrossref(
 *   "Machine Learning in Medical Diagnosis",
 *   "10.1016/journal.123",
 *   "Dr. Jane Smith",
 *   5
 * );
 */
const verifyWithCrossref = async (
  title,
  doi,
  candidateName = null,
  maxResultsToCheck = 1
) => {
  try {
    // Step 1: Search Crossref for the publication
    const searchResults = await searchCrossref(title, maxResultsToCheck);

    if (
      !searchResults.message ||
      !searchResults.message.items ||
      searchResults.message.items.length === 0
    ) {
      return createCrossrefResponse("unable to verify", null, searchResults);
    }

    // Step 2: Find matching publication in search results
    const matchedPublication = findMatchingPublication(
      searchResults.message.items,
      title,
      doi
    );

    if (!matchedPublication) {
      return createCrossrefResponse("unable to verify", null, searchResults);
    }

    // Step 3: Extract and process author information
    const authorInfo = extractAuthorInformation(
      matchedPublication,
      candidateName
    );

    // Step 4: Build detailed response with Crossref-specific data
    const details = buildPublicationDetails(matchedPublication, authorInfo);

    // Step 5: Determine verification status based on author match
    const verificationStatus = authorInfo.hasAuthorMatch
      ? "verified"
      : "verified but not same author name";

    return createCrossrefResponse(verificationStatus, details, searchResults);
  } catch (err) {
    console.error("❌ [Crossref] Verification error:", err.message);
    return createCrossrefResponse("unable to verify", null, null);
  }
};

//=============================================================================
// HELPER FUNCTIONS FOR CROSSREF VERIFICATION
//=============================================================================

/**
 * Searches the Crossref database
 * @param {string} title - Publication title to search
 * @param {number} maxResults - Maximum results to retrieve
 * @returns {Promise<Object>} Search results object
 * @private
 */
const searchCrossref = async (title, maxResults) => {
  try {
    let crossrefApiUrl;

    crossrefApiUrl = `https://api.crossref.org/works?query.title=${encodeURIComponent(
      title
    )}&rows=${maxResults}&select=${encodeURIComponent(
      CROSSREF_SELECT_FIELDS
    )}&mailto=${CROSSREF_EMAIL}`;

    const { data: crossrefResult } = await axios.get(crossrefApiUrl);

    if (
      crossrefResult.message &&
      !Array.isArray(crossrefResult.message) &&
      !crossrefResult.message.items // Only wrap if there's no items array (direct DOI lookup)
    ) {
      return {
        message: {
          items: [crossrefResult.message],
        },
      };
    }

    return crossrefResult;
  } catch (err) {
    console.error("❌ [Crossref] Search error:", err.message);
    return { message: { items: [] } };
  }
};

/**
 * Finds a matching publication in Crossref search results
 * @param {Array} results - Search results from Crossref
 * @param {string} title - Publication title to match
 * @param {string} doi - DOI to match (optional)
 * @returns {Object|null} Matched publication or null if not found
 * @private
 */
const findMatchingPublication = (results, title, doi) => {
  return results.find((item) => {
    // DOI match takes highest precedence
    if (doi && item.DOI?.toLowerCase() === doi.toLowerCase()) {
      return true;
    }

    // Title-based matching
    if (
      title &&
      item.title &&
      Array.isArray(item.title) &&
      item.title.length > 0
    ) {
      const normalizedTitle = normalizeTitle(title);
      const normalizedItemTitle = normalizeTitle(item.title[0]);

      const similarity = getTitleSimilarity(
        normalizedTitle,
        normalizedItemTitle
      );

      // Check title length ratio to ensure reasonable match
      const titleLengthRatio =
        Math.min(normalizedTitle.length, normalizedItemTitle.length) /
        Math.max(normalizedTitle.length, normalizedItemTitle.length);

      // Only verify if the similarity is very high and titles have reasonable length
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
 * Extracts author information from a Crossref publication entry
 * @param {Object} publication - Publication object from Crossref
 * @param {string} candidateName - Candidate name to match against
 * @returns {Object} Author information object
 * @private
 */
const extractAuthorInformation = (publication, candidateName) => {
  const extractedAuthors = [];
  let hasAuthorMatch = false;
  let authorOrcid = null;

  // Extract authors from author array
  if (publication.author && Array.isArray(publication.author)) {
    publication.author.forEach((author) => {
      if (author.given && author.family) {
        const fullName = `${author.given} ${author.family}`;
        extractedAuthors.push(fullName);
      } else if (author.family) {
        extractedAuthors.push(author.family);
      }
    });

    // Remove duplicates
    const uniqueAuthors = [...new Set(extractedAuthors)];

    // Check if candidate name matches any extracted authors
    if (candidateName && uniqueAuthors.length > 0) {
      hasAuthorMatch = checkAuthorNameMatch(candidateName, uniqueAuthors);
    }

    // If there's a match, try to find the author ORCID
    if (hasAuthorMatch && publication.author) {
      for (const author of publication.author) {
        const fullName =
          author.given && author.family
            ? `${author.given} ${author.family}`
            : author.family || "";

        // Check if the author name matches the candidate
        if (checkAuthorNameMatch(candidateName, [fullName])) {
          authorOrcid = author.ORCID || null;
          break;
        }
      }
    }
  }

  return {
    extractedAuthors,
    hasAuthorMatch,
    authorOrcid,
  };
};

/**
 * Builds detailed publication information for the response
 * @param {Object} publication - Matched publication from Crossref
 * @param {Object} authorInfo - Extracted author information
 * @returns {Object} Detailed publication object
 * @private
 */
const buildPublicationDetails = (publication, authorInfo) => {
  return {
    doi: publication.DOI,
    title: Array.isArray(publication.title)
      ? publication.title[0]
      : publication.title,
    publisher: publication.publisher,
    journal:
      publication["container-title"] &&
      Array.isArray(publication["container-title"])
        ? publication["container-title"][0]
        : publication["container-title"],
    volume: publication.volume,
    issue: publication.issue,
    page: publication.page,
    published_date:
      publication.published && publication.published["date-parts"]
        ? publication.published["date-parts"][0]
        : null,
    publication_year:
      publication.published && publication.published["date-parts"]
        ? publication.published["date-parts"][0][0]
        : null,
    type: publication.type,
    extractedAuthors: authorInfo.extractedAuthors,
    hasAuthorMatch: authorInfo.hasAuthorMatch,
    authorOrcid: authorInfo.authorOrcid,
    citations_count: publication["is-referenced-by-count"] || 0,
    references_count: publication["references-count"] || 0,
    subject: publication.subject || [],
    url: publication.URL,
  };
};

/**
 * Creates a structured response for Crossref verification
 * @param {string} status - Verification status
 * @param {Object} details - Publication details
 * @param {Object} rawData - Raw data from Crossref
 * @returns {Object} Formatted verification response
 * @private
 */
const createCrossrefResponse = (status, details, rawData) => {
  return {
    source: "crossref",
    status,
    details,
    rawData: rawData,
  };
};

module.exports = {
  verifyWithCrossref,
};
