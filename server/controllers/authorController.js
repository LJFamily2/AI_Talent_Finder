const axios             = require("axios");
const ResearcherProfile = require("../models/researcherProfile");
const Publication       = require("../models/publication");

const CACHE_TTL = 3600; // in seconds  (1hour for testing)

// GET /api/author
async function searchByAuthor(req, res, next) {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({ error: "Author name is required" });
    }

    const redisClient = req.app.locals.redisClient;
    const cacheKey    = `author:${name.toLowerCase()}`;

    // 1) Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log("Cache HIT for", name); // If hit: return cached payload
      return res.status(200).json(JSON.parse(cached));
    }
    console.log("Cache MISS for", name); // If miss: fetch from OpenAlex and return (no DB write, no cache set)

    // 2) Fetch from OpenAlex
    const searchUrl    = `https://api.openalex.org/authors?search=${encodeURIComponent(name)}`;
    const { data: searchData } = await axios.get(searchUrl);
    const authorRaw    = searchData.results?.[0];
    if (!authorRaw) {
      return res.status(404).json({ error: "Author not found" });
    }

    const authorId     = authorRaw.id.split("/").pop();
    const { data: authorData } = await axios.get(`https://api.openalex.org/authors/${authorId}`);
    const { data: worksData  } = await axios.get(
      `https://api.openalex.org/works?filter=author.id:${authorRaw.id}&per_page=10`
    );

    // Build profile
    const profile = {
      basic_info: {
        name: authorData.display_name,
        email: "unknown@example.com",
        thumbnail: "",
        affiliations: authorData.affiliations?.map(entry => ({
          institution: {
            display_name: entry.institution?.display_name || "",
            ror:          entry.institution?.ror || "",
            years:        entry.years || [],
            id:           entry.institution?.id || "",
            country_code: entry.institution?.country_code || "",
            type:         entry.institution?.type || "",
            lineage:      entry.institution?.lineage || []
          }
        })) || []
      },
      identifiers: {
        scopus:            "",
        openalex:          authorData.id,
        orcid:             authorData.orcid || "",
        google_scholar_id: ""
      },
      research_metrics: {
        h_index:                authorData.summary_stats?.h_index || 0,
        i10_index:              authorData.summary_stats?.i10_index || 0,
        two_year_mean_citedness: authorData.summary_stats?.["2yr_mean_citedness"] || 0,
        total_citations:        authorData.cited_by_count || 0,
        total_works:            authorData.works_count || 0
      },
      research_areas: {
        fields: authorData.x_concepts?.slice(0,5).map(c => ({ display_name: c.display_name })) || [],
        topics: authorData.x_concepts?.slice(0,5).map(c => ({ display_name: c.display_name, count: Math.round(c.score * 100) })) || []
      },
      citation_trends: {
        counts_by_year: authorData.counts_by_year || []
      },
      current_affiliation: authorData.last_known_institution
        ? { display_name: authorData.last_known_institution.display_name, ror: authorData.last_known_institution.ror }
        : {}
    };

    // Build publications
    const publications = worksData.results.map(work => ({
      openalex_id:        work.id,
      doi:                work.doi,
      title:              work.title,
      publication_date:   work.publication_date,
      source:             work.primary_location?.source?.host_organization_name || "",
      volume:             work.biblio?.volume || "",
      issue:              work.biblio?.issue || "",
      page_range:         work.biblio?.first_page && work.biblio?.last_page ? `${work.biblio.first_page}-${work.biblio.last_page}` : "",
      publication_type:   work.type || "",
      issn:               work.primary_location?.source?.issn || "",
      eissn:              work.primary_location?.source?.e_issn || "",
      authors:            work.authorships?.map(a => a.author?.display_name) || [],
      cited_by_count:     work.cited_by_count || 0,
      fwci:               work.metrics?.field_citation_ratio || 0,
      open_access_status: work.open_access?.oa_status || ""
    }));

    // Return without side-effects
    return res.status(200).json({ profile, publications });

  } catch (err) {
    console.error("Error in searchByAuthor:", err);
    next(err);
  }
}

// POST /api/author
// Receive payload { profile, publications }
// Upsert into MongoDB and cache in Redis

async function saveToDatabase(req, res, next) {
  try {
    const { profile, publications } = req.body;
    if (!profile || !publications) {
      return res.status(400).json({ error: "Missing profile or publications" });
    }

    const redisClient = req.app.locals.redisClient;
    const cacheKey    = `author:${profile.basic_info.name.toLowerCase()}`;

    // Insert publications
    let insertedPubs = [];
    try {
      insertedPubs = await Publication.insertMany(publications, { ordered: false });
    } catch (err) {
      if (err.insertedDocs) insertedPubs = err.insertedDocs;
    }

    // Upsert profile with references
    const worksRefs = insertedPubs.map(pub => pub._id);
    const updatedProfile = await ResearcherProfile.findOneAndUpdate(
      { "identifiers.openalex": profile.identifiers.openalex },
      { ...profile, works: worksRefs },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Cache payload
    const payload = { profile: updatedProfile, publications: insertedPubs };
    await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(payload));

    return res.status(200).json({
      message:    "Saved to DB & cached",
      profile:    updatedProfile,
      worksSaved: insertedPubs.length
    });

  } catch (err) {
    console.error("Error in saveToDatabase:", err);
    next(err);
  }
}

module.exports = {
  searchByAuthor,
  saveToDatabase
};
