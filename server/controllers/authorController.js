const axios             = require("axios");
const ResearcherProfile = require("../models/researcherProfile");
const Publication       = require("../models/publication");

const CACHE_TTL = 3600; // 1 hour in seconds

/**
 * GET /api/author/search-author?name=Beth%20Rosenberg
 * - Nếu đã cache under "researcher profiles:<lowercase-name>" thì trả ngay
 * - Nếu không, fetch từ OpenAlex, build profile + publications, trả cho client (chưa side-effect)
 */
async function searchByAuthor(req, res, next) {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({ error: "Author name is required" });
    }

    const redisClient = req.app.locals.redisClient;
    const nameKey     = name.toLowerCase();
    const authorKey   = `researcher profiles:${nameKey}`;
    const pubsKey     = `researcher publications:${nameKey}`;

    // 1) Check cache profile+publications
    const cached = await redisClient.get(authorKey);
    if (cached) {
      console.log("Cache HIT for", name);
      return res.status(200).json(JSON.parse(cached));
    }
    console.log("Cache MISS for", name);

    // 2) Fetch từ OpenAlex
    const searchUrl   = `https://api.openalex.org/authors?search=${encodeURIComponent(name)}`;
    const { data: s } = await axios.get(searchUrl);
    const authorRaw   = s.results?.[0];
    if (!authorRaw) {
      return res.status(404).json({ error: "Author not found" });
    }

    const authorId   = authorRaw.id.split("/").pop();
    const { data: a } = await axios.get(`https://api.openalex.org/authors/${authorId}`);
    const { data: w } = await axios.get(
      `https://api.openalex.org/works?filter=author.id:${authorRaw.id}&per_page=10`
    );

    // 3) Build profile
    const profile = {
      basic_info: {
        name:         a.display_name,
        email:        "unknown@example.com",
        thumbnail:    "",
        affiliations: (a.affiliations || []).map(entry => ({
          institution: {
            display_name: entry.institution?.display_name || "",
            ror:           entry.institution?.ror           || "",
            id:            entry.institution?.id            || "",
            country_code:  entry.institution?.country_code  || "",
            type:          entry.institution?.type          || "",
            years:         entry.years                      || [],
            lineage:       entry.institution?.lineage       || []
          }
        }))
      },
      identifiers: {
        openalex:          a.id,
        orcid:             a.orcid            || "",
        google_scholar_id: ""
      },
      research_metrics: {
        h_index:                 a.summary_stats?.h_index                || 0,
        i10_index:               a.summary_stats?.i10_index              || 0,
        two_year_mean_citedness: a.summary_stats?.["2yr_mean_citedness"] || 0,
        total_citations:         a.cited_by_count                        || 0,
        total_works:             a.works_count                           || 0
      },
      research_areas: {
        fields: (a.x_concepts || []).slice(0,5).map(c => ({ display_name: c.display_name })),
        topics: (a.x_concepts || []).slice(0,5)
                  .map(c => ({ display_name: c.display_name, count: Math.round(c.score * 100) }))
      },
      citation_trends: {
        counts_by_year: a.counts_by_year || []
      },
      current_affiliation: a.last_known_institution
        ? {
            display_name: a.last_known_institution.display_name,
            ror:          a.last_known_institution.ror
          }
        : {}
    };

    // 4) Build publications array
    const publications = (w.results || []).map(work => ({
      id:               work.id.split("/").pop(),
      openalex_id:      work.id,
      doi:              work.doi || "",
      title:            work.title,
      publication_date: work.publication_date,
      source:           work.primary_location?.source?.host_organization_name || "",
      volume:           work.biblio?.volume || "",
      issue:            work.biblio?.issue  || "",
      page_range:       (work.biblio?.first_page && work.biblio?.last_page)
                          ? `${work.biblio.first_page}-${work.biblio.last_page}`
                          : "",
      publication_type: work.type || "",
      issn:             work.primary_location?.source?.issn   || [],
      eissn:            work.primary_location?.source?.e_issn || "",
      authors:          (work.authorships || []).map(a => a.author?.display_name),
      cited_by_count:   work.cited_by_count  || 0,
      fwci:             work.metrics?.field_citation_ratio || 0,
      open_access_status: work.open_access?.oa_status || ""
    }));

    // 5) Trả về client trước khi upsert & cache
    return res.status(200).json({ profile, publications });

  } catch (err) {
    console.error("Error in searchByAuthor:", err);
    next(err);
  }
}


/**
 * POST /api/author/save-profile
 * Body: { profile, publications }
 *   - InsertMany publications (bật log validation error)
 *   - Upsert ResearcherProfile
 *   - Cache 2 key: researcher profiles:<name>, researcher publications:<name>
 */
async function saveToDatabase(req, res, next) {
  try {
    const { profile, publications } = req.body;
    if (!profile || !Array.isArray(publications)) {
      return res.status(400).json({ error: "Missing profile or publications" });
    }

    // 1) Insert publications (ignore duplicates)
    let insertedPubs = [];
    try {
      insertedPubs = await Publication.insertMany(publications, { ordered: false });
    } catch (err) {
      console.error("❌ insertMany validation error:", err);
      if (err.insertedDocs) {
        insertedPubs = err.insertedDocs;
      }
    }
    const worksRefs = insertedPubs.map(pub => pub._id);

    // 2) Upsert researcher profile
    const updateDoc = {
      basic_info:          profile.basic_info,
      identifiers:         profile.identifiers,
      research_metrics:    profile.research_metrics,
      research_areas:      profile.research_areas,
      citation_trends:     profile.citation_trends,
      current_affiliation: profile.current_affiliation,
      works:               worksRefs
    };

    const updatedProfile = await ResearcherProfile.findOneAndUpdate(
      { "identifiers.openalex": profile.identifiers.openalex },
      { $set: updateDoc },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 3) Cache kết quả dưới 2 key
    const nameKey   = profile.basic_info.name.toLowerCase();
    const authorKey = `researcher profiles:${nameKey}`;
    const pubsKey   = `researcher publications:${nameKey}`;

    // full payload → researcher profiles:<name>
    await req.app.locals.redisClient.setEx(
      authorKey,
      CACHE_TTL,
      JSON.stringify({ profile: updatedProfile, publications: insertedPubs })
    );
    console.log("✅ Cached author under", authorKey);

    // chỉ publications → researcher publications:<name>
    await req.app.locals.redisClient.setEx(
      pubsKey,
      CACHE_TTL,
      JSON.stringify({ publications: insertedPubs })
    );
    console.log("✅ Cached publications under", pubsKey);

    // 4) Trả về client
    return res.status(200).json({
      message:      "Saved to DB & cached",
      profile:      updatedProfile,
      publications: insertedPubs
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
