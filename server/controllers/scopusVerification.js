const axios = require("axios");
const { getTitleSimilarity } = require("../utils/textUtils");
const { checkAuthorNameMatch } = require("../utils/authorUtils");

const verifyWithScopus = async (
  title,
  doi,
  candidateName = null,
  maxResultsToCheck = 5
) => {
  try {
    const scopusAPIKey = process.env.SCOPUS_API_KEY;
    const scopusInsttoken = process.env.SCOPUS_INSTTOKEN;
    const scopusQuery = title;
    const scopusApiUrl = `https://api.elsevier.com/content/search/scopus?apiKey=${scopusAPIKey}&insttoken=${scopusInsttoken}&query=TITLE-ABS-KEY(${encodeURIComponent(
      scopusQuery
    )})&page=1&sortBy=relevance&view=COMPLETE&count=${maxResultsToCheck}`;

    const { data: scopusResult } = await axios.get(scopusApiUrl);
    const entries = scopusResult?.["search-results"]?.entry || [];
    if (!entries.length) {
      return {
        status: "unable to verify",
        details: null,
        result: scopusResult,
        apiUrl: scopusApiUrl,
      };
    } // Log search query and result count for debugging
    const found = entries.find((item) => {
      // Exact DOI match takes precedence
      if (doi && item["prism:doi"]?.toLowerCase() === doi.toLowerCase()) {
        return true;
      }

      if (title && item["dc:title"]) {
        const normalizedTitle = title.toLowerCase().trim();
        const normalizedItemTitle = item["dc:title"].toLowerCase().trim();
        const similarity = getTitleSimilarity(
          normalizedTitle,
          normalizedItemTitle
        );

        // Log similarity for debugging

        // Only verify if the similarity is very high (98%+) and titles have reasonable length
        const titleLengthRatio =
          Math.min(normalizedTitle.length, normalizedItemTitle.length) /
          Math.max(normalizedTitle.length, normalizedItemTitle.length);
        if (similarity >= 98 && titleLengthRatio >= 0.8) {
          return true;
        }
      }
      return false;
    });

    if (!found) {
      return {
        status: "unable to verify",
        details: null,
        result: scopusResult,
        apiUrl: scopusApiUrl,
      };
    }

    // Extract author information and check for match
    const extractedAuthors = [];
    let hasAuthorMatch = false;

    if (found["dc:creator"]) {
      extractedAuthors.push(found["dc:creator"]);
    }

    // Check for additional authors in author list (if available)
    if (found.author) {
      found.author.forEach((author) => {
        if (author["ce:indexed-name"]) {
          extractedAuthors.push(author["ce:indexed-name"]);
        }
        if (
          author["preferred-name"]?.["ce:given-name"] &&
          author["preferred-name"]?.["ce:surname"]
        ) {
          const fullName = `${author["preferred-name"]["ce:given-name"]} ${author["preferred-name"]["ce:surname"]}`;
          extractedAuthors.push(fullName);
        }
      });
    }

    // Check if candidate name matches any of the extracted authors
    if (candidateName && extractedAuthors.length > 0) {
      hasAuthorMatch = checkAuthorNameMatch(candidateName, extractedAuthors);
    }

    // Get the Scopus link from the array of links
    const scopusLink = found.link?.find((link) => link["@ref"] === "scopus")?.[
      "@href"
    ];

    // Keep all original fields from the Scopus API response
    const details = {
      ...found,
      extractedAuthors,
      hasAuthorMatch,
      // Ensure the scopus link is properly set if available
      link: found.link?.map((link) => ({
        ...link,
        "@href": link["@ref"] === "scopus" ? scopusLink : link["@href"],
      })),
    };

    // Determine verification status based on author match
    const verificationStatus = hasAuthorMatch
      ? "verified"
      : "verified but not same author name";

    return {
      status: verificationStatus,
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

module.exports = {
  verifyWithScopus,
};
