/**
 * Scopus Verification Module
 *
 * This module handles verification of academic publications through Scopus database.
 * Scopus is Elsevier's abstract and citation database covering scientific literature.
 *
 * Features:
 * - Search publications by title and DOI
 * - Extract comprehensive author information
 * - High-precision title matching with similarity scoring
 * - Author name verification against candidate profiles
 * - Detailed publication metadata extraction
 *
 * @module scopusVerification
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
const TITLE_SIMILARITY_THRESHOLD = 95;

/** Minimum title length ratio for valid matches */
const MIN_TITLE_LENGTH_RATIO = 0.8;

//=============================================================================
// PUBLICATION VERIFICATION
//=============================================================================

/**
 * Verifies a publication using Scopus database search
 *
 * @param {string} title - Publication title to search for
 * @param {string} doi - DOI of the publication (optional)
 * @param {string} candidateName - Name of the candidate to match against authors
 * @param {number} maxResultsToCheck - Maximum number of search results to examine
 * @returns {Promise<Object>} Verification result object with status and details
 */

const verifyWithScopus = async (
  title,
  doi,
  candidateName = null,
  maxResultsToCheck = 5
) => {
  try {
    // Step 1: Search Scopus database for the publication
    const searchResults = await searchScopusDatabase(title, maxResultsToCheck);

    if (!searchResults.entries.length) {
      return createScopusResponse("unable to verify", null, searchResults);
    }

    // Step 2: Find matching publication in search results
    const matchedPublication = findMatchingPublication(
      searchResults.entries,
      title,
      doi
    );

    if (!matchedPublication) {
      return createScopusResponse("unable to verify", null, searchResults);
    }

    // Step 3: Extract and process author information
    const authorInfo = extractAuthorInformation(
      matchedPublication,
      candidateName
    );

    // Step 4: Build detailed response with Scopus-specific data
    const details = buildPublicationDetails(matchedPublication, authorInfo);

    // Step 5: Determine verification status based on author match
    const verificationStatus = authorInfo.hasAuthorMatch
      ? "verified"
      : "verified but not same author name";

    return createScopusResponse(verificationStatus, details, searchResults);
  } catch (err) {
    return createScopusResponse("unable to verify", null, null);
  }
};

//=============================================================================
// HELPER FUNCTIONS FOR SCOPUS VERIFICATION
//=============================================================================

/**
 * Searches the Scopus database using the Elsevier API
 * @param {string} title - Publication title to search
 * @param {number} maxResults - Maximum results to retrieve
 * @returns {Promise<Object>} Search results object with entries and metadata
 * @private
 */
const searchScopusDatabase = async (title, maxResults) => {
  const scopusAPIKey = process.env.SCOPUS_API_KEY;
  const scopusInsttoken = process.env.SCOPUS_INSTTOKEN;
  const scopusQuery = title;

  const scopusApiUrl = `https://api.elsevier.com/content/search/scopus?apiKey=${scopusAPIKey}&insttoken=${scopusInsttoken}&query=TITLE-ABS-KEY(${encodeURIComponent(
    scopusQuery
  )})&page=1&sortBy=relevance&view=COMPLETE&count=${maxResults}`;

  const { data: scopusResult } = await axios.get(scopusApiUrl);
  const entries = scopusResult?.["search-results"]?.entry || [];

  return {
    entries,
    rawResult: scopusResult,
    apiUrl: scopusApiUrl,
  };
};

/**
 * Finds a matching publication in Scopus search results
 * @param {Array} entries - Search results from Scopus
 * @param {string} title - Publication title to match
 * @param {string} doi - DOI to match (optional)
 * @returns {Object|null} Matched publication or null if not found
 * @private
 */
const findMatchingPublication = (entries, title, doi) => {
  return entries.find((item) => {
    // DOI match takes highest precedence
    if (doi && item["prism:doi"]?.toLowerCase() === doi.toLowerCase()) {
      return true;
    }

    // Title-based matching
    if (title && item["dc:title"]) {
      const normalizedTitle = normalizeTitle(title);
      const normalizedItemTitle = normalizeTitle(item["dc:title"]);

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
 * Extracts author information from a Scopus publication entry
 * @param {Object} publication - Publication object from Scopus
 * @param {string} candidateName - Candidate name to match against
 * @returns {Object} Author information object
 * @private
 */
const extractAuthorInformation = (publication, candidateName) => {
  const extractedAuthors = [];
  let authorId = null;

  // Extract primary creator/author
  if (publication["dc:creator"]) {
    extractedAuthors.push(publication["dc:creator"]);
  }

  // Extract additional authors from the author list
  if (publication.author) {
    publication.author.forEach((author, index) => {
      // Add all available name formats to the extracted authors list
      if (author["authname"]) {
        extractedAuthors.push(author["authname"]);
      }

      if (author["surname"] && author["given-name"]) {
        const fullName = `${author["given-name"]} ${author["surname"]}`;
        const reversedName = `${author["surname"]}, ${author["given-name"]}`;

        extractedAuthors.push(fullName);
        extractedAuthors.push(reversedName);
      }

      if (author["surname"] && author["initials"]) {
        const initialsFirst = `${author["initials"]} ${author["surname"]}`;
        const surnameFirst = `${author["surname"]}, ${author["initials"]}`;
        const surnameSpace = `${author["surname"]} ${author["initials"]}`;

        extractedAuthors.push(initialsFirst);
        extractedAuthors.push(surnameFirst);
        extractedAuthors.push(surnameSpace);
      }
    });
  }

  // Check if candidate name matches any extracted authors
  const hasAuthorMatch =
    candidateName && extractedAuthors.length > 0
      ? checkAuthorNameMatch(candidateName, extractedAuthors)
      : false;

  // If there's a match, find the author ID from authid field
  if (hasAuthorMatch && publication.author) {
    for (const author of publication.author) {
      // Create a list of name formats for this author
      const authorNames = [];
      if (author["authname"]) authorNames.push(author["authname"]);

      if (author["surname"] && author["given-name"]) {
        authorNames.push(`${author["given-name"]} ${author["surname"]}`);
        authorNames.push(`${author["surname"]}, ${author["given-name"]}`);
      }

      if (author["surname"] && author["initials"]) {
        authorNames.push(`${author["initials"]} ${author["surname"]}`);
        authorNames.push(`${author["surname"]}, ${author["initials"]}`);
        authorNames.push(`${author["surname"]} ${author["initials"]}`);
      }

      // Check if any of the author's name formats match the candidate name
      if (checkAuthorNameMatch(candidateName, authorNames)) {
        if (author["authid"]) {
          authorId = author["authid"];
          break; // Stop once we find a match
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
 * @param {Object} publication - Matched publication from Scopus
 * @param {Object} authorInfo - Extracted author information
 * @returns {Object} Detailed publication object
 * @private
 */
const buildPublicationDetails = (publication, authorInfo) => {
  // Extract Scopus link from the links array
  const scopusLink = publication.link?.find(
    (link) => link["@ref"] === "scopus"
  )?.["@href"];
  return {
    ...publication,
    extractedAuthors: authorInfo.extractedAuthors,
    hasAuthorMatch: authorInfo.hasAuthorMatch,
    authorId: authorInfo.authorId, // Add this line to include Scopus author ID
    // Ensure the scopus link is properly set if available
    link: publication.link?.map((link) => ({
      ...link,
      "@href": link["@ref"] === "scopus" ? scopusLink : link["@href"],
    })),
  };
};

/**
 * Creates a standardized Scopus verification response object
 * @param {string} status - Verification status
 * @param {Object} details - Publication details
 * @param {Object} searchResults - Raw search results and metadata
 * @returns {Object} Formatted verification response
 * @private
 */
const createScopusResponse = (status, details, searchResults) => {
  return {
    status,
    details,
    result: searchResults?.rawResult || null,
    apiUrl: searchResults?.apiUrl || null,
  };
};

//=============================================================================
// MODULE EXPORTS
//=============================================================================

module.exports = {
  verifyWithScopus,
};
