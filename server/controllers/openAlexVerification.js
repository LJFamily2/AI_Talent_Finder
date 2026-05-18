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
const { getTitleSimilarity, normalizeTitle } = require("../utils/textUtils");
const { checkAuthorNameMatch } = require("../utils/authorUtils");

const DEBUG_VERIFY = false;

const debugLog = () => {};

//=============================================================================
// CONFIGURATION AND CONSTANTS
//=============================================================================

/** Minimum similarity threshold for title matching */
const TITLE_SIMILARITY_THRESHOLD = 95;

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
  maxResultsToCheck = 3,
) => {
  try {
    // Step 1: Search OpenAlex for the publication
    const searchResults = await searchOpenAlex(title, maxResultsToCheck);

    if (!searchResults.results || searchResults.results.length === 0) {
      debugLog("no_results", { title, doi });
      return createOpenAlexResponse("unable to verify", null, searchResults);
    }

    // Step 2: Find matching publication in search results
    const matchedPublication = findMatchingPublication(
      searchResults.results,
      title,
      doi,
    );

    if (!matchedPublication) {
      debugLog("no_match", {
        title,
        doi,
        results: searchResults.results.length,
      });
      return createOpenAlexResponse("unable to verify", null, searchResults);
    }

    // Step 3: Extract and process author information
    const authorInfo = extractAuthorInformation(
      matchedPublication,
      candidateName,
    );

    // Step 4: Build detailed response with OpenAlex-specific data
    const details = buildPublicationDetails(matchedPublication, authorInfo);

    // Step 5: Determine verification status based on author match
    const verificationStatus = authorInfo.hasAuthorMatch
      ? "verified"
      : "verified but not same author name";

    debugLog("match", {
      title,
      doi,
      verificationStatus,
      authorMatch: authorInfo.hasAuthorMatch,
      authorId: authorInfo.authorId,
    });

    return createOpenAlexResponse(verificationStatus, details, searchResults);
  } catch (err) {
    console.error("❌ [OpenAlex] Verification error:", err.message);
    return createOpenAlexResponse("unable to verify", null, null);
  }
};

/**
 * Verifies a batch of publications using OpenAlex search
 *
 * @param {Array<string>} titles - List of publication titles to search for
 * @param {string} candidateName - Name of the candidate to match against authors
 * @returns {Promise<Object>} Map of titles to verification results
 */
const verifyWithOpenAlexBatch = async (titles, candidateName) => {
  if (!titles || titles.length === 0) return {};

  try {
    // Clean titles and remove empty ones
    const validTitles = titles.filter((t) => t && t.trim().length > 0);
    if (validTitles.length === 0) return {};

    // Construct the filter query
    // We use quotes for each title to ensure phrase matching and separate with |
    const titleQuery = validTitles
      .map((t) => `"${sanitizeTitleForSearch(t)}"`)
      .join("|");

    const apiKey = process.env.OPENALEX_API_KEY;
    // Use a higher per-page limit to ensure we get matches for all titles
    // Max per-page is usually 200 for OpenAlex
    // We increase this to 200 to handle cases where multiple titles have many matches
    const perPage = Math.min(validTitles.length * 5, 200);

    let openAlexApiUrl = `https://api.openalex.org/works?per-page=${perPage}&select=id,doi,title,display_name,publication_year,type,type_crossref,authorships,topics,cited_by_count&filter=title.search:${encodeURIComponent(
      titleQuery,
    )}`;

    if (apiKey) {
      openAlexApiUrl += `&api_key=${apiKey}`;
    }

    const { data: openAlexResult } = await axios.get(openAlexApiUrl, {
      timeout: 20000, // Increased timeout for batch
    });

    const results = openAlexResult.results || [];
    const verificationMap = {};

    // Process each input title
    for (const title of validTitles) {
      const matchedPublication = findMatchingPublication(results, title);

      if (matchedPublication) {
        const authorInfo = extractAuthorInformation(
          matchedPublication,
          candidateName,
        );
        const details = buildPublicationDetails(matchedPublication, authorInfo);
        const verificationStatus = authorInfo.hasAuthorMatch
          ? "verified"
          : "verified but not same author name";

        verificationMap[title] = createOpenAlexResponse(
          verificationStatus,
          details,
          { results: [matchedPublication] },
        );
        debugLog("batch_match", {
          title,
          verificationStatus,
          authorMatch: authorInfo.hasAuthorMatch,
        });
      } else {
        verificationMap[title] = createOpenAlexResponse(
          "unable to verify",
          null,
          null,
        );
        debugLog("batch_no_match", { title });
      }
    }

    return verificationMap;
  } catch (err) {
    console.error("❌ [OpenAlex] Batch verification error:", err.message);
    return {};
  }
};

//=============================================================================
// HELPER FUNCTIONS FOR OPENALEX VERIFICATION
//=============================================================================

/**
 * Sanitizes a title for OpenAlex search query
 * @param {string} title - Title to sanitize
 * @returns {string} Sanitized title
 * @private
 */
const sanitizeTitleForSearch = (title) => {
  if (!title) return "";
  // Truncate title to first 15 words to avoid URL length issues and 400 errors
  // while maintaining enough specificity for search
  const words = title
    .replace(/['′´`‘’]/g, "'") // Normalize quotes
    .replace(/[""″“”]/g, "") // Remove double quotes
    .replace(/[|:()\[\],]/g, " ") // Remove special chars including comma
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");

  return words.slice(0, 15).join(" ");
};

/**
 * Searches the OpenAlex database
 * @param {string} title - Publication title to search
 * @param {number} maxResults - Maximum results to retrieve
 * @returns {Promise<Object>} Search results object
 * @private
 */
const searchOpenAlex = async (title, maxResults) => {
  try {
    // Add api_key parameter using the OPENALEX_API_KEY from environment variables
    const apiKey = process.env.OPENALEX_API_KEY;

    // Sanitize title for search and wrap in quotes for phrase search
    const sanitizedTitle = sanitizeTitleForSearch(title);
    const query = `"${sanitizedTitle}"`;

    const openAlexApiUrl = `https://api.openalex.org/works?per-page=${maxResults}&select=id,doi,title,display_name,publication_year,type,type_crossref,authorships,topics,cited_by_count&filter=title.search:${encodeURIComponent(
      query,
    )}&api_key=${apiKey}`;

    const { data: openAlexResult } = await axios.get(openAlexApiUrl, {
      timeout: 2000,
    });
    return openAlexResult;
  } catch (err) {
    console.error("❌ [OpenAlex] Search error:", err.message);
    return { results: [] };
  }
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
  let best = { similarity: 0, ratio: 0, title: null };
  let matched = null;
  for (const item of results) {
    // DOI match takes highest precedence
    if (doi && item.doi?.toLowerCase() === doi.toLowerCase()) {
      matched = item;
      break;
    }

    // Title-based matching
    if (title && (item.title || item.display_name)) {
      const normalizedTitle = normalizeTitle(title);
      const normalizedItemTitle = normalizeTitle(
        item.title || item.display_name,
      );

      const similarity = getTitleSimilarity(
        normalizedTitle,
        normalizedItemTitle,
      );

      // Check title length ratio to ensure reasonable match
      const titleLengthRatio =
        Math.min(normalizedTitle.length, normalizedItemTitle.length) /
        Math.max(normalizedTitle.length, normalizedItemTitle.length);

      if (similarity > best.similarity) {
        best = {
          similarity,
          ratio: titleLengthRatio,
          title: item.title || item.display_name,
        };
      }

      // Only verify if the similarity is very high and titles have reasonable length
      if (
        similarity >= TITLE_SIMILARITY_THRESHOLD &&
        titleLengthRatio >= MIN_TITLE_LENGTH_RATIO
      ) {
        matched = item;
        break;
      }
    }
  }

  if (!matched && DEBUG_VERIFY) {
    debugLog("best_candidate", {
      title,
      bestTitle: best.title,
      bestSimilarity: best.similarity,
      bestRatio: best.ratio,
    });
  }

  return matched;
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

    // Check if candidate name matches any extracted authors
    if (candidateName && uniqueAuthors.length > 0) {
      hasAuthorMatch = checkAuthorNameMatch(candidateName, uniqueAuthors);
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
          break;
        }
      }
    }
  }

  debugLog("authors_extracted", {
    title: publication.title || publication.display_name,
    candidateName,
    authors: extractedAuthors,
    hasAuthorMatch,
    authorId,
  });

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
    cited_by_count: publication.cited_by_count,
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
  verifyWithOpenAlexBatch,
};
