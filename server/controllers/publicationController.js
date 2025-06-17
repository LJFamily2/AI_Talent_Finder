const axios = require("axios");
const Publication = require("../models/publication");

// === 🔍 Helper: Get Google Scholar author details ===
const getScholarAuthorDetails = async (authorId, apiKey) => {
  if (!authorId) return {};
  try {
    const url = `https://serpapi.com/search?engine=google_scholar_author&author_id=${authorId}&api_key=${apiKey}`;
    const { data } = await axios.get(url);

    return {
      affiliation: data?.author?.affiliations || null,
      orcid: data?.author?.orcid || null
    };
  } catch (err) {
    console.error(`Failed to fetch scholar author ${authorId}:`, err.message);
    return {};
  }
};

const searchAndSavePublications = async (req, res) => {
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: "Keyword required" });

  const results = [];

  // === 🔎 GOOGLE SCHOLAR ===
  try {
    const serpApiKey = process.env.GOOGLE_SCHOLAR_API_KEY;
    const url = `https://serpapi.com/search?engine=google_scholar&q=${encodeURIComponent(keyword)}&api_key=${serpApiKey}`;
    const { data } = await axios.get(url);
    const publications = data.organic_results || [];

    for (const item of publications) {
      const authorsArray = [];

      if (item.publication_info?.authors?.length) {
        for (const author of item.publication_info.authors) {
          const details = await getScholarAuthorDetails(author.author_id, serpApiKey);
          authorsArray.push({
            name: author.name || null,
            id: author.author_id || null,
            affiliation: details.affiliation || null,
            orcid: details.orcid || null
          });
        }
      }

      const pub = {
        id: item.result_id || item.title,
        title: item.title,
        doi: item.link?.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i)?.[0]?.trim() || null,
        url: item.link || null,
        link: item.link || null,

        journal_name: item.publication_info?.journal || null,
        publication_type: item.type || null,
        cited_by_count: parseInt(item.inline_links?.cited_by?.total || "0"),
        authors: authorsArray.length ? authorsArray : undefined,
        source_api: "scholar",

        // Leave these blank for now
        volume: null,
        issue: null,
        page_range: null,
        article_number: null,
        language: null,
        eissn: null,
        issn: null,
        abstract: null,
        topics: [],
        citation_percentile: null,
        open_access_status: null,
        fwci: null,
        external_ids: { openalex: null }
      };

      if (!pub.id || !pub.title) continue;

      const result = await Publication.updateOne(
        { id: pub.id },
        { $setOnInsert: pub },
        { upsert: true }
      );

      console.log(
        result.upsertedCount > 0
          ? `✅ Saved (Scholar): ${pub.title}`
          : `⚠️ Exists (Scholar): ${pub.title}`
      );

      results.push(pub);
    }
  } catch (err) {
    console.error("Google Scholar error:", err.message);
  }

  // === 📡 SCOPUS ===
  try {
    const scopusApiKey = process.env.SCOPUS_API_KEY;
    const scopusUrl = `https://api.elsevier.com/content/search/scopus?apiKey=${scopusApiKey}&query=TITLE-ABS-KEY(${encodeURIComponent(keyword)})&sortBy=relevance`;
    const { data } = await axios.get(scopusUrl);
    const entries = data["search-results"]?.entry || [];

    for (const entry of entries) {
      const authorsArray =
        entry.author?.map((a) => ({
          name: a.given_name && a.surname ? `${a.given_name} ${a.surname}` : a.name || null,
          id: a.authid || null,
          affiliation: a.affiliation || null,
          orcid: a.orcid || null
        })) || [];

      const pub = {
        id: entry["dc:identifier"] || entry["eid"],
        title: entry["dc:title"],
        doi: entry["prism:doi"] || null,
        url: entry["prism:url"] || null,
        link: entry.link?.find((l) => l["@ref"] === "scopus")?.["@href"] || null,

        publication_date: entry["prism:coverDate"]
          ? new Date(entry["prism:coverDate"])
          : null,
        journal_name: entry["prism:publicationName"] || null,
        volume: entry["prism:volume"] || null,
        issue: entry["prism:issueIdentifier"] || null,
        page_range: entry["prism:pageRange"] || null,
        article_number: entry["article-number"] || null,
        publication_type: entry["subtypeDescription"] || null,
        language: entry["language"] || null,
        issn: entry["prism:issn"] || null,
        eissn: entry["prism:eissn"] || null,
        cited_by_count: parseInt(entry["citedby-count"] || "0"),
        authors: authorsArray.length ? authorsArray : undefined,
        abstract: entry["dc:description"] || null,
        topics: [], // Placeholder
        citation_percentile: null,
        open_access_status: null,
        fwci: null,
        source_api: "scopus",
        external_ids: { openalex: null }
      };

      if (!pub.id || !pub.title) continue;

      const result = await Publication.updateOne(
        { id: pub.id },
        { $setOnInsert: pub },
        { upsert: true }
      );

      console.log(
        result.upsertedCount > 0
          ? `✅ Saved (Scopus): ${pub.title}`
          : `⚠️ Exists (Scopus): ${pub.title}`
      );

      results.push(pub);
    }
  } catch (err) {
    console.error("Scopus error:", err.message);
  }

  return res.json({ success: true, count: results.length, data: results });
};

module.exports = { searchAndSavePublications };
