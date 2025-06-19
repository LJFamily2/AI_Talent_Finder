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
require("dotenv").config();

//=============================================================================
// CONFIGURATION AND CONSTANTS
//=============================================================================

const googleScholarApiKey = process.env.GOOGLE_SCHOLAR_API_KEY;
const scopusApiKey = process.env.SCOPUS_API_KEY;
const scopusInsttoken = process.env.SCOPUS_INSTTOKEN;

//=============================================================================
// MAIN AGGREGATION FUNCTION
//=============================================================================

/**
 * Aggregates author details from multiple sources
 * @param {Object} authorIds - Object with author IDs from different sources
 * @param {string} candidateName - Candidate name for reference
 * @returns {Promise<Object>} - Comprehensive author details
 */
const aggregateAuthorDetails = async (authorIds, candidateName) => {
  const authorDetails = {
    author: {
      name: null,
      surname: null,
      givenName: null,
      affiliationHistory: [],
      thumbnail: null,
    },
    articles: [],
    h_index: {
      googleScholar: null,
      scopus: null,
      openalex: null,
    },
    documentCounts: {
      googleScholar: 0,
      scopus: 0,
      openalex: 0,
    },
    i10_index: {
      googleScholar: null,
      openalex: null,
    },
    graph: {
      googleScholar: [],
      scopus: [],
      openalex: [],
    },
  };

  // Collect data from Google Scholar
  if (authorIds.google_scholar) {
    try {
      const googleScholarData = await fetchGoogleScholarAuthor(
        authorIds.google_scholar
      );

      if (googleScholarData) {
        mergeGoogleScholarData(authorDetails, googleScholarData);
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

      if (scopusAuthorData && scopusPublications) {
        mergeScopusData(authorDetails, scopusAuthorData, scopusPublications);
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

      if (openAlexAuthorData) {
        mergeOpenAlexData(authorDetails, openAlexAuthorData, openAlexWorksData);
      }
    } catch (error) {
      console.warn(`Failed to fetch OpenAlex details: ${error.message}`);
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
 * @private
 */
const mergeGoogleScholarData = (authorDetails, googleScholarData) => {
  // Basic author info
  if (googleScholarData.author) {
    authorDetails.author.name = googleScholarData.author.name;
    authorDetails.author.thumbnail = googleScholarData.author.thumbnail;

    // Add affiliations
    if (googleScholarData.author.affiliations) {
      const affiliation = {
        name: googleScholarData.author.affiliations,
        country: null, // Google Scholar doesn't provide country
      };
      authorDetails.author.affiliationHistory.push(affiliation);
    }
  }

  // Citation metrics
  if (googleScholarData.cited_by) {
    if (googleScholarData.cited_by.table) {
      // H-index
      const hIndex = googleScholarData.cited_by.table.find(
        (item) => item.h_index
      );
      if (hIndex && hIndex.h_index && hIndex.h_index.all) {
        authorDetails.h_index.googleScholar = hIndex.h_index.all;
      }

      // i10-index
      const i10Index = googleScholarData.cited_by.table.find(
        (item) => item.i10_index
      );
      if (i10Index && i10Index.i10_index && i10Index.i10_index.all) {
        authorDetails.i10_index.googleScholar = i10Index.i10_index.all;
      }
    }

    // Citation graph
    if (googleScholarData.cited_by.graph) {
      authorDetails.graph.googleScholar = googleScholarData.cited_by.graph;
    }
  }

  // Publications
  if (googleScholarData.articles && googleScholarData.articles.length > 0) {
    authorDetails.documentCounts.googleScholar =
      googleScholarData.articles.length;

    googleScholarData.articles.forEach((article) => {
      const articleObj = {
        title: article.title,
        link: {
          googleScholarLink: article.link,
          scopusLink: null,
        },
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
 * @private
 */
const mergeScopusData = (
  authorDetails,
  scopusAuthorData,
  scopusPublications
) => {
  // Parse XML or JSON response based on format
  const authorProfile =
    scopusAuthorData["author-retrieval-response"] || scopusAuthorData;

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

  // H-index
  if (authorProfile && authorProfile["h-index"]) {
    authorDetails.h_index.scopus = parseInt(authorProfile["h-index"], 10);
  }

  // Document count
  if (
    authorProfile &&
    authorProfile.coredata &&
    authorProfile.coredata["document-count"]
  ) {
    authorDetails.documentCounts.scopus = parseInt(
      authorProfile.coredata["document-count"],
      10
    );
  }

  // Publications
  if (
    scopusPublications &&
    scopusPublications["search-results"] &&
    scopusPublications["search-results"].entry
  ) {
    const entries = scopusPublications["search-results"].entry;

    // Build Scopus citation graph
    const scopusGraph = buildScopusCitationGraph(entries);
    if (scopusGraph.length > 0) {
      authorDetails.graph.scopus = scopusGraph;
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
          link: {
            googleScholarLink: null,
            scopusLink: pub["prism:url"],
          },
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

  const url = `https://api.openalex.org/authors/${id}?select=display_name,display_name_alternatives,works_count,cited_by_count,summary_stats,affiliations,counts_by_year`;

  try {
    const { data } = await axios.get(url);
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Fetches author's works/publications from OpenAlex
 * @param {string} authorId - OpenAlex author ID
 * @returns {Promise<Object>} Works data
 * @private
 */
const fetchOpenAlexWorks = async (authorId) => {
  // Extract the ID from the full URL format if needed
  const id = authorId.includes("/") ? authorId.split("/").pop() : authorId;

  const url = `https://api.openalex.org/works?filter=authorships.author.id:${id}&select=id,doi,title,display_name,publication_year,type,type_crossref,authorships,primary_location,cited_by_count,biblio,open_access,best_oa_location,topics,counts_by_year`;

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
 * @param {Object} openAlexWorksData - OpenAlex works data
 * @private
 */
const mergeOpenAlexData = (
  authorDetails,
  openAlexAuthorData,
  openAlexWorksData = null
) => {
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

  // Citation metrics
  if (openAlexAuthorData.summary_stats) {
    // H-index
    if (openAlexAuthorData.summary_stats.h_index) {
      authorDetails.h_index.openalex = openAlexAuthorData.summary_stats.h_index;
    }

    // i10-index
    if (openAlexAuthorData.summary_stats.i10_index) {
      authorDetails.i10_index.openalex =
        openAlexAuthorData.summary_stats.i10_index;
    }
  }

  // Document count
  if (openAlexAuthorData.works_count) {
    authorDetails.documentCounts.openalex = openAlexAuthorData.works_count;
  }

  // Citation graph
  if (
    openAlexAuthorData.counts_by_year &&
    Array.isArray(openAlexAuthorData.counts_by_year)
  ) {
    authorDetails.graph.openalex = openAlexAuthorData.counts_by_year.map(
      (item) => ({
        year: item.year,
        citations: item.cited_by_count,
      })
    );
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
              openAlexId: authorship.author.id,
              institutions: authorship.institutions || [],
            });
          }
        });
      }

      // Extract venue/journal information
      let publicationName = null;
      let issn = null;
      let venue = null;

      if (work.host_venue) {
        publicationName = work.host_venue.display_name;
        issn = work.host_venue.issn_l || work.host_venue.issn;
        venue = work.host_venue;
      } else if (work.primary_location && work.primary_location.source) {
        publicationName = work.primary_location.source.display_name;
        issn =
          work.primary_location.source.issn_l ||
          work.primary_location.source.issn;
        venue = work.primary_location.source;
      }

      // Extract topics/keywords
      const keywords = [];
      if (work.topics && Array.isArray(work.topics)) {
        work.topics.forEach((topic) => {
          if (topic.display_name) {
            keywords.push(topic.display_name);
          }
        });
      }

      // Create article object matching the existing structure
      const articleObj = {
        title: work.display_name || work.title,
        doi: work.doi,
        openAlexId: work.id,
        link: {
          googleScholarLink: null,
          scopusLink: null,
          openAlexLink: work.id,
          doi: work.doi,
        },
        authors: authors,
        publicationName: publicationName,
        venue: venue,
        citedBy: work.cited_by_count || 0,
        year: work.publication_year,
        publicationDate: work.publication_date,
        issn: issn,
        type: work.type,
        typeCrossref: work.type_crossref,
        isRetracted: work.is_retracted,
        isParatext: work.is_paratext,
        openAccess: work.open_access,
        topics: work.topics || [],
        keywords: keywords,
        concepts: work.concepts || [],
        mesh: work.mesh || [],
        biblio: work.biblio,
        grants: work.grants || [],
        referencedWorksCount: work.referenced_works_count,
        relatedWorks: work.related_works || [],
        sustainableDevelopmentGoals: work.sustainable_development_goals || [],
        bestOaLocation: work.best_oa_location,
        locationsCount: work.locations_count,
        alternateHostVenues: work.alternate_host_venues || [],
        createdDate: work.created_date,
        updatedDate: work.updated_date,
      };

      // Check for duplicates based on title similarity or DOI
      const isDuplicate = authorDetails.articles.some((existingArticle) => {
        // Check DOI match first (most reliable)
        if (
          articleObj.doi &&
          existingArticle.doi &&
          articleObj.doi.toLowerCase() === existingArticle.doi.toLowerCase()
        ) {
          return true;
        }

        // Check title similarity
        if (articleObj.title && existingArticle.title) {
          const similarity = getTitleSimilarity(
            articleObj.title,
            existingArticle.title
          );
          return similarity > 0.85; // 85% similarity threshold
        }

        return false;
      });

      if (!isDuplicate) {
        authorDetails.articles.push(articleObj);
      }
    });
  }
};

module.exports = {
  aggregateAuthorDetails,
};
