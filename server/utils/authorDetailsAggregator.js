/**
 * Author Details Aggregator Module
 *
 * This module aggregates author details from multiple academic sources
 * (Google Scholar, Scopus) into a comprehensive author profile.
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
  // Access API keys directly from environment variables

  console.log("=== Starting Author Details Aggregation ===");
  console.log("Author IDs:", authorIds);
  console.log("Candidate Name:", candidateName);
  console.log("Using API keys from environment variables");
  console.log("Google Scholar API Key available:", !!googleScholarApiKey);
  console.log("Scopus API Key available:", !!scopusApiKey);

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
    },
    documentCounts: {
      googleScholar: 0,
      scopus: 0,
    },
    i10_index: null,
    graph: {
      googleScholar: [],
      scopus: [],
    },
  };

  // Collect data from Google Scholar
  if (authorIds.google_scholar) {
    console.log("--- Fetching Google Scholar Data ---");
    console.log("Google Scholar Author ID:", authorIds.google_scholar);
    try {
      const googleScholarData = await fetchGoogleScholarAuthor(
        authorIds.google_scholar
      );

      console.log("Google Scholar Data Retrieved:", !!googleScholarData);
      if (googleScholarData) {
        console.log(
          "Google Scholar Author Name:",
          googleScholarData.author?.name
        );
        console.log(
          "Google Scholar Articles Count:",
          googleScholarData.articles?.length || 0
        );
        mergeGoogleScholarData(authorDetails, googleScholarData);
        console.log("Google Scholar Data Merged Successfully");
      }
    } catch (error) {
      console.error(`Failed to fetch Google Scholar details: ${error.message}`);
      console.warn(`Failed to fetch Google Scholar details: ${error.message}`);
    }
  } else {
    console.log("No Google Scholar Author ID provided");
  }

  // Collect data from Scopus
  if (authorIds.scopus) {
    console.log("--- Fetching Scopus Data ---");
    console.log("Scopus Author ID:", authorIds.scopus);
    try {
      const [scopusAuthorData, scopusPublications] = await Promise.all([
        fetchScopusAuthor(authorIds.scopus),
        fetchScopusPublications(authorIds.scopus),
      ]);

      console.log("Scopus Author Data Retrieved:", !!scopusAuthorData);
      console.log("Scopus Publications Retrieved:", !!scopusPublications);

      if (scopusAuthorData && scopusPublications) {
        console.log(
          "Scopus Publications Count:",
          scopusPublications["search-results"]?.entry?.length || 0
        );
        mergeScopusData(authorDetails, scopusAuthorData, scopusPublications);
        console.log("Scopus Data Merged Successfully");
      }
    } catch (error) {
      console.error(`Failed to fetch Scopus details: ${error.message}`);
      console.warn(`Failed to fetch Scopus details: ${error.message}`);
    }
  } else {
    console.log("No Scopus Author ID provided");
  }

  console.log("=== Final Author Details ===");
  console.log("Final Author Name:", authorDetails.author.name);
  console.log(
    "Final Affiliations Count:",
    authorDetails.author.affiliationHistory.length
  );
  console.log("Final Articles Count:", authorDetails.articles.length);
  console.log(
    "Final H-Index (Google Scholar):",
    authorDetails.h_index.googleScholar
  );
  console.log("Final H-Index (Scopus):", authorDetails.h_index.scopus);
  console.log("=== Aggregation Complete ===");

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
  console.log("Fetching Google Scholar Author - ID:", authorId);
  const url = `https://serpapi.com/search?engine=google_scholar_author&author_id=${authorId}&api_key=${googleScholarApiKey}`;
  console.log("Google Scholar URL:", url);

  try {
    const { data } = await axios.get(url);
    console.log(
      "Google Scholar API Response received, author name:",
      data.author?.name
    );
    console.log(
      "Google Scholar API Response articles count:",
      data.articles?.length || 0
    );
    return data;
  } catch (error) {
    console.error("Error fetching Google Scholar data:", error.message);
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
  console.log("Fetching Scopus Author - ID:", authorId);

  const url = `https://api.elsevier.com/content/author?author_id=${authorId}&view=ENHANCED`;
  console.log("Scopus Author URL:", url);

  try {
    const { data } = await axios.get(url, {
      headers: {
        "X-ELS-APIKey": scopusApiKey,
        "X-ELS-Insttoken": scopusInsttoken,
        Accept: "application/json",
      },
    });
    console.log("Scopus Author API Response received");
    console.log(
      "Scopus Author Profile exists:",
      !!data["author-retrieval-response"]
    );
    console.log(data["author-retrieval-response"]);
    return data;
  } catch (error) {
    console.error("Error fetching Scopus author data:", error.message);
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
  console.log("Fetching Scopus Publications - Author ID:", authorId);
  const url = `https://api.elsevier.com/content/search/scopus?query=AU-ID(${authorId})`;
  console.log("Scopus Publications URL:", url);

  try {
    const { data } = await axios.get(url, {
      headers: {
        "X-ELS-APIKey": scopusApiKey,
        "X-ELS-Insttoken": scopusInsttoken,
        Accept: "application/json",
      },
    });
    console.log("Scopus Publications API Response received");
    console.log(
      "Scopus Publications Count:",
      data["search-results"]?.entry?.length || 0
    );
    return data;
  } catch (error) {
    console.error("Error fetching Scopus publications data:", error.message);
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
  console.log("--- Merging Google Scholar Data ---");
  console.log("Google Scholar Data Structure:", Object.keys(googleScholarData));

  // Basic author info
  if (googleScholarData.author) {
    console.log("Processing Google Scholar author info...");
    console.log("Author Name:", googleScholarData.author.name);
    console.log("Author Thumbnail:", googleScholarData.author.thumbnail);
    console.log("Author Affiliations:", googleScholarData.author.affiliations);

    authorDetails.author.name = googleScholarData.author.name;
    authorDetails.author.thumbnail = googleScholarData.author.thumbnail;

    // Add affiliations
    if (googleScholarData.author.affiliations) {
      const affiliation = {
        name: googleScholarData.author.affiliations,
        country: null, // Google Scholar doesn't provide country
      };
      authorDetails.author.affiliationHistory.push(affiliation);
      console.log("Added Google Scholar affiliation:", affiliation.name);
    }
  } else {
    console.log("No author info found in Google Scholar data");
  }
  // Citation metrics
  if (googleScholarData.cited_by) {
    console.log("Processing Google Scholar citation metrics...");
    console.log(
      "Cited By Table Available:",
      !!googleScholarData.cited_by.table
    );
    console.log(
      "Citation Graph Available:",
      !!googleScholarData.cited_by.graph
    );

    if (googleScholarData.cited_by.table) {
      console.log(
        "Citation table entries:",
        googleScholarData.cited_by.table.length
      );

      // H-index
      const hIndex = googleScholarData.cited_by.table.find(
        (item) => item.h_index
      );
      if (hIndex && hIndex.h_index && hIndex.h_index.all) {
        authorDetails.h_index.googleScholar = hIndex.h_index.all;
        console.log("Google Scholar H-index found:", hIndex.h_index.all);
      } else {
        console.log("No Google Scholar H-index found");
      }

      // i10-index
      const i10Index = googleScholarData.cited_by.table.find(
        (item) => item.i10_index
      );
      if (i10Index && i10Index.i10_index && i10Index.i10_index.all) {
        authorDetails.i10_index = i10Index.i10_index.all;
        console.log("Google Scholar i10-index found:", i10Index.i10_index.all);
      } else {
        console.log("No Google Scholar i10-index found");
      }
    }

    // Citation graph
    if (googleScholarData.cited_by.graph) {
      authorDetails.graph.googleScholar = googleScholarData.cited_by.graph;
      console.log(
        "Google Scholar citation graph entries:",
        googleScholarData.cited_by.graph.length
      );
    }
  } else {
    console.log("No citation data found in Google Scholar response");
  }
  // Publications
  if (googleScholarData.articles && googleScholarData.articles.length > 0) {
    console.log("Processing Google Scholar articles...");
    console.log(
      "Google Scholar articles count:",
      googleScholarData.articles.length
    );

    authorDetails.documentCounts.googleScholar =
      googleScholarData.articles.length;

    googleScholarData.articles.forEach((article, index) => {
      console.log(`Processing article ${index + 1}:`, article.title);
      console.log("  - Authors:", article.authors);
      console.log("  - Publication:", article.publication);
      console.log("  - Year:", article.year);
      console.log("  - Cited by:", article.cited_by?.value || 0);

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

    console.log(
      "Google Scholar articles processing complete. Total articles:",
      authorDetails.articles.length
    );
  } else {
    console.log("No Google Scholar articles found");
  }

  console.log("--- Google Scholar Data Merge Complete ---");
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
  console.log("--- Merging Scopus Data ---");
  console.log("Scopus Author Data Structure:", Object.keys(scopusAuthorData));
  console.log(
    "Scopus Publications Structure:",
    Object.keys(scopusPublications)
  );

  // Parse XML or JSON response based on format
  const authorProfile =
    scopusAuthorData["author-retrieval-response"][0] || scopusAuthorData;

  console.log("Author Profile Available:", !!authorProfile);
  console.log(
    "Author Profile Structure:",
    authorProfile ? Object.keys(authorProfile) : "None"
  );

  // Basic author info
  if (authorProfile && authorProfile["author-profile"]) {
    console.log("Processing Scopus author profile...");

    const preferredName = authorProfile["author-profile"]["preferred-name"];
    if (preferredName) {
      console.log("Scopus Preferred Name - Surname:", preferredName.surname);
      console.log(
        "Scopus Preferred Name - Given Name:",
        preferredName["given-name"]
      );

      authorDetails.author.surname = preferredName.surname || null;
      authorDetails.author.givenName = preferredName["given-name"] || null;
    } else {
      console.log("No preferred name found in Scopus author profile");
    } // Add affiliations from current and history
    const currentAffiliation = authorProfile["affiliation-current"];
    if (currentAffiliation) {
      console.log("Processing current Scopus affiliation...");
      console.log(
        "Current affiliation structure:",
        Object.keys(currentAffiliation)
      );
      parseAndAddScopusAffiliation(authorDetails, currentAffiliation);
    } else {
      console.log("No current affiliation found in Scopus data");
    }

    const affiliationHistory =
      authorProfile["author-profile"]["affiliation-history"];
    if (affiliationHistory && affiliationHistory.affiliation) {
      console.log("Processing Scopus affiliation history...");
      console.log(
        "Affiliation history type:",
        Array.isArray(affiliationHistory.affiliation) ? "Array" : "Object"
      );
      parseAndAddScopusAffiliation(
        authorDetails,
        affiliationHistory.affiliation
      );
    } else {
      console.log("No affiliation history found in Scopus data");
    }
  } else {
    console.log("No author profile found in Scopus data");
  }
  // H-index
  if (authorProfile && authorProfile["h-index"]) {
    console.log("Scopus H-index found:", authorProfile["h-index"]);
    authorDetails.h_index.scopus = parseInt(authorProfile["h-index"], 10);
  } else {
    console.log("No Scopus H-index found");
  }

  // Document count
  if (
    authorProfile &&
    authorProfile.coredata &&
    authorProfile.coredata["document-count"]
  ) {
    console.log(
      "Scopus document count found:",
      authorProfile.coredata["document-count"]
    );
    authorDetails.documentCounts.scopus = parseInt(
      authorProfile.coredata["document-count"],
      10
    );
  } else {
    console.log("No Scopus document count found");
  }
  // Publications
  if (
    scopusPublications &&
    scopusPublications["search-results"] &&
    scopusPublications["search-results"].entry
  ) {
    console.log("Processing Scopus publications...");

    const entries = scopusPublications["search-results"].entry;
    console.log("Scopus publication entries found:", entries.length);

    // Build Scopus citation graph
    console.log("Building Scopus citation graph...");
    const scopusGraph = buildScopusCitationGraph(entries);
    if (scopusGraph.length > 0) {
      authorDetails.graph.scopus = scopusGraph;
      console.log(
        "Scopus citation graph built with",
        scopusGraph.length,
        "data points"
      );
    } else {
      console.log("No Scopus citation graph data available");
    }

    // Add publications
    console.log("Processing individual Scopus publications...");
    let matchedCount = 0;
    let newCount = 0;

    entries.forEach((pub, index) => {
      console.log(
        `Processing Scopus publication ${index + 1}:`,
        pub["dc:title"]
      );
      console.log("  - Creator:", pub["dc:creator"]);
      console.log("  - Publication:", pub["prism:publicationName"]);
      console.log("  - Cover Date:", pub["prism:coverDate"]);
      console.log("  - Cited by count:", pub["citedby-count"]);

      const existingArticle = findMatchingArticle(
        authorDetails.articles,
        pub["dc:title"]
      );

      if (existingArticle) {
        console.log("  - MATCHED with existing article, updating...");
        matchedCount++;

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
        console.log("  - NEW article, adding...");
        newCount++;

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

    console.log(`Scopus publications processing complete:`);
    console.log(`  - Matched with existing: ${matchedCount}`);
    console.log(`  - Added new: ${newCount}`);
    console.log(`  - Total articles now: ${authorDetails.articles.length}`);
  } else {
    console.log("No Scopus publications found");
  }

  console.log("--- Scopus Data Merge Complete ---");
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
  console.log("--- Parsing Scopus Affiliation ---");
  console.log("Affiliation input type:", typeof affiliation);
  console.log("Affiliation is array:", Array.isArray(affiliation));
  console.log(
    "Affiliation keys:",
    affiliation ? Object.keys(affiliation) : "None"
  );

  try {
    let affiliationData;

    // Handle different Scopus affiliation structures
    if (affiliation.affiliation && affiliation.affiliation["ip-doc"]) {
      console.log("Found affiliation.affiliation.ip-doc structure");
      affiliationData = affiliation.affiliation["ip-doc"];
    } else if (affiliation["ip-doc"]) {
      console.log("Found affiliation.ip-doc structure");
      affiliationData = affiliation["ip-doc"];
    } else if (affiliation["afdispname"]) {
      console.log("Found affiliation.afdispname structure");
      affiliationData = affiliation;
    } else if (Array.isArray(affiliation)) {
      console.log(
        "Processing array of affiliations, count:",
        affiliation.length
      );
      affiliation.forEach((aff, index) => {
        console.log(`Processing affiliation ${index + 1} in array`);
        parseAndAddScopusAffiliation(authorDetails, aff);
      });
      return;
    } else {
      console.log(
        "Unknown affiliation structure, keys:",
        affiliation ? Object.keys(affiliation) : "None"
      );
    }

    if (affiliationData) {
      console.log("Processing affiliation data...");
      console.log("Affiliation display name:", affiliationData.afdispname);
      console.log("Affiliation address available:", !!affiliationData.address);

      const newAffiliation = {
        name: affiliationData.afdispname || null,
        country: null,
      };

      // Try to extract country information
      if (affiliationData.address && affiliationData.address.country) {
        newAffiliation.country = affiliationData.address.country;
        console.log("Country found:", newAffiliation.country);
      } else {
        console.log("No country information found");
      }

      // Check if this affiliation is already in the history
      const isDuplicate = authorDetails.author.affiliationHistory.some(
        (aff) => aff.name === newAffiliation.name
      );

      if (!isDuplicate && newAffiliation.name) {
        authorDetails.author.affiliationHistory.push(newAffiliation);
        console.log("Added new affiliation:", newAffiliation.name);
      } else if (isDuplicate) {
        console.log("Skipped duplicate affiliation:", newAffiliation.name);
      } else {
        console.log("Skipped affiliation with no name");
      }
    } else {
      console.log("No affiliation data to process");
    }
  } catch (error) {
    console.error("Error parsing Scopus affiliation:", error.message);
    console.warn("Error parsing Scopus affiliation:", error.message);
  }

  console.log("--- Scopus Affiliation Parsing Complete ---");
};

/**
 * Builds citation graph from Scopus publications
 * @param {Array} publications - Scopus publications array
 * @returns {Array} Year-based citation graph
 * @private
 */
const buildScopusCitationGraph = (publications) => {
  console.log("--- Building Scopus Citation Graph ---");
  console.log("Publications count:", publications.length);

  const yearCitations = {};

  publications.forEach((pub, index) => {
    if (pub["prism:coverDate"] && pub["citedby-count"]) {
      const year = pub["prism:coverDate"].substring(0, 4);
      const citations = parseInt(pub["citedby-count"], 10) || 0;

      console.log(
        `Publication ${index + 1}: Year ${year}, Citations ${citations}`
      );

      if (!yearCitations[year]) {
        yearCitations[year] = 0;
      }

      yearCitations[year] += citations;
    } else {
      console.log(`Publication ${index + 1}: Missing date or citation data`);
    }
  });

  console.log("Year citations summary:", yearCitations);

  // Convert to array format similar to Google Scholar
  const graphData = Object.keys(yearCitations)
    .map((year) => ({
      year: parseInt(year, 10),
      citations: yearCitations[year],
    }))
    .sort((a, b) => a.year - b.year);

  console.log("Final graph data points:", graphData.length);
  console.log("--- Citation Graph Build Complete ---");

  return graphData;
};

/**
 * Finds a matching article in the articles array based on title similarity
 * @param {Array} articles - Array of articles
 * @param {string} title - Title to search for
 * @returns {Object|null} Matching article or null
 * @private
 */
const findMatchingArticle = (articles, title) => {
  console.log("--- Finding Matching Article ---");
  console.log("Looking for title:", title);
  console.log("Searching in", articles.length, "existing articles");

  if (!title || !articles || articles.length === 0) {
    console.log("No title provided or no articles to search");
    return null;
  }

  const normalizedTitle = title.toLowerCase().trim();
  console.log("Normalized search title:", normalizedTitle);

  const match = articles.find((article, index) => {
    const articleTitle = article.title.toLowerCase().trim();
    console.log(`Comparing with article ${index + 1}:`, articleTitle);

    // Exact match
    if (articleTitle === normalizedTitle) {
      console.log("  - EXACT MATCH found!");
      return true;
    }

    // Substring match for longer titles
    if (articleTitle.length > 20 && normalizedTitle.length > 20) {
      const isSubstringMatch =
        articleTitle.includes(normalizedTitle) ||
        normalizedTitle.includes(articleTitle);
      if (isSubstringMatch) {
        console.log("  - SUBSTRING MATCH found!");
        return true;
      }
    }

    // Title similarity
    const similarity = getTitleSimilarity(articleTitle, normalizedTitle);
    console.log(`  - Similarity score: ${similarity}%`);
    if (similarity > 80) {
      console.log("  - SIMILARITY MATCH found!");
      return true;
    }

    return false;
  });

  if (match) {
    console.log("Match found:", match.title);
  } else {
    console.log("No match found");
  }
  console.log("--- Article Matching Complete ---");

  return match || null;
};

module.exports = {
  aggregateAuthorDetails,
};
