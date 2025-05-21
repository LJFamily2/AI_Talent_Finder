const fs = require("fs");
const pdfParse = require("pdf-parse");
const axios = require("axios");
const { getTitleSimilarity } = require("../utils/textUtils");

// Cache for author data to avoid duplicate API calls
const authorCache = new Map();

const verifyWithGoogleScholar = async (
  title,
  author,
  doi,
  maxResultsToCheck = 10
) => {
  try {
    const serpApiKey = process.env.GOOGLE_SCHOLAR_API_KEY;
    const scholarQuery = title;
    const scholarApiUrl = `https://serpapi.com/search?engine=google_scholar&q=${encodeURIComponent(
      scholarQuery
    )}&hl=en&api_key=${serpApiKey}`;

    const { data: scholarResult } = await axios.get(scholarApiUrl);
    const organicResults =
      scholarResult?.organic_results || scholarResult?.items || [];

    if (!organicResults.length) {
      return { status: "not existed", details: null, result: scholarResult };
    }

    const found = organicResults.slice(0, maxResultsToCheck).find((item) => {
      if (doi && item.link?.toLowerCase().includes(doi.toLowerCase())) {
        return true;
      }
      if (title && item.title) {
        const normalizedTitle = title.toLowerCase().trim();
        const normalizedItemTitle = item.title.toLowerCase().trim();

        if (
          normalizedItemTitle.includes(normalizedTitle) ||
          normalizedTitle.includes(normalizedItemTitle)
        ) {
          return true;
        }

        const similarity = getTitleSimilarity(title, item.title);
        return similarity > 70;
      }
      return false;
    });

    if (!found) {
      return { status: "not existed", details: null, result: scholarResult };
    } // Get author information if available
    let authorDetails = null;
    let publicationYear = null;
    if (found.publication_info?.authors?.length > 0) {
      const authorId = found.publication_info.authors[0].author_id;
      if (authorId) {
        const authorInfo = await getAuthorDetails(
          authorId,
          serpApiKey,
          found.title
        );
        if (authorInfo) {
          publicationYear = authorInfo.year;
          authorDetails = authorInfo.details;
        }
      }
    }
    return {
      status: "verified",
      details: {
        ...found,
        year: publicationYear,
        authorDetails,
      },
      result: scholarResult,
    };
  } catch (err) {
    console.error("Google Scholar verification error:", err);
    return { status: "unable to verify", details: null, result: null };
  }
};

const verifyWithScopus = async (title, author, doi, maxResultsToCheck = 10) => {
  try {
    const scopusAPIKey = process.env.SCOPUS_API_KEY;
    const scopusQuery = title;
    const scopusApiUrl = `https://api.elsevier.com/content/search/scopus?apiKey=${scopusAPIKey}&query=${encodeURIComponent(
      scopusQuery
    )}&page=1&sortBy=relevance`;

    const { data: scopusResult } = await axios.get(scopusApiUrl);
    const entries = scopusResult?.["search-results"]?.entry || [];

    if (!entries.length) {
      return {
        status: "not existed",
        details: null,
        result: scopusResult,
        apiUrl: scopusApiUrl,
      };
    }

    const found = entries.slice(0, maxResultsToCheck).find((item) => {
      if (doi && item["prism:doi"]?.toLowerCase() === doi.toLowerCase()) {
        return true;
      }
      if (title && item["dc:title"]) {
        const normalizedTitle = title.toLowerCase().trim();
        const normalizedItemTitle = item["dc:title"].toLowerCase().trim();

        if (
          normalizedItemTitle.includes(normalizedTitle) ||
          normalizedTitle.includes(normalizedItemTitle)
        ) {
          return true;
        }

        const similarity = getTitleSimilarity(title, item["dc:title"]);
        return similarity > 70;
      }
      return false;
    });

    if (!found) {
      return {
        status: "not existed",
        details: null,
        result: scopusResult,
        apiUrl: scopusApiUrl,
      };
    }

    const scopusLink = found.link?.find((link) => link["@ref"] === "scopus")?.[
      "@href"
    ];
    const details = {
      title: found["dc:title"],
      doi: found["prism:doi"],
      authors: found["dc:creator"],
      publicationName: found["prism:publicationName"],
      link: scopusLink || null,
    };

    return {
      status: "verified",
      details,
      result: scopusResult,
      apiUrl: scopusApiUrl,
    };
  } catch (err) {
    return {
      status: "unable to verify",
      details: null,
      result: null,
      apiUrl: null,
    };
  }
};

const createGoogleScholarSearchUrl = (title) => {
  if (!title) return null;
  const encodedTitle = encodeURIComponent(title);
  return `https://scholar.google.com/scholar?hl=en&as_sdt=0%2C5&q=${encodedTitle}`;
};

const extractPublicationsFromCV = async (cvText) => {
  const cohereApiKey = process.env.COHERE_API_KEY;
  if (!cohereApiKey) {
    throw new Error("Cohere API key is not configured");
  }

  // Find the publications section
  const lines = cvText.split(/[\n]+/);
  let publicationSection = "";
  let isPublicationSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.toUpperCase() === "PUBLICATIONS") {
      isPublicationSection = true;
      continue;
    }
    if (
      isPublicationSection &&
      line.length > 0 &&
      line === line.toUpperCase() &&
      line !== "PUBLICATIONS"
    ) {
      break;
    }
    if (isPublicationSection && line.length > 0) {
      publicationSection += line + "\n";
    }
  }

  // Get publications from Cohere AI
  const cohereResponse = await axios.post(
    "https://api.cohere.ai/v1/generate",
    {
      model: "command",
      prompt: `
You are an expert academic CV analyzer focusing on publications.
From the text below, which contains the Publications section of an academic CV, extract all publication entries.
Each publication must be returned as an object inside a JSON array, with the following keys:
- "publication": the full original text of the publication entry
- "title": the publication title (can be in quotes or the main text before publication details)
- "doi": the DOI if written (starts with 10.), otherwise null

Format: [{"publication": "...", "title": "...", "doi": "10.xxxx/..." or null}]

Rules:
- Extract ALL publications, even if titles are not in quotes
- Extract titles from text whether they appear in quotes or as main text before publication details
- DO NOT fabricate or invent DOI numbers - only include if explicitly written starting with 10.
- Return only valid JSON. No markdown, no explanation, no extra output.

TEXT:
"""
${publicationSection}
"""`,
      max_tokens: 1000,
      temperature: 0.3,
    },
    {
      headers: {
        Authorization: `Bearer ${cohereApiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  return JSON.parse(
    cohereResponse.data.generations[0].text
      .trim()
      .replace(/```json|```/g, "")
      .replace(/^[^[{]*(\[.*\])[^}\]]*$/s, "$1")
      .trim()
  );
};

const verifyCV = async (file) => {
  try {
    // Parse PDF to text
    const pdfBuffer = fs.readFileSync(file.path);
    const parsedData = await pdfParse(pdfBuffer);
    const cvText = parsedData.text;

    // Clean up uploaded file
    fs.unlinkSync(file.path);

    // Extract publications
    const publications = await extractPublicationsFromCV(cvText);

    if (!Array.isArray(publications)) {
      throw new Error("Invalid publications array format");
    }

    // Verify each publication with both Google Scholar and Scopus
    const verificationResults = await Promise.all(
      publications.map(async (pub) => {
        const [scholarResult, scopusResult] = await Promise.all([
          verifyWithGoogleScholar(pub.title, pub.author, pub.doi),
          verifyWithScopus(pub.title, pub.author, pub.doi),
        ]);

        // Get the best available link or create a Google Scholar search link
        const scholarLink = scholarResult.details?.link;
        const scopusLink = scopusResult.details?.link;
        const fallbackLink = createGoogleScholarSearchUrl(pub.title);

        return {
          publication: {
            title: pub.title?.trim() || "",
            author: pub.author?.trim() || "",
            doi: pub.doi?.trim() || null,
            fullText: pub.publication?.trim() || "",
          },
          verification: {
            google_scholar: {
              status: scholarResult.status,
              details: scholarResult.details,
              link: scholarLink || fallbackLink,
            },
            scopus: {
              status: scopusResult.status,
              details: scopusResult.details,
              link: scopusLink || fallbackLink,
            },
          },
        };
      })
    );

    return {
      success: true,
      total: verificationResults.length,
      results: verificationResults,
    };
  } catch (error) {
    throw error;
  }
};

const getAuthorDetails = async (authorId, serpApiKey, searchTitle) => {
  // Check cache first
  if (authorCache.has(authorId)) {
    const cachedAuthor = authorCache.get(authorId);
    // Find the matching article in cached author's publications
    const matchingArticle = cachedAuthor.articles?.find((article) => {
      const articleTitle = article.title.toLowerCase().trim();
      const normalizedSearchTitle = searchTitle.toLowerCase().trim();
      return (
        articleTitle === normalizedSearchTitle ||
        articleTitle.includes(normalizedSearchTitle) ||
        normalizedSearchTitle.includes(articleTitle)
      );
    });

    if (matchingArticle) {
      return {
        year: matchingArticle.year,
        details: {
          name: cachedAuthor.name,
          affiliations: cachedAuthor.affiliations,
          interests: cachedAuthor.interests,
          citedBy: matchingArticle.cited_by,
        },
      };
    }
  }

  try {
    const authorApiUrl = `https://serpapi.com/search?engine=google_scholar_author&author_id=${authorId}&api_key=${serpApiKey}`;
    const { data: authorResult } = await axios.get(authorApiUrl);

    // Cache the full author result
    authorCache.set(authorId, {
      name: authorResult.author?.name,
      affiliations: authorResult.author?.affiliations,
      interests: authorResult.author?.interests,
      articles: authorResult.articles,
    });

    // Find the matching article
    const matchingArticle = authorResult.articles?.find((article) => {
      const articleTitle = article.title.toLowerCase().trim();
      const normalizedSearchTitle = searchTitle.toLowerCase().trim();
      return (
        articleTitle === normalizedSearchTitle ||
        articleTitle.includes(normalizedSearchTitle) ||
        normalizedSearchTitle.includes(articleTitle)
      );
    });

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
    console.error("Error fetching author details:", error);
  }

  return null;
};

module.exports = {
  verifyCV,
};
