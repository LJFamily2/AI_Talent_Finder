const axios = require("axios");
const { getTitleSimilarity } = require("../utils/textUtils");
const {
  checkAuthorNameMatch,
  getAuthorDetails,
} = require("../utils/authorUtils");

const createGoogleScholarSearchUrl = (title) => {
  if (!title) return null;
  const encodedTitle = encodeURIComponent(title);
  return `https://scholar.google.com/scholar?hl=en&as_sdt=0%2C5&q=${encodedTitle}`;
};

const verifyWithGoogleScholar = async (
  title,
  doi,
  candidateName = null,
  maxResultsToCheck = 5
) => {
  try {
    const serpApiKey = process.env.GOOGLE_SCHOLAR_API_KEY;
    const scholarQuery = title;
    const scholarApiUrl = `https://serpapi.com/search?engine=google_scholar&q=${encodeURIComponent(
      scholarQuery
    )}&hl=en&api_key=${serpApiKey}&num=${maxResultsToCheck}`;

    const { data: scholarResult } = await axios.get(scholarApiUrl);
    const organicResults =
      scholarResult?.organic_results || scholarResult?.items || [];

    if (!organicResults.length) {
      return {
        status: "unable to verify",
        details: null,
        result: scholarResult,
      };
    }

    const found = organicResults.find((item) => {
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
        return similarity >= 98;
      }
      return false;
    });

    if (!found) {
      return {
        status: "unable to verify",
        details: null,
        result: scholarResult,
      };
    }

    // Extract all possible author names from the publication
    const extractedAuthors = [];

    // From publication summary (usually most reliable)
    if (found.publication_info?.summary) {
      const summary = found.publication_info.summary;
      const authorPart = summary.split(" - ")[0].trim();
      if (
        authorPart &&
        !authorPart.includes("…") &&
        !authorPart.includes("...")
      ) {
        // Handle "Author1, Author2, ..." format
        const authors = authorPart
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean);
        extractedAuthors.push(...authors);
      }
    }

    // From authors array if available
    if (found.publication_info?.authors?.length > 0) {
      found.publication_info.authors.forEach((author) => {
        if (author.name) {
          extractedAuthors.push(author.name);
        }
      });
    }

    let authorDetails = null;
    let hasAuthorMatch = false;
    let matchedAuthorId = null;

    // Check if candidate name matches any of the extracted authors
    if (candidateName && extractedAuthors.length > 0) {
      hasAuthorMatch = checkAuthorNameMatch(candidateName, extractedAuthors);

      // If we have a match, find the specific author ID for the matched author
      if (hasAuthorMatch && found.publication_info?.authors?.length > 0) {
        // Try to find the specific author that matches the candidate name
        const matchedAuthor = found.publication_info.authors.find((author) => {
          if (!author.name) return false;
          return checkAuthorNameMatch(candidateName, [author.name]);
        });
        if (matchedAuthor && matchedAuthor.author_id) {
          matchedAuthorId = matchedAuthor.author_id;
        } else {
          // Fallback: if we can't find the exact match in the authors array,
          // but we know there's a match somewhere, use the first author with an ID
          const firstAuthorWithId = found.publication_info.authors.find(
            (author) => author.author_id
          );
          if (firstAuthorWithId) {
            matchedAuthorId = firstAuthorWithId.author_id;
          }
        }
      }
    }

    // Only fetch author details if we have a confirmed match and found the author ID
    if (hasAuthorMatch && matchedAuthorId) {
      const authorInfo = await getAuthorDetails(
        matchedAuthorId,
        serpApiKey,
        found.title
      );
      if (authorInfo) {
        authorDetails = authorInfo.details;
      }
    }

    // Determine verification status based on author match
    const verificationStatus = hasAuthorMatch
      ? "verified"
      : "verified but not same author name";

    return {
      status: verificationStatus,
      details: {
        ...found,
        extractedAuthors,
        hasAuthorMatch,
        authorDetails,
      },
      result: scholarResult,
    };
  } catch (err) {
    return { status: "unable to verify", details: null, result: null };
  }
};

module.exports = {
  verifyWithGoogleScholar,
  createGoogleScholarSearchUrl,
};
