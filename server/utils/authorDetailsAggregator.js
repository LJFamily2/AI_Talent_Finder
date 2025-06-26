/**
 * Author Details Aggregator Module
 *
 * This module aggregates author details from multiple academic sources
 * (Google Scholar, Scopus, OpenAlex) into a comprehensive author profile.
 *
 * @module authorDetailsAggregator
 * @author AI Talent Finder Team
 * @version 1.0.0
 */

const axios = require("axios");
const { getTitleSimilarity } = require("./textUtils");
const { strictAuthorNameVerification } = require("./authorUtils");
require("dotenv").config();

//=============================================================================
// CONFIGURATION AND CONSTANTS
//=============================================================================

const googleScholarApiKey = process.env.GOOGLE_SCHOLAR_API_KEY;
const scopusApiKey = process.env.SCOPUS_API_KEY;
const scopusInsttoken = process.env.SCOPUS_INSTTOKEN;

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
  prioritySource = "googleScholar"
) => {
  const authorDetails = {
    author: {
      name: null,
      surname: null,
      givenName: null,
      affiliationHistory: [],
    },
    articles: [],
    h_index: null,
    documentCount: null,
    i10_index: null,
    citationCount: null,
    graph: [],
    expertise: [],
  };

  // Track which sources were successfully verified
  const verifiedSources = {};

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
          console.log(
            `✅ Google Scholar author name "${authorName}" verified against candidate "${candidateName}"`
          );
        } else {
          console.log(
            `❌ Google Scholar author name "${authorName}" does not match candidate "${candidateName}"`
          );
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch Google Scholar details: ${error.message}`);
    }
  }

  // Collect data from Scopus
  if (authorIds.scopus) {
    try {
      const [scopusAuthorData, scopusPublications] = await Promise.all([
        fetchScopusAuthor(authorIds.scopus),
        fetchScopusPublications(authorIds.scopus),
      ]);

      // Verify author name match before merging data
      if (scopusAuthorData && scopusAuthorData["author-retrieval-response"]) {
        const authorProfile = scopusAuthorData["author-retrieval-response"];
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
            mergeScopusData(
              authorDetails,
              scopusAuthorData,
              scopusPublications,
              prioritySource
            );
            verifiedSources.scopus = true;
            console.log(
              `✅ Scopus author name "${authorName}" verified against candidate "${candidateName}"`
            );
          } else {
            console.log(
              `❌ Scopus author name "${authorName}" does not match candidate "${candidateName}"`
            );
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
      const [openAlexAuthorData, openAlexWorksData] = await Promise.all([
        fetchOpenAlexAuthor(authorIds.openalex),
        fetchOpenAlexWorks(authorIds.openalex),
      ]);

      // Verify author name match before merging data
      if (openAlexAuthorData && openAlexAuthorData.display_name) {
        const authorName = openAlexAuthorData.display_name;

        // Use strict verification to ensure names match
        if (strictAuthorNameVerification(candidateName, authorName)) {
          mergeOpenAlexData(
            authorDetails,
            openAlexAuthorData,
            openAlexWorksData,
            prioritySource
          );
          verifiedSources.openalex = true;
          console.log(
            `✅ OpenAlex author name "${authorName}" verified against candidate "${candidateName}"`
          );
        } else {
          console.log(
            `❌ OpenAlex author name "${authorName}" does not match candidate "${candidateName}"`
          );
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch OpenAlex details: ${error.message}`);
    }
  }

  // If no sources were verified at all, return null
  if (Object.keys(verifiedSources).length === 0) {
    console.log(
      `❌ No sources verified for candidate "${candidateName}". Returning null.`
    );
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
      console.log(
        `❌ No alternative sources available for candidate "${candidateName}". Returning null.`
      );
      return null;
    }
  }

  // After all sources have been processed, enrich the publication metadata
  if (authorDetails.articles.length > 0) {
    const originalCount = authorDetails.articles.length;
    authorDetails.articles = enrichPublicationMetadata(
      authorDetails.articles,
      prioritySource
    );
    const enrichedCount = authorDetails.articles.length;
    // Update document count to match the actual number of articles from preferred source
    if (
      authorDetails.documentCount !== null &&
      enrichedCount !== originalCount
    ) {
      authorDetails.documentCount = enrichedCount;
    }
  }

  // Remove _source field from final output for clean API response
  if (authorDetails.articles) {
    authorDetails.articles = authorDetails.articles.map((article) => {
      const { _source, ...cleanArticle } = article;
      return cleanArticle;
    });
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
 * Fetches author's publications from Scopus
 * @param {string} authorId - Scopus author ID
 * @returns {Promise<Object>} Publications data
 * @private
 */
const fetchScopusPublications = async (authorId) => {
  const url = `https://api.elsevier.com/content/search/scopus?query=AU-ID(${authorId})`;

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

//=============================================================================
// DATA MERGING FUNCTIONS
//=============================================================================

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

  // Publications
  if (googleScholarData.articles && googleScholarData.articles.length > 0) {
    // Document count - directly apply based on priority
    if (isPreferredSource || authorDetails.documentCount === null) {
      authorDetails.documentCount = googleScholarData.articles.length;
    }
    googleScholarData.articles.forEach((article) => {
      const articleObj = {
        title: article.title,
        link: article.link || null,
        authors: article.authors ? [{ name: article.authors }] : [],
        publicationName: article.publication || null,
        citedBy:
          article.cited_by && article.cited_by.value
            ? article.cited_by.value
            : 0,
        year: article.year || null,
        issn: null,
        volume: null,
        issueIdentifier: null,
        pageRange: null,
        _source: "googleScholar",
      };

      authorDetails.articles.push(articleObj);
    });
  }
};

/**
 * Merges Scopus data into author details object
 * @param {Object} authorDetails - Target author details object
 * @param {Object} scopusAuthorData - Scopus author data
 * @param {Object} scopusPublications - Scopus publications data
 * @param {string} prioritySource - Primary source to use for metrics
 * @private
 */
const mergeScopusData = (
  authorDetails,
  scopusAuthorData,
  scopusPublications,
  prioritySource
) => {
  const isPreferredSource = prioritySource === "scopus";

  // Parse XML or JSON response based on format
  const authorProfile =
    scopusAuthorData["author-retrieval-response"] || scopusAuthorData;

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

  // Publications
  if (
    scopusPublications &&
    scopusPublications["search-results"] &&
    scopusPublications["search-results"].entry
  ) {
    const entries = scopusPublications["search-results"].entry; // Build Scopus citation graph and apply based on priority
    const scopusGraph = buildScopusCitationGraph(entries);
    if (scopusGraph.length > 0) {
      if (isPreferredSource || authorDetails.graph.length === 0) {
        // Count publications per year
        const yearWorkCounts = {};
        entries.forEach((pub) => {
          if (pub["prism:coverDate"]) {
            const year = parseInt(pub["prism:coverDate"].substring(0, 4), 10);
            yearWorkCounts[year] = (yearWorkCounts[year] || 0) + 1;
          }
        }); // Create year-by-year data with works_count and cited_by_count
        authorDetails.graph = scopusGraph
          .map((item) => ({
            year: item.year,
            works_count: yearWorkCounts[item.year] || 0,
            cited_by_count: item.citations || 0,
          }))
          .sort((a, b) => b.year - a.year); // Sort by year descending
      }
    }

    // Add publications
    entries.forEach((pub) => {
      const existingArticle = findMatchingArticle(
        authorDetails.articles,
        pub["dc:title"]
      );

      if (existingArticle) {
        // Update existing article with Scopus info
        existingArticle.link.scopusLink = pub["prism:url"];
        existingArticle.publicationName =
          pub["prism:publicationName"] || existingArticle.publicationName;
        existingArticle.citedBy = Math.max(
          existingArticle.citedBy,
          parseInt(pub["citedby-count"] || "0", 10)
        );
        existingArticle.year = pub["prism:coverDate"]
          ? pub["prism:coverDate"].substring(0, 4)
          : existingArticle.year;
        existingArticle.issn = pub["prism:issn"];
        existingArticle.volume = pub["prism:volume"];
        existingArticle.issueIdentifier = pub["prism:issueIdentifier"];
        existingArticle.pageRange = pub["prism:pageRange"];
      } else {
        // Add new article from Scopus
        const articleObj = {
          title: pub["dc:title"],
          link: pub["prism:url"] || null,
          authors: [{ name: pub["dc:creator"] }],
          publicationName: pub["prism:publicationName"],
          citedBy: parseInt(pub["citedby-count"] || "0", 10),
          year: pub["prism:coverDate"]
            ? pub["prism:coverDate"].substring(0, 4)
            : null,
          issn: pub["prism:issn"],
          volume: pub["prism:volume"],
          issueIdentifier: pub["prism:issueIdentifier"],
          pageRange: pub["prism:pageRange"],
          _source: "scopus",
        };

        authorDetails.articles.push(articleObj);
      }
    });
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

/**
 * Builds citation graph from Scopus publications
 * @param {Array} publications - Scopus publications array
 * @returns {Array} Year-based citation graph
 * @private
 */
const buildScopusCitationGraph = (publications) => {
  const yearCitations = {};

  publications.forEach((pub) => {
    if (pub["prism:coverDate"] && pub["citedby-count"]) {
      const year = pub["prism:coverDate"].substring(0, 4);
      const citations = parseInt(pub["citedby-count"], 10) || 0;

      if (!yearCitations[year]) {
        yearCitations[year] = 0;
      }

      yearCitations[year] += citations;
    }
  });

  // Convert to array format similar to Google Scholar
  return Object.keys(yearCitations)
    .map((year) => ({
      year: parseInt(year, 10),
      citations: yearCitations[year],
    }))
    .sort((a, b) => a.year - b.year);
};

/**
 * Finds a matching article in the articles array based on title similarity
 * @param {Array} articles - Array of articles
 * @param {string} title - Title to search for
 * @returns {Object|null} Matching article or null
 * @private
 */
const findMatchingArticle = (articles, title) => {
  if (!title || !articles || articles.length === 0) {
    return null;
  }

  const normalizedTitle = title.toLowerCase().trim();

  return articles.find((article) => {
    const articleTitle = article.title.toLowerCase().trim();

    // Exact match
    if (articleTitle === normalizedTitle) {
      return true;
    }

    // Substring match for longer titles
    if (articleTitle.length > 20 && normalizedTitle.length > 20) {
      return (
        articleTitle.includes(normalizedTitle) ||
        normalizedTitle.includes(articleTitle)
      );
    }

    // Title similarity
    const similarity = getTitleSimilarity(articleTitle, normalizedTitle);
    if (similarity > 80) {
      return true;
    }

    return false;
  });
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

  const url = `https://api.openalex.org/authors/${id}?select=display_name,display_name_alternatives,works_count,cited_by_count,summary_stats,affiliations,counts_by_year,topics`;

  try {
    const { data } = await axios.get(url);
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Fetches author's works/publications from OpenAlex with pagination
 * @param {string} authorId - OpenAlex author ID
 * @returns {Promise<Object>} Works data with all pages combined
 * @private
 */
const fetchOpenAlexWorks = async (authorId) => {
  // Extract the ID from the full URL format if needed
  const id = authorId.includes("/") ? authorId.split("/").pop() : authorId;

  const allWorks = [];
  let cursor = "*";
  let hasMorePages = true;
  const perPage = 200; // Maximum allowed by OpenAlex
  while (hasMorePages) {
    const url = `https://api.openalex.org/works?filter=authorships.author.id:${id}&select=id,doi,title,display_name,publication_year,type,type_crossref,authorships,primary_location,cited_by_count,biblio,open_access,topics,counts_by_year&per_page=${perPage}&cursor=${cursor}`;

    try {
      const { data } = await axios.get(url);

      if (data.results && data.results.length > 0) {
        allWorks.push(...data.results);
      }

      // Check if there are more pages
      if (data.meta && data.meta.next_cursor) {
        cursor = data.meta.next_cursor;
      } else {
        hasMorePages = false;
      }
    } catch (error) {
      console.error(
        `Failed to fetch OpenAlex works with cursor ${cursor}:`,
        error.message
      );
      throw error;
    }
  }

  return {
    results: allWorks,
    meta: {
      count: allWorks.length,
    },
  };
};

/**
 * Merges OpenAlex data into author details object
 * @param {Object} authorDetails - Target author details object
 * @param {Object} openAlexAuthorData - OpenAlex author data
 * @param {Object} openAlexWorksData - OpenAlex works data
 * @param {string} prioritySource - Primary source to use for metrics
 * @private
 */
const mergeOpenAlexData = (
  authorDetails,
  openAlexAuthorData,
  openAlexWorksData = null,
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

  // Merge publications/works data
  if (
    openAlexWorksData &&
    openAlexWorksData.results &&
    Array.isArray(openAlexWorksData.results)
  ) {
    openAlexWorksData.results.forEach((work) => {
      // Extract authors information
      const authors = [];
      if (work.authorships && Array.isArray(work.authorships)) {
        work.authorships.forEach((authorship) => {
          if (authorship.author && authorship.author.display_name) {
            authors.push({
              name: authorship.author.display_name,
            });
          }
        });
      }

      // Extract venue/journal information
      let publicationName = null;
      let issn = null;

      if (work.host_venue) {
        publicationName = work.host_venue.display_name;
        issn = work.host_venue.issn_l || work.host_venue.issn;
      } else if (work.primary_location && work.primary_location.source) {
        publicationName = work.primary_location.source.display_name;
        issn =
          work.primary_location.source.issn_l ||
          work.primary_location.source.issn;
      }

      // Extract volume and issue information
      let volume = null;
      let issueIdentifier = null;
      let pageRange = null;

      if (work.biblio) {
        volume = work.biblio.volume;
        issueIdentifier = work.biblio.issue;

        // Combine first_page and last_page for pageRange
        if (work.biblio.first_page && work.biblio.last_page) {
          pageRange = `${work.biblio.first_page}-${work.biblio.last_page}`;
        } else if (work.biblio.first_page) {
          pageRange = work.biblio.first_page;
        }
      }

      // Determine the best link - prefer DOI, fallback to OpenAlex link
      let link = work.id; // Default to OpenAlex link
      if (work.doi) {
        link = work.doi.startsWith("http")
          ? work.doi
          : `https://doi.org/${work.doi}`;
      } 
      // Create article object matching the required structure
      const articleObj = {
        title: work.display_name || work.title,
        link: link,
        authors: authors,
        publicationName: publicationName,
        citedBy: work.cited_by_count || 0,
        year: work.publication_year,
        issn: issn,
        volume: volume,
        issueIdentifier: issueIdentifier,
        pageRange: pageRange,
        _source: "openalex",
      };
      authorDetails.articles.push(articleObj);
    });
  }
};

//=============================================================================
// PUBLICATION METADATA ENRICHMENT FUNCTIONS
//=============================================================================

/**
 * Enriches publication metadata from preferred source with data from other sources
 * @param {Array} articles - Array of publication objects from different sources
 * @param {string} prioritySource - Primary source to preserve publications from
 * @returns {Array} Enhanced publications with preferred source publications preserved
 */
const enrichPublicationMetadata = (
  articles,
  prioritySource = "googleScholar"
) => {
  // Step 1: Separate articles by source
  const sourceMap = categorizeArticlesBySource(articles);

  // Get preferred source articles (all must be preserved)
  const preferredArticles = sourceMap[prioritySource] || [];

  // Get supplementary articles (only used for metadata enrichment)
  const supplementaryArticles = [];
  Object.keys(sourceMap).forEach((source) => {
    if (source !== prioritySource) {
      supplementaryArticles.push(...sourceMap[source]);
    }
  });

  // Step 2: Enrich each preferred publication with data from supplementary sources
  const enrichedArticles = preferredArticles.map((article) => {
    // Find matching supplementary articles
    const matches = findMatchingPublications(article, supplementaryArticles);

    if (matches.length > 0) {
      return enrichPublicationWithMatches(article, matches);
    }

    return article;
  });

  return enrichedArticles;
};

/**
 * Categorizes articles by their source based on their structure and properties
 * @param {Array} articles - Array of article objects
 * @returns {Object} Map of source name to array of articles
 */
const categorizeArticlesBySource = (articles) => {
  const sourceMap = {
    googleScholar: [],
    scopus: [],
    openalex: [],
    other: [],
  };

  articles.forEach((article, index) => {
    let sourceDetected = false;

    // Method 1: Use explicit _source field if available (most reliable)
    if (article._source && sourceMap[article._source]) {
      sourceMap[article._source].push(article);
      sourceDetected = true;
    }

    // Method 2: Check link patterns (fallback for articles without _source)
    if (!sourceDetected && article.link && typeof article.link === "string") {
      if (
        article.link.includes("scholar.google.com") ||
        article.link.includes("citations?view_op=view_citation")
      ) {
        sourceMap.googleScholar.push(article);
        sourceDetected = true;
      } else if (
        article.link.includes("scopus") ||
        article.link.includes("elsevier")
      ) {
        sourceMap.scopus.push(article);
        sourceDetected = true;
      } else if (article.link.includes("openalex.org")) {
        sourceMap.openalex.push(article);
        sourceDetected = true;
      }
    }

    // Method 3: Check for OpenAlex-specific properties
    if (
      !sourceDetected &&
      (article.openAlexId ||
        (article.link && article.link.startsWith("https://openalex.org/")))
    ) {
      sourceMap.openalex.push(article);
      sourceDetected = true;
    }

    // Method 4: Check publication name patterns
    if (!sourceDetected && article.publicationName) {
      // Google Scholar often has publication patterns like "Journal Name, Year" or "Publisher, Year"
      if (/,\s*\d{4}$/.test(article.publicationName)) {
        sourceMap.googleScholar.push(article);
        sourceDetected = true;
      }
    }

    // Method 5: Check for Scopus-specific ISSN format or volume/issue patterns
    if (
      !sourceDetected &&
      (article.issn || (article.volume && article.issueIdentifier))
    ) {
      sourceMap.scopus.push(article);
      sourceDetected = true;
    }

    // Default: assign to 'other' if no source detected
    if (!sourceDetected) {
      sourceMap.other.push(article);
    }
  });

  return sourceMap;
};

/**
 * Finds matching publications in supplementary sources
 * @param {Object} article - Target article to find matches for
 * @param {Array} supplementaryArticles - Articles from other sources
 * @returns {Array} Matching articles from supplementary sources
 */
const findMatchingPublications = (article, supplementaryArticles) => {
  const matches = [];

  supplementaryArticles.forEach((supArticle) => {
    if (publicationsMatch(article, supArticle)) {
      matches.push(supArticle);
    }
  });

  return matches;
};

/**
 * Enriches a publication with data from matching supplementary publications
 * @param {Object} article - Target article to enrich
 * @param {Array} matches - Matching articles from supplementary sources
 * @returns {Object} Enriched article with filled-in metadata
 */
const enrichPublicationWithMatches = (article, matches) => {
  // Create a copy of the original article
  const enriched = { ...article };

  // For each matching article, fill in missing fields
  matches.forEach((match) => {
    Object.entries(match).forEach(([key, value]) => {
      // Skip undefined/null/empty values or already populated fields
      if (value === undefined || value === null || value === "") return;
      if (
        enriched[key] !== undefined &&
        enriched[key] !== null &&
        enriched[key] !== ""
      )
        return;

      // Special handling for specific fields
      switch (key) {
        case "citedBy":
          // Use the highest citation count
          enriched[key] = Math.max(enriched[key] || 0, value);
          break;

        case "title":
          // Only fill if missing
          if (!enriched[key]) {
            enriched[key] = value;
          }
          break;

        case "authors":
          // Only fill if missing or has fewer authors
          if (
            !enriched[key] ||
            !enriched[key].length ||
            (Array.isArray(value) && value.length > enriched[key].length)
          ) {
            enriched[key] = [...value];
          }
          break;

        default:
          // Fill in missing fields
          if (
            enriched[key] === undefined ||
            enriched[key] === null ||
            enriched[key] === ""
          ) {
            enriched[key] = value;
          }
      }
    });
  });

  return enriched;
};

/**
 * Determines if two publications likely represent the same work
 * @param {Object} pub1 - First publication
 * @param {Object} pub2 - Second publication
 * @returns {Boolean} True if publications match
 */
const publicationsMatch = (pub1, pub2) => {
  // Match by DOI (most reliable)
  if (
    pub1.link &&
    pub2.link &&
    isDoi(pub1.link) &&
    isDoi(pub2.link) &&
    normalizeDoi(pub1.link) === normalizeDoi(pub2.link)
  ) {
    return true;
  }

  // Match by title similarity + year
  if (pub1.title && pub2.title && pub1.year && pub2.year) {
    const titleSimilarity = getTitleSimilarity(pub1.title, pub2.title) / 100;

    // High title similarity + same year = likely match
    if (titleSimilarity > 0.8 && pub1.year === pub2.year) {
      return true;
    }

    // Very high title similarity = match even with different year
    if (titleSimilarity > 0.9) {
      return true;
    }
  }

  // Match by first author + title keywords + year
  if (
    pub1.authors?.length > 0 &&
    pub2.authors?.length > 0 &&
    pub1.title &&
    pub2.title &&
    pub1.year &&
    pub2.year
  ) {
    const firstAuthor1 = pub1.authors[0].name.toLowerCase();
    const firstAuthor2 = pub2.authors[0].name.toLowerCase();
    const authorSimilarity = calculateStringSimilarity(
      firstAuthor1,
      firstAuthor2
    );

    // Extract keywords from titles
    const keywords1 = extractKeywords(pub1.title);
    const keywords2 = extractKeywords(pub2.title);
    const keywordOverlap = calculateKeywordOverlap(keywords1, keywords2);

    // Same first author + keyword overlap + same year = likely match
    if (
      authorSimilarity > 0.7 &&
      keywordOverlap > 0.6 &&
      pub1.year === pub2.year
    ) {
      return true;
    }
  }

  return false;
};

// Helper functions for publication enrichment
const isDoi = (link) =>
  link &&
  (link.startsWith("https://doi.org/") ||
    link.startsWith("http://doi.org/") ||
    link.startsWith("doi:"));

const normalizeDoi = (doi) => {
  if (!doi) return "";
  return doi.replace(/^https?:\/\/doi\.org\/|^doi:/i, "").toLowerCase();
};

const calculateStringSimilarity = (str1, str2) => {
  if (!str1 || !str2) return 0;
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1.0;

  let matches = 0;
  const window = Math.floor(maxLength / 2) - 1;

  for (let i = 0; i < str1.length; i++) {
    const start = Math.max(0, i - window);
    const end = Math.min(i + window + 1, str2.length);

    for (let j = start; j < end; j++) {
      if (str1[i] === str2[j]) {
        matches++;
        break;
      }
    }
  }

  return matches / maxLength;
};

const extractKeywords = (title) => {
  if (!title) return [];
  // Remove common stop words and extract significant terms
  const stopWords = new Set([
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "of",
    "in",
    "on",
    "at",
    "to",
    "for",
    "with",
    "by",
    "about",
    "as",
    "into",
    "like",
    "through",
    "after",
    "over",
    "between",
    "out",
    "from",
    "using",
    "analysis",
    "study",
    "research",
    "case",
    "new",
    "approach",
  ]);

  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
};

const calculateKeywordOverlap = (keywords1, keywords2) => {
  if (keywords1.length === 0 || keywords2.length === 0) return 0;

  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  let intersection = 0;

  set1.forEach((word) => {
    if (set2.has(word)) intersection++;
  });

  return intersection / Math.min(set1.size, set2.size);
};

module.exports = {
  aggregateAuthorDetails,
};
