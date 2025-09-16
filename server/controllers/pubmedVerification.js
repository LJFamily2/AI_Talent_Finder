/**
 * PubMed Verification Module
 *
 * This module handles verification of academic publications through PubMed API.
 * PubMed is a free search engine accessing primarily the MEDLINE database of references
 * and abstracts on life sciences and biomedical topics.
 *
 * Features:
 * - Search publications by title using NCBI E-utilities API
 * - Extract comprehensive publication information
 * - High-precision title matching with similarity scoring
 * - Author name verification against candidate profiles
 * - Detailed publication metadata extraction
 *
 * @module pubmedVerification
 * @author AI Talent Finder Team
 * @version 1.0.0
 */

const axios = require("axios");
const { getTitleSimilarity, normalizeTitle } = require("../utils/textUtils");
const { checkAuthorNameMatch } = require("../utils/authorUtils");
const xml2js = require("xml2js");

module.exports = {
  verifyWithPubMed,
};

//=============================================================================
// CONFIGURATION AND CONSTANTS
//=============================================================================

/** Minimum similarity threshold for title matching */
const TITLE_SIMILARITY_THRESHOLD = 80;

/** Minimum title length ratio for valid matches */
const MIN_TITLE_LENGTH_RATIO = 0.8;

/** PubMed E-utilities base URLs */
const PUBMED_SEARCH_URL =
  "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const PUBMED_SUMMARY_URL =
  "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";
//=============================================================================
// PUBLICATION VERIFICATION
//=============================================================================

/**
 * Verifies a publication using PubMed database search
 *
 * @param {string} title - Publication title to search for
 * @param {string} doi - DOI of the publication (optional)
 * @param {string} candidateName - Name of the candidate to match against authors
 * @param {number} maxResultsToCheck - Maximum number of search results to examine
 * @returns {Promise<Object>} Verification result object with status and details
 *
 * @example
 * const result = await verifyWithPubMed(
 *   "A Pure Estrogen Antagonist Inhibits Cyclin E-Cdk2 Activity",
 *   "10.1074/jbc.M004424200",
 *   "Dr. Jane Smith",
 *   5
 * );
 */
async function verifyWithPubMed(
  title,
  doi,
  candidateName = null,
  maxResultsToCheck = 3
) {
  try {
    // Step 1: Search PubMed for the publication
    const searchResults = await searchPubMed(title, maxResultsToCheck);

    if (!searchResults.idList || searchResults.idList.length === 0) {
      return createPubMedResponse("unable to verify", null, searchResults);
    }

    // Step 2: Get publication details for each ID
    const publicationDetails = await getPublicationDetails(
      searchResults.idList
    );

    if (!publicationDetails || publicationDetails.length === 0) {
      return createPubMedResponse("unable to verify", null, searchResults);
    }

    // Step 3: Find matching publication in results
    const matchedPublication = findMatchingPublication(
      publicationDetails,
      title,
      doi
    );

    if (!matchedPublication) {
      return createPubMedResponse("unable to verify", null, searchResults);
    }

    // Step 4: Extract and process author information
    const authorInfo = extractAuthorInformation(
      matchedPublication,
      candidateName
    );

    // Step 5: Build detailed response with PubMed-specific data
    const details = buildPublicationDetails(matchedPublication, authorInfo);

    // Step 6: Determine verification status based on author match
    const verificationStatus = authorInfo.hasAuthorMatch
      ? "verified"
      : "verified but not same author name";

    return createPubMedResponse(verificationStatus, details, searchResults);
  } catch (err) {
    console.error("❌ [PubMed] Verification error:", err.message);
    return createPubMedResponse("unable to verify", null, null);
  }
}

//=============================================================================
// HELPER FUNCTIONS FOR PUBMED VERIFICATION
//=============================================================================

/**
 * Builds a proximity search query for PubMed
 * @param {string} title - Publication title
 * @returns {string} Proximity search query
 * @private
 */
const buildProximityQuery = (title) => {
  // Use the enhanced normalizeTitle function from textUtils
  let normalizedTitle = normalizeTitle(title);

  return `${normalizedTitle}[Title:~10]`;
};

/**
 * Searches the PubMed database using E-utilities API
 * @param {string} title - Publication title to search
 * @param {number} maxResults - Maximum results to retrieve
 * @returns {Promise<Object>} Search results object with publication IDs
 * @private
 */
const searchPubMed = async (title, maxResults) => {
  try {
    const apiKey = process.env.PUBMED_API_KEY;

    // Use proximity search only
    const proximityQuery = buildProximityQuery(title);
    let searchUrl = `${PUBMED_SEARCH_URL}?term=${encodeURIComponent(
      proximityQuery
    )}&retmax=${maxResults}`;
    
    if (apiKey) {
      searchUrl += `&api_key=${apiKey}`;
    }

    const xmlResponse = await axios.get(searchUrl, { timeout: 1500 });

    // Parse XML response
    const parser = new xml2js.Parser();
    const parsedResult = await parser.parseStringPromise(xmlResponse.data);
    const eSearchResult = parsedResult.eSearchResult;

    if (!eSearchResult || !eSearchResult.IdList || !eSearchResult.IdList[0]) {
      return { idList: [], count: 0 };
    }

    const idList = eSearchResult.IdList[0].Id || [];
    const count = parseInt(eSearchResult.Count[0]) || 0;

    return {
      idList: idList,
      count: count,
      retMax: parseInt(eSearchResult.RetMax[0]) || 0,
      retStart: parseInt(eSearchResult.RetStart[0]) || 0,
    };
  } catch (err) {
    console.error("❌ [PubMed] Search error:", err.message);
    return { idList: [], count: 0 };
  }
};

/**
 * Gets detailed publication information from PubMed IDs
 * @param {Array} idList - Array of PubMed IDs
 * @returns {Promise<Array>} Array of publication details
 * @private
 */
const getPublicationDetails = async (idList) => {
  try {
    if (!idList || idList.length === 0) {
      return [];
    }

    const apiKey = process.env.PUBMED_API_KEY;

    const ids = idList.join(",");
    let summaryUrl = `${PUBMED_SUMMARY_URL}?id=${ids}&db=pubmed`;
    if (apiKey) {
      summaryUrl += `&api_key=${apiKey}`;
    }
    const { data: xmlResponse } = await axios.get(summaryUrl);

    // Parse XML response
    const parser = new xml2js.Parser();
    const parsedResult = await parser.parseStringPromise(xmlResponse);

    const eSummaryResult = parsedResult.eSummaryResult;

    if (!eSummaryResult || !eSummaryResult.DocSum) {
      return [];
    }

    // Handle both single and multiple DocSum entries
    const docSums = Array.isArray(eSummaryResult.DocSum)
      ? eSummaryResult.DocSum
      : [eSummaryResult.DocSum];

    return docSums.map((docSum) => parseDocSum(docSum));
  } catch (err) {
    return [];
  }
};

/**
 * Parses a DocSum entry from PubMed eSummary response
 * @param {Object} docSum - DocSum object from XML response
 * @returns {Object} Parsed publication details
 * @private
 */
const parseDocSum = (docSum) => {
  const publication = {
    id: docSum.Id ? docSum.Id[0] : null,
    title: null,
    authors: [],
    source: null,
    pubDate: null,
    doi: null,
    volume: null,
    issue: null,
    pages: null,
    pmid: null,
    pubTypes: [],
  };

  if (docSum.Item && Array.isArray(docSum.Item)) {
    docSum.Item.forEach((item) => {
      const name = item.$.Name;
      const type = item.$.Type;
      const content = item._;

      switch (name) {
        case "Title":
          publication.title = content;
          break;
        case "AuthorList":
          if (item.Item && Array.isArray(item.Item)) {
            publication.authors = item.Item.map((author) => author._).filter(
              Boolean
            );
          }
          break;
        case "Source":
          publication.source = content;
          break;
        case "PubDate":
          publication.pubDate = content;
          break;
        case "DOI":
          publication.doi = content;
          break;
        case "Volume":
          publication.volume = content;
          break;
        case "Issue":
          publication.issue = content;
          break;
        case "Pages":
          publication.pages = content;
          break;
        case "PubTypeList":
          if (item.Item && Array.isArray(item.Item)) {
            publication.pubTypes =
              item.Item[0] && item.Item[0]._ ? [item.Item[0]._] : [];
          }
          break;
      }
    });
  }

  // Set PMID
  publication.pmid = publication.id;

  return publication;
};

/**
 * Finds a matching publication in PubMed search results
 * @param {Array} results - Publication details from PubMed
 * @param {string} title - Publication title to match
 * @param {string} doi - DOI to match (optional)
 * @returns {Object|null} Matched publication or null if not found
 * @private
 */
const findMatchingPublication = (results, title, doi) => {
  return results.find((item) => {
    // DOI match takes highest precedence
    if (doi && item.doi && item.doi.toLowerCase() === doi.toLowerCase()) {
      return true;
    }

    // Title-based matching
    if (title && item.title) {
      const normalizedTitle = normalizeTitle(title);
      const normalizedItemTitle = normalizeTitle(item.title);

      const similarity = getTitleSimilarity(
        normalizedTitle,
        normalizedItemTitle
      );

      const lengthRatio =
        Math.min(normalizedTitle.length, normalizedItemTitle.length) /
        Math.max(normalizedTitle.length, normalizedItemTitle.length);

      return (
        similarity >= TITLE_SIMILARITY_THRESHOLD &&
        lengthRatio >= MIN_TITLE_LENGTH_RATIO
      );
    }

    return false;
  });
};

/**
 * Extracts author information and checks for name matches
 * @param {Object} publication - Publication object from PubMed
 * @param {string} candidateName - Name to match against authors
 * @returns {Object} Author information with match status
 * @private
 */
const extractAuthorInformation = (publication, candidateName) => {
  const extractedAuthors = publication.authors || [];

  let hasAuthorMatch = false;
  let authorId = null;

  if (candidateName && extractedAuthors.length > 0) {
    hasAuthorMatch = checkAuthorNameMatch(candidateName, extractedAuthors);
  }

  return {
    extractedAuthors,
    hasAuthorMatch,
    authorId, // PubMed doesn't provide author IDs in the summary API
  };
};

/**
 * Builds detailed publication information for the response
 * @param {Object} publication - Matched publication from PubMed
 * @param {Object} authorInfo - Extracted author information
 * @returns {Object} Detailed publication object
 * @private
 */
const buildPublicationDetails = (publication, authorInfo) => {
  return {
    pmid: publication.pmid,
    title: publication.title,
    doi: publication.doi,
    authors: publication.authors,
    source: publication.source,
    pubDate: publication.pubDate,
    volume: publication.volume,
    issue: publication.issue,
    pages: publication.pages,
    pubTypes: publication.pubTypes,
    extractedAuthors: authorInfo.extractedAuthors,
    hasAuthorMatch: authorInfo.hasAuthorMatch,
    authorId: authorInfo.authorId,
    link: publication.doi
      ? `https://doi.org/${publication.doi}`
      : `https://pubmed.ncbi.nlm.nih.gov/${publication.pmid}/`,
  };
};

/**
 * Creates a structured response for PubMed verification
 * @param {string} status - Verification status
 * @param {Object} details - Publication details
 * @param {Object} rawData - Raw data from PubMed
 * @returns {Object} Formatted verification response
 * @private
 */
const createPubMedResponse = (status, details, rawData) => {
  return {
    source: "pubmed",
    status,
    details,
    rawData: rawData,
  };
};
