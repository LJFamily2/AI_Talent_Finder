/**
 * Author Details Aggregator Module
 *
 * This module aggregates author details from multiple academic sources
 * (Google Scholar, Scopus, OpenAlex) into a comprehensive author profile.
 * The article metadata is enriched with publication metrics AND HAD BEEN COMMENTED OUT
 *
 * @module authorDetailsAggregator
 * @author AI Talent Finder Team
 * @version 1.0.0
 */

const axios = require("axios");
const { strictAuthorNameVerification } = require("./authorUtils");
require("dotenv").config();

//=============================================================================
// CONFIGURATION AND CONSTANTS
//=============================================================================

const googleScholarApiKey = process.env.GOOGLE_SCHOLAR_API_KEY;
const scopusApiKey = process.env.SCOPUS_API_KEY;
const scopusInsttoken = process.env.SCOPUS_INSTTOKEN;
const openAlexApiKey = process.env.OPENALEX_API_KEY;

/**
 * Default priority order for academic sources
 * Can be easily modified to accommodate new sources
 */
const DEFAULT_PRIORITY_ORDER = ["scopus", "openalex", "googleScholar"];

//=============================================================================
// FLEXIBLE PRIORITY HELPER FUNCTIONS
//=============================================================================

/**
 * Gets the next best available source based on priority order
 * @param {Object} verifiedSources - Object containing verified source flags
 * @param {string} prioritySource - Current priority source that failed
 * @param {Array} customPriorityOrder - Optional custom priority order
 * @returns {string|null} Next best source or null if none available
 */
const getNextBestSource = (
  verifiedSources,
  prioritySource,
  customPriorityOrder = null
) => {
  const priorityOrder = customPriorityOrder || DEFAULT_PRIORITY_ORDER;

  // Remove the failed priority source from consideration
  const availableOrder = priorityOrder.filter(
    (source) => source !== prioritySource
  );

  // Find the first available source in priority order
  for (const source of availableOrder) {
    if (verifiedSources[source]) {
      return source;
    }
  }

  // Fallback: use any remaining verified source not in the priority list
  const remainingSources = Object.keys(verifiedSources).filter(
    (source) => !priorityOrder.includes(source)
  );

  return remainingSources.length > 0 ? remainingSources[0] : null;
};

//=============================================================================
// MAIN AGGREGATION FUNCTION
//=============================================================================

/**
 * Aggregates author details from multiple sources with priority selection
 * @param {Object} authorIds - Object with author IDs from different sources
 * @param {string} candidateName - Candidate name for reference
 * @param {string} prioritySource - Primary source to use for metrics ('googleScholar', 'scopus', or 'openalex')
 * @returns {Promise<Object>} - Comprehensive author details with metrics from priority source
 */
const aggregateAuthorDetails = async (
  authorIds,
  candidateName,
  prioritySource
) => {
  const authorDetails = {
    author: {
      name: null,
      surname: null,
      givenName: null,
      affiliationHistory: [],
    },
    // articles: [],
    h_index: null,
    documentCount: null,
    i10_index: null,
    citationCount: null,
    graph: [],
    expertise: [],
  };

  // Track which sources were successfully verified
  const verifiedSources = {};

  // Collect data from Scopus
  if (authorIds.scopus) {
    try {
      const scopusAuthorData = await fetchScopusAuthor(authorIds.scopus);

      // Verify author name match before merging data
      if (scopusAuthorData && scopusAuthorData["author-retrieval-response"]) {
        const authorProfile = scopusAuthorData["author-retrieval-response"][0];
        if (
          authorProfile &&
          authorProfile["author-profile"] &&
          authorProfile["author-profile"]["preferred-name"]
        ) {
          const preferredName =
            authorProfile["author-profile"]["preferred-name"];
          const authorName = `${preferredName["given-name"]} ${preferredName.surname}`;

          // Use strict verification to ensure names match
          if (strictAuthorNameVerification(candidateName, authorName)) {
            mergeScopusData(authorDetails, scopusAuthorData, prioritySource);
            verifiedSources.scopus = true;
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch Scopus details: ${error.message}`);
    }
  }

  // Collect data from OpenAlex
  if (authorIds.openalex) {
    try {
      const openAlexAuthorData = await fetchOpenAlexAuthor(authorIds.openalex);

      // Verify author name match before merging data
      if (openAlexAuthorData && openAlexAuthorData.display_name) {
        const authorName = openAlexAuthorData.display_name;

        // Use strict verification to ensure names match
        if (strictAuthorNameVerification(candidateName, authorName)) {
          mergeOpenAlexData(authorDetails, openAlexAuthorData, prioritySource);
          verifiedSources.openalex = true;
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch OpenAlex details: ${error.message}`);
    }
  }

  // Collect data from Google Scholar
  if (authorIds.google_scholar) {
    try {
      const googleScholarData = await fetchGoogleScholarAuthor(
        authorIds.google_scholar
      );

      // Verify author name match before merging data
      if (googleScholarData && googleScholarData.author) {
        const authorName = googleScholarData.author.name;

        // Use strict verification to ensure names match
        if (strictAuthorNameVerification(candidateName, authorName)) {
          mergeGoogleScholarData(
            authorDetails,
            googleScholarData,
            prioritySource
          );
          verifiedSources.googleScholar = true;
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch Google Scholar details: ${error.message}`);
    }
  }

  // If no sources were verified at all, return null
  if (Object.keys(verifiedSources).length === 0) {
    return null;
  } // Check if the priority source was verified - if not, use alternative source
  if (prioritySource && !verifiedSources[prioritySource]) {
    const alternativeSource = getNextBestSource(
      verifiedSources,
      prioritySource
    );

    if (alternativeSource) {
      prioritySource = alternativeSource;
    } else {
      return null;
    }
  }

  return authorDetails;
};

//=============================================================================
// DATA FETCHING FUNCTIONS
//=============================================================================

/**
 * Fetches author data from Google Scholar
 * @param {string} authorId - Google Scholar author ID
 * @returns {Promise<Object>} Author data
 * @private
 */
const fetchGoogleScholarAuthor = async (authorId) => {
  const url = `https://serpapi.com/search?engine=google_scholar_author&author_id=${authorId}&api_key=${googleScholarApiKey}`;

  try {
    const { data } = await axios.get(url);
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Fetches author data from Scopus
 * @param {string} authorId - Scopus author ID
 * @returns {Promise<Object>} Author data
 * @private
 */
const fetchScopusAuthor = async (authorId) => {
  const url = `https://api.elsevier.com/content/author?author_id=${authorId}&view=ENHANCED`;

  try {
    const { data } = await axios.get(url, {
      headers: {
        "X-ELS-APIKey": scopusApiKey,
        "X-ELS-Insttoken": scopusInsttoken,
        Accept: "application/json",
      },
    });
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Merges Google Scholar data into author details object
 * @param {Object} authorDetails - Target author details object
 * @param {Object} googleScholarData - Google Scholar author data
 * @param {string} prioritySource - Primary source to use for metrics
 * @private
 */
const mergeGoogleScholarData = (
  authorDetails,
  googleScholarData,
  prioritySource
) => {
  const isPreferredSource = prioritySource === "googleScholar";
  // Basic author info
  if (googleScholarData.author) {
    authorDetails.author.name = googleScholarData.author.name;

    // Add expertise from Google Scholar interests
    if (
      googleScholarData.author.interests &&
      Array.isArray(googleScholarData.author.interests)
    ) {
      googleScholarData.author.interests.forEach((interest) => {
        if (
          interest.title &&
          !authorDetails.expertise.includes(interest.title)
        ) {
          authorDetails.expertise.push(interest.title);
        }
      });
    }

    // Add affiliations
    if (googleScholarData.author.affiliations) {
      const affiliation = {
        name: googleScholarData.author.affiliations,
        country: null, // Google Scholar doesn't provide country
      };
      authorDetails.author.affiliationHistory.push(affiliation);
    }
  }
  // Citation metrics - directly apply based on priority
  if (googleScholarData.cited_by) {
    if (googleScholarData.cited_by.table) {
      // Total citation count
      const citationsItem = googleScholarData.cited_by.table.find(
        (item) => item.citations
      );
      if (
        citationsItem &&
        citationsItem.citations &&
        citationsItem.citations.all
      ) {
        if (isPreferredSource || authorDetails.citationCount === null) {
          authorDetails.citationCount = citationsItem.citations.all;
        }
      }

      // H-index
      const hIndex = googleScholarData.cited_by.table.find(
        (item) => item.h_index
      );
      if (hIndex && hIndex.h_index && hIndex.h_index.all) {
        if (isPreferredSource || authorDetails.h_index === null) {
          authorDetails.h_index = hIndex.h_index.all;
        }
      }

      // i10-index
      const i10Index = googleScholarData.cited_by.table.find(
        (item) => item.i10_index
      );
      if (i10Index && i10Index.i10_index && i10Index.i10_index.all) {
        if (isPreferredSource || authorDetails.i10_index === null) {
          authorDetails.i10_index = i10Index.i10_index.all;
        }
      }
    } // Citation graph
    if (googleScholarData.cited_by && googleScholarData.cited_by.graph) {
      if (isPreferredSource || authorDetails.graph.length === 0) {
        // Count publications per year
        const yearWorkCounts = {};

        if (
          googleScholarData.articles &&
          googleScholarData.articles.length > 0
        ) {
          googleScholarData.articles.forEach((article) => {
            if (article.year) {
              yearWorkCounts[article.year] =
                (yearWorkCounts[article.year] || 0) + 1;
            }
          });
        } // Convert to an array matching our expected format
        authorDetails.graph = googleScholarData.cited_by.graph
          .map((item) => ({
            year: item.year,
            works_count: yearWorkCounts[item.year] || 0,
            cited_by_count: item.citations || 0,
          }))
          .sort((a, b) => b.year - a.year); // Sort by year descending
      }
    }
  }
};

/**
 * Merges Scopus data into author details object
 * @param {Object} authorDetails - Target author details object
 * @param {Object} scopusAuthorData - Scopus author data
 * @param {string} prioritySource - Primary source to use for metrics
 * @private
 */
const mergeScopusData = (authorDetails, scopusAuthorData, prioritySource) => {
  const isPreferredSource = prioritySource === "scopus";
  // Parse XML or JSON response based on format
  const authorProfile = scopusAuthorData["author-retrieval-response"][0];

  // Add expertise from Scopus subject areas
  if (
    authorProfile &&
    authorProfile["subject-areas"] &&
    authorProfile["subject-areas"]["subject-area"] &&
    Array.isArray(authorProfile["subject-areas"]["subject-area"])
  ) {
    authorProfile["subject-areas"]["subject-area"].forEach((area) => {
      const expertiseText = area["#text"] || area._;
      if (expertiseText && !authorDetails.expertise.includes(expertiseText)) {
        authorDetails.expertise.push(expertiseText);
      }
    });
  }

  // Basic author info
  if (authorProfile && authorProfile["author-profile"]) {
    const preferredName = authorProfile["author-profile"]["preferred-name"];
    if (preferredName) {
      authorDetails.author.surname = preferredName.surname || null;
      authorDetails.author.givenName = preferredName["given-name"] || null;
    }

    // Add affiliations from current and history
    const currentAffiliation = authorProfile["affiliation-current"];
    if (currentAffiliation) {
      parseAndAddScopusAffiliation(authorDetails, currentAffiliation);
    }

    const affiliationHistory =
      authorProfile["author-profile"]["affiliation-history"];
    if (affiliationHistory && affiliationHistory.affiliation) {
      parseAndAddScopusAffiliation(
        authorDetails,
        affiliationHistory.affiliation
      );
    }
  }
  // Citation count - directly apply based on priority
  if (
    authorProfile &&
    authorProfile.coredata &&
    authorProfile.coredata["citation-count"]
  ) {
    const citationCount = parseInt(
      authorProfile.coredata["citation-count"],
      10
    );
    if (isPreferredSource || authorDetails.citationCount === null) {
      authorDetails.citationCount = citationCount;
    }
  }

  // H-index - directly apply based on priority
  if (authorProfile && authorProfile["h-index"]) {
    const h_index = parseInt(authorProfile["h-index"], 10);
    if (isPreferredSource || authorDetails.h_index === null) {
      authorDetails.h_index = h_index;
    }
  }

  // Document count - directly apply based on priority
  if (
    authorProfile &&
    authorProfile.coredata &&
    authorProfile.coredata["document-count"]
  ) {
    const documentCount = parseInt(
      authorProfile.coredata["document-count"],
      10
    );
    if (isPreferredSource || authorDetails.documentCount === null) {
      authorDetails.documentCount = documentCount;
    }
  }
};

//=============================================================================
// HELPER FUNCTIONS
//=============================================================================

/**
 * Parses and adds Scopus affiliation to author details
 * @param {Object} authorDetails - Target author details object
 * @param {Object} affiliation - Scopus affiliation object
 * @private
 */
const parseAndAddScopusAffiliation = (authorDetails, affiliation) => {
  try {
    let affiliationData;

    // Handle different Scopus affiliation structures
    if (affiliation.affiliation && affiliation.affiliation["ip-doc"]) {
      affiliationData = affiliation.affiliation["ip-doc"];
    } else if (affiliation["ip-doc"]) {
      affiliationData = affiliation["ip-doc"];
    } else if (affiliation["afdispname"]) {
      affiliationData = affiliation;
    } else if (Array.isArray(affiliation)) {
      affiliation.forEach((aff) =>
        parseAndAddScopusAffiliation(authorDetails, aff)
      );
      return;
    }

    if (affiliationData) {
      const newAffiliation = {
        name: affiliationData.afdispname || null,
        country: null,
      };

      // Try to extract country information
      if (affiliationData.address && affiliationData.address.country) {
        newAffiliation.country = affiliationData.address.country;
      }

      // Check if this affiliation is already in the history
      const isDuplicate = authorDetails.author.affiliationHistory.some(
        (aff) => aff.name === newAffiliation.name
      );

      if (!isDuplicate && newAffiliation.name) {
        authorDetails.author.affiliationHistory.push(newAffiliation);
      }
    }
  } catch (error) {
    console.warn("Error parsing Scopus affiliation:", error.message);
  }
};

//=============================================================================
// OPENALEX DATA FUNCTIONS
//=============================================================================

/**
 * Fetches author data from OpenAlex
 * @param {string} authorId - OpenAlex author ID
 * @returns {Promise<Object>} Author data
 * @private
 */
const fetchOpenAlexAuthor = async (authorId) => {
  // Extract the ID from the full URL format if needed
  const id = authorId.includes("/") ? authorId.split("/").pop() : authorId;

  let url = `https://api.openalex.org/authors/${id}?select=display_name,display_name_alternatives,works_count,cited_by_count,summary_stats,affiliations,counts_by_year,topics&api_key=${openAlexApiKey}`;

  try {
    const { data } = await axios.get(url);
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Merges OpenAlex data into author details object
 * @param {Object} authorDetails - Target author details object
 * @param {Object} openAlexAuthorData - OpenAlex author data
 * @param {string} prioritySource - Primary source to use for metrics
 * @private
 */
const mergeOpenAlexData = (
  authorDetails,
  openAlexAuthorData,
  prioritySource
) => {
  const isPreferredSource = prioritySource === "openalex";

  // Add expertise from OpenAlex topics (domain names)
  if (openAlexAuthorData.topics && Array.isArray(openAlexAuthorData.topics)) {
    // Create a set to avoid duplicates from field names
    const fieldNames = new Set();

    openAlexAuthorData.topics.forEach((topic) => {
      if (topic.field && topic.field.display_name) {
        fieldNames.add(topic.field.display_name);
      }
    });

    // Add unique field names to expertise
    fieldNames.forEach((name) => {
      if (!authorDetails.expertise.includes(name)) {
        authorDetails.expertise.push(name);
      }
    });
  }

  // Basic author info
  if (openAlexAuthorData.display_name) {
    authorDetails.author.name = openAlexAuthorData.display_name;

    // Try to extract surname and given name (assuming last word is surname)
    const nameParts = openAlexAuthorData.display_name.split(" ");
    if (nameParts.length > 1) {
      authorDetails.author.surname = nameParts.pop();
      authorDetails.author.givenName = nameParts.join(" ");
    }
  }

  // Add affiliations
  if (
    openAlexAuthorData.affiliations &&
    Array.isArray(openAlexAuthorData.affiliations)
  ) {
    openAlexAuthorData.affiliations.forEach((affiliation) => {
      if (affiliation.institution && affiliation.institution.display_name) {
        const newAffiliation = {
          name: affiliation.institution.display_name,
          country: affiliation.institution.country_code,
        };

        // Check if this affiliation is already in the history
        const isDuplicate = authorDetails.author.affiliationHistory.some(
          (aff) => aff.name === newAffiliation.name
        );

        if (!isDuplicate) {
          authorDetails.author.affiliationHistory.push(newAffiliation);
        }
      }
    });
  }
  // Citation count - directly apply based on priority
  if (openAlexAuthorData.cited_by_count) {
    if (isPreferredSource || authorDetails.citationCount === null) {
      authorDetails.citationCount = openAlexAuthorData.cited_by_count;
    }
  }

  // Citation metrics - directly apply based on priority
  if (openAlexAuthorData.summary_stats) {
    // H-index
    if (openAlexAuthorData.summary_stats.h_index) {
      if (isPreferredSource || authorDetails.h_index === null) {
        authorDetails.h_index = openAlexAuthorData.summary_stats.h_index;
      }
    }

    // i10-index
    if (openAlexAuthorData.summary_stats.i10_index) {
      if (isPreferredSource || authorDetails.i10_index === null) {
        authorDetails.i10_index = openAlexAuthorData.summary_stats.i10_index;
      }
    }
  }

  // Document count - directly apply based on priority
  if (openAlexAuthorData.works_count) {
    if (isPreferredSource || authorDetails.documentCount === null) {
      authorDetails.documentCount = openAlexAuthorData.works_count;
    }
  }
  // Citation graph - directly apply based on priority
  if (
    openAlexAuthorData.counts_by_year &&
    Array.isArray(openAlexAuthorData.counts_by_year)
  ) {
    if (isPreferredSource || authorDetails.graph.length === 0) {
      // Use the counts_by_year directly as the graph data with standardized field names
      authorDetails.graph = openAlexAuthorData.counts_by_year
        .map((item) => ({
          year: item.year,
          works_count: item.works_count || 0,
          cited_by_count: item.cited_by_count || 0,
        }))
        .sort((a, b) => b.year - a.year); // Sort by year descending
    }
  }
};

module.exports = {
  aggregateAuthorDetails,
};
