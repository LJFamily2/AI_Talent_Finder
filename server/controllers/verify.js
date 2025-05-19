const axios = require("axios");
const { getTitleSimilarity } = require("../utils/textUtils");

const verifyWithGoogleScholar = async (
  title,
  author,
  doi,
  maxResultsToCheck
) => {
  try {
    const serpApiKey = process.env.GOOGLE_SCHOLAR_API_KEY;
    const scholarQuery = [title, author, doi].filter(Boolean).join(" ");
    const scholarApiUrl = `https://serpapi.com/search.json?engine=google_scholar&q=${encodeURIComponent(
      scholarQuery
    )}&api_key=${serpApiKey}`;

    const { data: scholarResult } = await axios.get(scholarApiUrl);
    const organicResults =
      scholarResult?.organic_results || scholarResult?.items || [];

    if (!organicResults.length) {
      return { status: "not existed", details: null, result: scholarResult };
    }

    const found = organicResults.slice(0, maxResultsToCheck).find((item) => {
      if (doi && item.link?.toLowerCase().includes(doi.toLowerCase()))
        return true;
      if (title && item.title)
        return getTitleSimilarity(title, item.title) > 80;
      return false;
    });

    return found
      ? { status: "verified", details: found, result: scholarResult }
      : { status: "not existed", details: null, result: scholarResult };
  } catch (err) {
    console.error("Google Scholar API error:", err.message);
    return { status: "unable to verify", details: null, result: null };
  }
};

const verifyWithScopus = async (title, author, doi, maxResultsToCheck) => {
  try {
    const scopusAPIKey = process.env.SCOPUS_API_KEY;
    const scopusQuery = [title, author, doi].filter(Boolean).join(" ");
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
      if (doi && item["prism:doi"]?.toLowerCase() === doi.toLowerCase())
        return true;
      if (title && item["dc:title"])
        return getTitleSimilarity(title, item["dc:title"]) > 80;
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
    console.error("Scopus API error:", err.message);
    return {
      status: "unable to verify",
      details: null,
      result: null,
      apiUrl: null,
    };
  }
};

/**
 * Receives publication details and verifies them using Google Scholar and Scopus APIs.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @body { title, author, doi, maxResultsToCheck, googleScholar, scopus }
 */
exports.verifyPublication = async (req, res) => {
  const {
    title,
    author,
    doi,
    maxResultsToCheck = 5,
    googleScholar = true,
    scopus = true,
  } = req.body;

  if (!title && !author && !doi) {
    return res.status(400).json({
      status: "unable to verify",
      message: "No key fields provided.",
    });
  }

  const [scholarVerification, scopusVerification] = await Promise.all([
    googleScholar
      ? verifyWithGoogleScholar(title, author, doi, maxResultsToCheck)
      : null,
    scopus ? verifyWithScopus(title, author, doi, maxResultsToCheck) : null,
  ]);

  const summary = [];
  if (googleScholar) {
    summary.push(
      scholarVerification.status === "verified"
        ? "Verified in Google Scholar"
        : `${
            scholarVerification.status === "not existed"
              ? "Not found"
              : "Unable to verify"
          } in Google Scholar`
    );
  }

  if (scopus) {
    summary.push(
      scopusVerification.status === "verified"
        ? "Verified in Scopus"
        : `${
            scopusVerification.status === "not existed"
              ? "Not found"
              : "Unable to verify"
          } in Scopus`
    );
  }

  return res.json({
    google_scholar: googleScholar
      ? {
          status: scholarVerification.status,
          details: scholarVerification.details,
          scholarResult: scholarVerification.result,
          link:
            (scholarVerification.status === "verified" &&
              scholarVerification.details?.link) ||
            null,
        }
      : null,
    scopus: scopus
      ? {
          status: scopusVerification.status,
          details: scopusVerification.details,
          scopusResult: scopusVerification.result,
          scopusApiUrl: scopusVerification.apiUrl,
          link: scopusVerification.details?.link || null,
        }
      : null,
    summary: summary.join(". "),
  });
};
