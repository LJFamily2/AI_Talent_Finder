/**
 * Author Utilities Module
 *
 * This module provides utilities for academic author name matching and information retrieval.
 * It supports various academic name formats including:
 * - Full names: "Benjamin F. Goldfarb"
 * - Initials: "B.F. Goldfarb", "BD Goldstein"
 * - Surname-first: "Smith, J."
 * - Mixed formats between publications and CVs
 *
 * @module authorUtils
 * @author AI Talent Finder Team
 * @version 1.0.0
 */

const axios = require("axios");
const { getTitleSimilarity } = require("./textUtils");

//=============================================================================
// CONFIGURATION AND CACHE
//=============================================================================

/**
 * Cache for author details to avoid repeated API calls
 * @type {Map<string, Object>}
 */
const authorCache = new Map();

//=============================================================================
// NAME PARSING AND NORMALIZATION
//=============================================================================

/**
 * Normalizes a name by converting to lowercase and cleaning special characters
 * @param {string} name - The name to normalize
 * @returns {string} The normalized name
 * @private
 */
const normalizeName = (name) => {
  return name
    .toLowerCase()
    .replace(/[^\w\s\-\.,]/g, " ") // Keep commas for surname-first format parsing
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Extracts structured name parts from a full name string
 * Handles various academic name formats and conventions
 *
 * @param {string} name - The full name to parse
 * @returns {Object} Structured name object with parsed components
 * @private
 */
const extractNameParts = (name) => {
  // Check for surname-first format (e.g., "Smith, J.")
  let firstName = "",
    lastName = "",
    middleNames = [];

  const normalizedName = normalizeName(name);

  if (normalizedName.includes(",")) {
    // Handle "Lastname, Firstname" format
    const parts = normalizedName.split(",").map((part) => part.trim());
    lastName = parts[0];

    if (parts.length > 1 && parts[1]) {
      const firstParts = parts[1].split(" ").filter(Boolean);
      firstName = firstParts[0] || "";
      middleNames = firstParts.slice(1) || [];
    }
  } else {
    // Standard "Firstname [Middle] Lastname" format
    let parts = normalizedName.split(" ").filter(Boolean);

    // Special handling for initials with dots (e.g., "B.F. Goldfarb")
    if (parts.length >= 2 && parts[0].includes(".") && parts[0].length <= 4) {
      // This looks like initials - split them up
      const initialsStr = parts[0];
      const initialParts = initialsStr.split(".").filter(Boolean);

      if (initialParts.length > 1) {
        firstName = initialParts[0];
        middleNames = initialParts.slice(1);
        lastName = parts[parts.length - 1];
      } else {
        // Single initial with dot
        firstName = parts[0];
        lastName = parts[parts.length - 1];
        middleNames = parts.slice(1, -1);
      }
    } else {
      // Check for concatenated initials (e.g., "BD Goldstein" -> firstName: "B", middleNames: ["D"])
      // Only consider it concatenated initials if it's 2-4 letters AND all uppercase in original form
      const originalParts = name.split(" ").filter(Boolean);
      if (
        parts.length === 2 &&
        parts[0].length >= 2 &&
        parts[0].length <= 4 &&
        originalParts.length >= 1 &&
        /^[A-Z]+$/.test(originalParts[0])
      ) {
        // This looks like concatenated initials
        const initialsStr = parts[0];
        firstName = initialsStr.charAt(0);
        middleNames = initialsStr.slice(1).split("").filter(Boolean);
        lastName = parts[1];
      } else {
        // Standard format
        firstName = parts[0] || "";
        lastName = parts[parts.length - 1] || "";
        middleNames = parts.slice(1, -1);
      }
    }
  }

  // Get all initials
  const firstInitial = firstName.replace(/\./g, "").charAt(0);
  const middleInitials = middleNames.map((n) => n.replace(/\./g, "").charAt(0));

  // Get all initials as a string (e.g., "BFG" for "Benjamin F. Goldfarb")
  const allInitialsStr = firstInitial + middleInitials.join("");

  // Get full name without dots for comparison
  const fullNameNoDots = normalizedName.replace(/\./g, "");

  return {
    firstName: firstName.replace(/\./g, ""), // Remove dots for consistency
    lastName,
    middleNames: middleNames.map((n) => n.replace(/\./g, "")), // Remove dots for consistency
    firstInitial,
    middleInitials,
    allInitials: allInitialsStr,
    fullName: normalizedName,
    fullNameNoDots,
  };
};

//=============================================================================
// AUTHOR MATCHING LOGIC
//=============================================================================

/**
 * Comprehensive author name matching function for academic publications
 * Handles various academic name formats, abbreviations, and ordering
 *
 * @param {string} candidateName - The candidate's name to match
 * @param {string[]} authorList - Array of author names from publications
 * @returns {boolean} True if a match is found, false otherwise
 *
 * @example
 * // Returns true - full name matches initials
 * checkAuthorNameMatch("Benjamin F. Goldfarb", ["B.F. Goldfarb", "John Smith"]);
 *
 * @example
 * // Returns true - standard name matches surname-first format
 * checkAuthorNameMatch("John Smith", ["Smith, J.", "Other Author"]);
 *
 * @example
 * // Returns true - concatenated initials match full name
 * checkAuthorNameMatch("Benjamin D. Goldstein", ["BD Goldstein"]);
 *
 * @example
 * // Returns false - different middle initial
 * checkAuthorNameMatch("Benjamin C. Goldstein", ["BD Goldstein"]);
 */
const checkAuthorNameMatch = (candidateName, authorList) => {
  // Input validation
  if (!candidateName || !authorList || authorList.length === 0) {
    return false;
  }

  const candidate = extractNameParts(candidateName);

  // Check each author in the list
  for (const authorName of authorList) {
    if (!authorName || typeof authorName !== "string") continue;

    const author = extractNameParts(authorName);

    // Try different matching strategies in order of confidence
    if (
      tryExactMatch(candidate, author) ||
      tryLastNameAndInitialMatch(candidate, author) ||
      tryBothInitialsMatch(candidate, author) ||
      tryFullNameMatch(candidate, author)
    ) {
      return true;
    }
  }

  return false;
};

//=============================================================================
// MATCHING STRATEGIES
//=============================================================================

/**
 * Attempts exact name matching (with or without dots)
 * @param {Object} candidate - Parsed candidate name object
 * @param {Object} author - Parsed author name object
 * @returns {boolean} True if exact match found
 * @private
 */
const tryExactMatch = (candidate, author) => {
  return (
    candidate.fullName === author.fullName ||
    candidate.fullNameNoDots === author.fullNameNoDots
  );
};

/**
 * Attempts matching based on last name and first initial
 * Handles cases like "Benjamin F. Goldfarb" vs "B.F. Goldfarb"
 * @param {Object} candidate - Parsed candidate name object
 * @param {Object} author - Parsed author name object
 * @returns {boolean} True if match found
 * @private
 */
const tryLastNameAndInitialMatch = (candidate, author) => {
  // Last name must match in all cases
  if (candidate.lastName !== author.lastName) {
    return false;
  }

  // Check if first initials match
  if (candidate.firstInitial !== author.firstInitial) {
    return false;
  }

  // Case 1: Candidate has full name, author has initials
  if (candidate.firstName.length > 1 && author.firstName.length === 1) {
    return checkMiddleInitialsMatchFlexible(candidate, author);
  }

  // Case 2: Candidate has initials, author has full name
  if (candidate.firstName.length === 1 && author.firstName.length > 1) {
    return checkMiddleInitialsMatchFlexible(candidate, author);
  }

  // Case 3: Both have same length first names and first initials match
  if (candidate.firstInitial === author.firstInitial) {
    return checkMiddleInitialsMatchFlexible(candidate, author);
  }

  return false;
};

/**
 * Attempts matching when both names have initials
 * @param {Object} candidate - Parsed candidate name object
 * @param {Object} author - Parsed author name object
 * @returns {boolean} True if match found
 * @private
 */
const tryBothInitialsMatch = (candidate, author) => {
  if (
    candidate.firstName.length === 1 &&
    author.firstName.length === 1 &&
    candidate.firstInitial === author.firstInitial &&
    candidate.lastName === author.lastName
  ) {
    // Use flexible middle initial matching
    return checkMiddleInitialsMatchFlexible(candidate, author);
  }
  return false;
};

/**
 * Attempts matching when both names are full names
 * @param {Object} candidate - Parsed candidate name object
 * @param {Object} author - Parsed author name object
 * @returns {boolean} True if match found
 * @private
 */
const tryFullNameMatch = (candidate, author) => {
  if (
    candidate.firstName.length > 1 &&
    author.firstName.length > 1 &&
    candidate.firstName === author.firstName &&
    candidate.lastName === author.lastName
  ) {
    // If both have middle names/initials, they must match exactly
    if (candidate.middleNames.length > 0 && author.middleNames.length > 0) {
      return (
        candidate.middleNames.join(" ") === author.middleNames.join(" ") ||
        candidate.middleInitials.join("") === author.middleInitials.join("")
      );
    }

    // Use flexible matching for middle names - allows one to have middle names and other not
    return true;
  }
  return false;
};

/**
 * Checks if middle initials match between candidate and author
 * @param {Object} candidate - Parsed candidate name object
 * @param {Object} author - Parsed author name object
 * @returns {boolean} True if middle initials match or both have none
 * @private
 */
const checkMiddleInitialsMatch = (candidate, author) => {
  // If both have middle initials, they must match
  if (author.middleInitials.length > 0 && candidate.middleInitials.length > 0) {
    return (
      author.middleInitials.length === candidate.middleInitials.length &&
      author.middleInitials.every(
        (initial, index) => candidate.middleInitials[index] === initial
      )
    );
  }

  // If one has middle initials but the other doesn't, they don't match
  if (author.middleInitials.length !== candidate.middleInitials.length) {
    return false;
  }

  // Neither has middle initials - this is a match
  return true;
};

/**
 * Checks if middle initials match between candidate and author with flexible rules
 * Allows matches even when one has middle initials and the other doesn't
 * This enables "Sorelle A. Friedler" to match "S Friedler"
 * @param {Object} candidate - Parsed candidate name object
 * @param {Object} author - Parsed author name object
 * @returns {boolean} True if middle initials are compatible
 * @private
 */
const checkMiddleInitialsMatchFlexible = (candidate, author) => {
  // If both have middle initials, they must match exactly
  if (author.middleInitials.length > 0 && candidate.middleInitials.length > 0) {
    return (
      author.middleInitials.length === candidate.middleInitials.length &&
      author.middleInitials.every(
        (initial, index) => candidate.middleInitials[index] === initial
      )
    );
  }

  // If one has middle initials and the other doesn't, that's still a valid match
  // This handles cases like "Sorelle A. Friedler" vs "S Friedler"
  return true;
};

//=============================================================================
// AUTHOR INFORMATION RETRIEVAL
//=============================================================================

/**
 * Fetches detailed author information from Google Scholar
 * Uses cache to avoid repeated API calls for the same author
 *
 * @param {string} authorId - Google Scholar author ID
 * @param {string} serpApiKey - SerpAPI key for Google Scholar access
 * @param {string} searchTitle - Title to find in author's publications
 * @returns {Promise<Object|null>} Author details object or null if not found
 *
 * @example
 * const authorInfo = await getAuthorDetails("yLD8fzoAAAAJ", apiKey, "Sample Title");
 * if (authorInfo) {
 *   console.log(`Author: ${authorInfo.details.name}`);
 *   console.log(`Citations: ${authorInfo.details.citedBy}`);
 * }
 */
const getAuthorDetails = async (authorId, serpApiKey, searchTitle) => {
  // Check cache first to avoid unnecessary API calls
  if (authorCache.has(authorId)) {
    const cachedAuthor = authorCache.get(authorId);
    const matchingArticle = findMatchingArticle(
      cachedAuthor.articles,
      searchTitle
    );

    if (matchingArticle) {
      return buildAuthorResponse(cachedAuthor, matchingArticle);
    }
  }

  try {
    // Fetch author data from Google Scholar API
    const authorResult = await fetchAuthorFromAPI(authorId, serpApiKey);

    // Cache the result for future use
    cacheAuthorData(authorId, authorResult);

    // Find the matching article in the author's publications
    const matchingArticle = findMatchingArticle(
      authorResult.articles,
      searchTitle
    );

    if (matchingArticle) {
      return {
        year: matchingArticle.year,
        details: {
          author: authorResult.author,
          articles: authorResult.articles,
          citedBy: authorResult.cited_by,
        },
      };
    }
  } catch (error) {
    // Silently handle errors - return null for failed requests
  }

  return null;
};

//=============================================================================
// HELPER FUNCTIONS FOR AUTHOR DETAILS
//=============================================================================

/**
 * Finds a matching article in an author's publication list
 * @param {Array} articles - Array of articles to search
 * @param {string} title - Title to search for
 * @returns {Object|null} Matching article or null if not found
 * @private
 */
const findMatchingArticle = (articles, title) => {
  if (!articles || !title) return null;

  const normalizedSearchTitle = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "");

  return articles.find((article) => {
    if (!article.title) return false;

    const normalizedArticleTitle = article.title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, "");

    // Try exact match first
    if (normalizedArticleTitle === normalizedSearchTitle) return true;

    // Try fuzzy matching using getTitleSimilarity
    const similarity = getTitleSimilarity(
      normalizedArticleTitle,
      normalizedSearchTitle
    );
    if (similarity > 70) return true;

    // Try partial matching in either direction for longer titles
    if (
      normalizedArticleTitle.length > 20 &&
      normalizedSearchTitle.length > 20
    ) {
      if (
        normalizedArticleTitle.includes(normalizedSearchTitle) ||
        normalizedSearchTitle.includes(normalizedArticleTitle)
      ) {
        return true;
      }
    }

    return false;
  });
};

/**
 * Fetches author data from Google Scholar API
 * @param {string} authorId - Google Scholar author ID
 * @param {string} serpApiKey - SerpAPI key
 * @returns {Promise<Object>} Author data from API
 * @private
 */
const fetchAuthorFromAPI = async (authorId, serpApiKey) => {
  const authorApiUrl = `https://serpapi.com/search?engine=google_scholar_author&author_id=${authorId}&api_key=${serpApiKey}`;
  const { data: authorResult } = await axios.get(authorApiUrl);
  return authorResult;
};

/**
 * Caches author data for future use
 * @param {string} authorId - Google Scholar author ID
 * @param {Object} authorResult - Author data to cache
 * @private
 */
const cacheAuthorData = (authorId, authorResult) => {
  const authorData = {
    name: authorResult.author?.name,
    affiliations: authorResult.author?.affiliations,
    interests: authorResult.author?.interests,
    articles: authorResult.articles,
  };
  authorCache.set(authorId, authorData);
};

/**
 * Builds author response from cached data
 * @param {Object} cachedAuthor - Cached author data
 * @param {Object} matchingArticle - Matching article data
 * @returns {Object} Formatted author response
 * @private
 */
const buildAuthorResponse = (cachedAuthor, matchingArticle) => {
  return {
    year: matchingArticle.year,
    details: {
      name: cachedAuthor.name,
      affiliations: cachedAuthor.affiliations,
      interests: cachedAuthor.interests,
      citedBy: matchingArticle.cited_by,
    },
  };
};

//=============================================================================
// STRICT AUTHOR VERIFICATION (SECOND-LEVEL CHECK)
//=============================================================================

/**
 * Performs a strict verification of author names for the second-level check
 * Used after getting API results to ensure high confidence match
 * This is stricter than the initial checkAuthorNameMatch function
 *
 * @param {string} candidateName - The candidate's name to verify
 * @param {string} authorName - Author name from the API result
 * @returns {boolean} True if verified as same person, false otherwise
 *
 * @example
 * // This would return false (different first names)
 * strictAuthorNameVerification("BENJAMIN D. Goldstein", "Brian D. Goldstein");
 *
 * @example
 * // This would return true (same person, different formatting)
 * strictAuthorNameVerification("Benjamin D. Goldstein", "B. D. Goldstein");
 */
const strictAuthorNameVerification = (candidateName, authorName) => {
  if (!candidateName || !authorName) return false;

  // Parse both names
  const candidate = extractNameParts(candidateName);
  const author = extractNameParts(authorName);
  console.log(author)
  // Last name must match exactly
  if (candidate.lastName !== author.lastName) {
    console.log(
      `❌ Strict verification failed: different last names - "${candidateName}" vs "${authorName}"`
    );
    return false;
  }

  // First name checking is stricter - must match beyond just initial
  // If both have full first names (not just initials), they must match closely
  if (candidate.firstName.length > 1 && author.firstName.length > 1) {
    // Check for exact match first
    if (candidate.firstName === author.firstName) {
      // Continue to middle initial check
    } else {
      // Check if they're common nickname variations (future enhancement)
      // For now, reject different full first names
      console.log(
        `❌ Strict verification failed: different first names - "${candidateName}" vs "${authorName}"`
      );
      return false;
    }
  }

  // If one has full first name and other has initial, check if initial matches
  if (candidate.firstName.length > 1 && author.firstName.length === 1) {
    if (candidate.firstInitial !== author.firstInitial) {
      console.log(
        `❌ Strict verification failed: first initial mismatch - "${candidateName}" vs "${authorName}"`
      );
      return false;
    }
  } else if (candidate.firstName.length === 1 && author.firstName.length > 1) {
    if (candidate.firstInitial !== author.firstInitial) {
      console.log(
        `❌ Strict verification failed: first initial mismatch - "${candidateName}" vs "${authorName}"`
      );
      return false;
    }
  }

  // Middle initial check (if both have middle initials, they must match)
  if (candidate.middleInitials.length > 0 && author.middleInitials.length > 0) {
    // Check if all middle initials match in order
    const candidateMiddleStr = candidate.middleInitials.join("");
    const authorMiddleStr = author.middleInitials.join("");

    if (candidateMiddleStr !== authorMiddleStr) {
      console.log(
        `❌ Strict verification failed: different middle initials - "${candidateName}" vs "${authorName}"`
      );
      return false;
    }
  }

  console.log(
    `✅ Strict verification passed: "${candidateName}" matches "${authorName}"`
  );
  return true;
};

//=============================================================================
// MODULE EXPORTS
//=============================================================================

module.exports = {
  authorCache,
  checkAuthorNameMatch,
  strictAuthorNameVerification,
  getAuthorDetails,
};
