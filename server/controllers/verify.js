const axios = require("axios");

/**
 * Receives publication details and verifies them using Google Scholar and Scopus APIs.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @body { title, author, doi }
 */
exports.verifyPublication = async (req, res) => {
  const { title, author, doi, maxResultsToCheck } = req.body;
  if (!title && !author && !doi) {
    return res
      .status(400)
      .json({ status: "unable to verify", message: "No key fields provided." });
  }

  // --- Google Scholar via SerpApi ---
  let scholarStatus = "unable to verify";
  let scholarDetails = null;
  let scholarApiUrl = null;
  let scholarResult = null;

  // Helper: create n-grams from text
  function getNGrams(text, n = 2) {
    const ngrams = [];
    for (let i = 0; i < text.length - n + 1; i++) {
      ngrams.push(text.slice(i, i + n));
    }
    return ngrams;
  }

  // Helper: calculate word-based similarity
  function getWordSimilarity(str1, str2) {
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    const commonWords = words1.filter((word) => words2.includes(word));
    return (2.0 * commonWords.length) / (words1.length + words2.length);
  }

  // Helper: normalize academic text (preserving important characters)
  function normalizeText(text) {
    if (!text) return "";
    return (
      text
        .toLowerCase()
        // Preserve important academic symbols but standardize them
        .replace(/[−–—]/g, "-") // Standardize different types of hyphens
        .replace(/['′´`]/g, "'") // Standardize apostrophes
        .replace(/[""″]/g, '"') // Standardize quotes
        .replace(/\s*[-/]\s*/g, "-") // Standardize spacing around hyphens and slashes
        .replace(/\s+/g, " ") // Replace multiple spaces with single space
        .trim()
    );
  }

  // Helper: calculate efficient similarity between two strings
  function getTitleSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;

    // Normalize both strings
    const normalizedStr1 = normalizeText(str1);
    const normalizedStr2 = normalizeText(str2);

    if (normalizedStr1 === normalizedStr2) return 100;

    // Get word-level similarity
    const wordSim = getWordSimilarity(normalizedStr1, normalizedStr2) * 100;

    // If word similarity is very high, return it
    if (wordSim > 90) return wordSim;

    // Otherwise, use n-gram similarity for more detailed comparison
    const ngrams1 = getNGrams(normalizedStr1);
    const ngrams2 = getNGrams(normalizedStr2);

    // Create frequency maps
    const freq1 = {};
    const freq2 = {};

    ngrams1.forEach((ng) => (freq1[ng] = (freq1[ng] || 0) + 1));
    ngrams2.forEach((ng) => (freq2[ng] = (freq2[ng] || 0) + 1));

    // Calculate cosine similarity
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    // Compute dot product and magnitudes
    Object.keys(freq1).forEach((ng) => {
      if (freq2[ng]) {
        dotProduct += freq1[ng] * freq2[ng];
      }
      magnitude1 += freq1[ng] * freq1[ng];
    });

    Object.keys(freq2).forEach((ng) => {
      magnitude2 += freq2[ng] * freq2[ng];
    });

    const similarity =
      (dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2))) * 100;

    // Return weighted average of word and n-gram similarities
    return wordSim * 0.6 + similarity * 0.4;
  }

  try {
    const serpApiKey = process.env.GOOGLE_SCHOLAR_API_KEY;
    let scholarQuery = [title, author, doi].filter(Boolean).join(" ");
    scholarApiUrl = `https://serpapi.com/search.json?engine=google_scholar&q=${encodeURIComponent(
      scholarQuery
    )}&api_key=${serpApiKey}`;
    const scholarRes = await axios.get(scholarApiUrl);
    scholarResult = scholarRes.data;
    const organicResults =
      scholarResult?.organic_results || scholarResult?.items || [];
    if (organicResults.length > 0) {
      const found = organicResults.slice(0, maxResultsToCheck).find((item) => {
        // DOI check
        if (
          doi &&
          item.link &&
          item.link.toLowerCase().includes(doi.toLowerCase())
        ) {
          return true;
        }
        // Title similarity check
        if (title && item.title) {
          const similarity = getTitleSimilarity(title, item.title);
          if (similarity > 80) {
            return true;
          }
        }
        return false;
      });
      if (found) {
        scholarStatus = "verified";
        scholarDetails = found;
      } else {
        scholarStatus = "not existed";
      }
    } else {
      scholarStatus = "not existed";
    }
  } catch (err) {
    scholarStatus = "unable to verify";
    scholarDetails = null;
  }

  // --- Scopus via SerpApi ---
  let scopusStatus = "unable to verify";
  let scopusDetails = null;
  let scopusApiUrl = null;
  let scopusRes = null;
  try {
    const scopusAPIKey = process.env.SCOPUS_API_KEY;
    let scopusQuery = [title, author, doi].filter(Boolean).join(" ");
    scopusApiUrl = `https://api.elsevier.com/content/search/scopus?query=${encodeURIComponent(
      scopusQuery
    )}&apiKey=${scopusAPIKey}&sortBy=relevance`;
    const scopusRes = await axios.get(scopusApiUrl);
    const scopusResult = scopusRes.data;
    if (scopusResult?.organic_results?.length > 0) {
      const found = scopusResult.organic_results.find((item) => {
        if (
          doi &&
          item.link &&
          item.link.toLowerCase().includes(doi.toLowerCase())
        ) {
          return true;
        }
        if (title && item.title) {
          // Calculate percentage match between title and item.title
          const normalize = (str) =>
            str.replace(/\s+/g, " ").trim().toLowerCase();
          const userTitle = normalize(title);
          const resultTitle = normalize(item.title);
          // Simple similarity: count matching chars in order
          let matchCount = 0;
          for (
            let i = 0, j = 0;
            i < userTitle.length && j < resultTitle.length;

          ) {
            if (userTitle[i] === resultTitle[j]) {
              matchCount++;
              i++;
              j++;
            } else {
              j++;
            }
          }
          const percent = (matchCount / userTitle.length) * 100;
          return percent >= 95;
        }
        return false;
      });
      if (found) {
        scopusStatus = "verified";
        scopusDetails = found;
      } else {
        scopusStatus = "not existed";
      }
    } else {
      scopusStatus = "not existed";
    }
  } catch (err) {
    scopusStatus = "unable to verify";
    scopusDetails = null;
  }

  // --- Compose Response ---
  const summary = [];
  summary.push(
    scholarStatus === "verified"
      ? "Verified in Google Scholar"
      : scholarStatus === "not existed"
      ? "Not found in Google Scholar"
      : "Unable to verify in Google Scholar"
  );
  summary.push(
    scopusStatus === "verified"
      ? "Verified in Scopus"
      : scopusStatus === "not existed"
      ? "Not found in Scopus"
      : "Unable to verify in Scopus"
  );

  return res.json({
    google_scholar: {
      status: scholarStatus,
      details: scholarDetails,
      link:
        scholarStatus === "verified" && scholarDetails && scholarDetails.link
          ? scholarDetails.link
          : null,
    },
    scopus: { status: scopusStatus, details: scopusDetails,scopusRes: scopusRes, scopusApiUrl },
    summary: summary.join(". "),
  });
};
