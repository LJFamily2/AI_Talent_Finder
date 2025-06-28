const axios = require("axios");
const mongoose = require("mongoose");
const ResearcherProfile = require("../models/researcherProfile");
const Publication = require("../models/publication");


const searchByAuthor = async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: "Author name is required" });

  try {
    // Step 1: Search author by name
    const searchUrl = `https://api.openalex.org/authors?search=${encodeURIComponent(name)}`;
    const { data: searchData } = await axios.get(searchUrl);
    const authorRaw = searchData.results?.[0];
    if (!authorRaw) return res.status(404).json({ error: "Author not found" });

    const authorId = authorRaw.id?.split("/").pop();

    // Step 2: Get full author details
    const { data: authorData } = await axios.get(`https://api.openalex.org/authors/${authorId}`);
    const { data: worksData } = await axios.get(`https://api.openalex.org/works?filter=author.id:${authorRaw.id}&per_page=10`);

    // Build researcher profile (OpenAlex only for now)
    const profile = {
      basic_info: {
        name: authorData.display_name,
        email: "unknown@example.com", // from Google Scholar (not available here)
        thumbnail: "", // from Google Scholar (not available here)
        affiliations: authorData.affiliations?.map(entry => ({
          institution: {
            display_name: entry.institution?.display_name || "",
            ror: entry.institution?.ror || "",
            years: entry.years || [],
            id: entry.institution?.id || "",
            country_code: entry.institution?.country_code || "",
            type: entry.institution?.type || "",
            lineage: entry.institution?.lineage || []
          }
        })) || []
      },
      identifiers: {
        scopus: "", // To be filled via Scopus
        openalex: authorData.id,
        orcid: authorData.orcid || "",
        google_scholar_id: "" // To be filled via Google Scholar
      },
      research_metrics: {
        h_index: authorData.summary_stats?.h_index || 0,
        i10_index: authorData.summary_stats?.i10_index || 0,
        two_year_mean_citedness: authorData.summary_stats?.["2yr_mean_citedness"] || 0,
        total_citations: authorData.cited_by_count || 0,
        total_works: authorData.works_count || 0
      },
      research_areas: {
        fields: authorData.x_concepts?.slice(0, 5).map(c => ({
          display_name: c.display_name
        })) || [],
        topics: authorData.x_concepts?.slice(0, 5).map(c => ({
          display_name: c.display_name,
          count: Math.round(c.score * 100) // Score approx to count
        })) || []
      },
      works: [], // to be filled after publications are saved
      citation_trends: {
        cited_by_table: authorData.counts_by_year || {},
        cited_by_graph: authorData.summary_stats || {},
        counts_by_year: authorData.counts_by_year || []
      },
      current_affiliation: authorData.last_known_institution ? {
        institution: authorData.last_known_institution.display_name,
        display_name: authorData.last_known_institution.display_name,
        ror: authorData.last_known_institution.ror
      } : {}
    };

    // Build publication list (OpenAlex)
    const publications = worksData.results.map(work => ({
      id: work.id,
      doi: work.doi,
      title: work.title,
      publication_date: work.publication_date,
      publicationLocation: work.primary_location?.source?.host_organization_name || "",
      volume: work.biblio?.volume || "",
      issue: work.biblio?.issue || "",
      page_range: work.biblio?.first_page && work.biblio?.last_page
        ? `${work.biblio.first_page}-${work.biblio.last_page}`
        : "",
      article_number: "", // Not available from OpenAlex
      publication_type: work.type || "",
      eissn: work.primary_location?.source?.e_issn || "",
      issn: work.primary_location?.source?.issn || "",
      authors: work.authorships?.map(a => ({
        name: a.author?.display_name || "",
        id: a.author?.id || "",
        affiliation: a.institutions?.[0]?.display_name || "",
        orcid: a.author?.orcid || ""
      })) || [],
      cited_by_count: work.cited_by_count || 0,
      citation_percentile: work.biblio?.citation_normalized_percentile || 0,
      open_access_status: work.open_access?.oa_status || "",
      fwci: work.metrics?.field_citation_ratio || 0
    }));

    return res.status(200).json({ profile, publications });

  } catch (err) {
    console.error("❌ Error searching author:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};


const saveToDatabase = async (req, res) => {
  const { profile, publications } = req.body;

  if (!profile || !publications) {
    return res.status(400).json({ error: "Missing profile or publications" });
  }

  let insertedPublications = [];

  try {
    insertedPublications = await Publication.insertMany(publications, { ordered: false });
  } catch (err) {
    console.warn("Skipping duplicates:", err.message);
    if (err.insertedDocs) {
      insertedPublications = err.insertedDocs;
    }
  }

  try {
    const pubIds = insertedPublications.map(pub => ({
      workID: [pub._id]
    }));

    const newProfile = new ResearcherProfile({
      ...profile,
      works: pubIds
    });

    await newProfile.save();

    return res.status(200).json({
      message: "Saved to DB",
      profile: newProfile,
      worksSaved: insertedPublications.length
    });

  } catch (err) {
    console.error("❌ Error saving to DB:", err.message);
    return res.status(500).json({ error: "Save failed" });
  }
};


module.exports = {
  searchByAuthor,
  saveToDatabase
};
