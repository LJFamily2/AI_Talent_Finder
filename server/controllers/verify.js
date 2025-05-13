const axios = require("axios");

/**
 * Receives publication details and verifies them using Google Scholar and Scopus APIs.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @body { title, author, doi }
 */
exports.verifyPublication = async (req, res) => {
  const { title, author, doi } = req.body;
  if (!title && !author && !doi) {
    return res
      .status(400)
      .json({ status: "unable to verify", message: "No key fields provided." });
  }

  // --- Google Scholar via SerpApi ---
  let scholarStatus = "unable to verify";
  let scholarDetails = null;
  let scholarApiUrl = null;
  try {
    const serpApiKey = process.env.GOOGLE_SCHOLAR_API_KEY;
    let scholarQuery = [title, author, doi].filter(Boolean).join(" ");
    scholarApiUrl = `https://serpapi.com/search.json?engine=google_scholar&q=${encodeURIComponent(
      scholarQuery
    )}&api_key=${serpApiKey}`;
    const scholarRes = await axios.get(scholarApiUrl);
    const scholarResult = scholarRes.data;
    if (scholarResult?.items?.length > 0) {
      const found = scholarResult.items.find(
        (item) =>
          (doi && item.doi && item.doi.toLowerCase() === doi?.toLowerCase()) ||
          (title &&
            item.title &&
            item.title.toLowerCase() === title.toLowerCase())
      );
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
  try {
    const scopusAPIKey = process.env.SCOPUS_API_KEY;
    let scopusQuery = [title, author, doi].filter(Boolean).join(" ");
    scopusApiUrl = `https://api.elsevier.com/content/search/scopus?query=${encodeURIComponent(
      scopusQuery
    )}&apiKey=${scopusAPIKey}&sortBy=relevance`;
    const scopusRes = await axios.get(scopusApiUrl);
    const scopusResult = scopusRes.data;
    if (scopusResult?.organic_results?.length > 0) {
      const found = scopusResult.organic_results.find(item => {
        if (doi && item.link && item.link.toLowerCase().includes(doi.toLowerCase())) {
          return true;
        }
        if (title && item.title) {
          // Calculate percentage match between title and item.title
          const normalize = str => str.replace(/\s+/g, ' ').trim().toLowerCase();
          const userTitle = normalize(title);
          const resultTitle = normalize(item.title);
          // Simple similarity: count matching chars in order
          let matchCount = 0;
          for (let i = 0, j = 0; i < userTitle.length && j < resultTitle.length;) {
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
    google_scholar_url: scholarApiUrl,
    scopus_url: scopusApiUrl,
    google_scholar: { status: scholarStatus, details: scholarDetails },
    scopus: { status: scopusStatus, details: scopusDetails },
    summary: summary.join(". "),
  });
};
