const axios = require("axios");
const ResearcherProfile = require("../models/researcherProfile");
const Publication = require("../models/publication");

const searchByAuthor = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Author name is required" });

  try {
    const openAlexUrl = `https://api.openalex.org/authors?search=${encodeURIComponent(name)}`;
    const authorData = await axios.get(openAlexUrl);
    const author = authorData.data.results?.[0];
    if (!author) return res.status(404).json({ error: "No author found" });

    const profile = {
      basic_info: {
        name: author.display_name,
        email: author.email || "N/A",
        thumbnail: author.image_url || null,
        affiliations: author.last_known_institution ? [{
          institution: {
            display_name: author.last_known_institution.display_name,
            years: "N/A",
            ror: author.last_known_institution.ror
          }
        }] : []
      },
      identifiers: {
        openalex: author.id,
        orcid: author.orcid || null,
        google_scholar_id: author.ids?.google_scholar || null
      },
      research_metrics: {
        h_index: author.summary_stats?.h_index,
        i10_index: author.i10_index,
        two_year_mean_citedness: author.summary_stats?.two_year_mean_citedness,
        total_citations: author.summary_stats?.cited_by_count,
        total_works: author.works_count
      },
      research_areas: {
        fields: author.x_concepts?.map(x => ({ display_name: x.display_name })) || [],
        topics: []
      },
      works: [],
      citation_trends: {
        cited_by_table: null,
        cited_by_graph: null,
        counts_by_year: []
      },
      current_affiliation: {
        institution: author.last_known_institution?.display_name || null,
        display_name: author.last_known_institution?.display_name || null,
        ror: author.last_known_institution?.ror || null
      }
    };

    // Fetch works by this author
    const worksRes = await axios.get(`https://api.openalex.org/works?filter=author.id:${author.id}`);
    const works = worksRes.data.results;

    for (const work of works) {
      const pub = {
        id: work.id,
        title: work.title,
        doi: work.doi,
        url: work.url,
        link: work.primary_location?.source?.url || null,
        publication_date: work.publication_date,
        journal_name: work.host_venue?.display_name,
        volume: work.biblio?.volume,
        issue: work.biblio?.issue,
        page_range: work.biblio?.pages,
        article_number: work.biblio?.article_number,
        publication_type: work.type,
        language: work.language,
        issn: work.host_venue?.issn?.[0],
        eissn: null,
        authors: work.authorships?.map(a => ({
          id: a.author?.id,
          affiliation: a.institutions?.[0]?.display_name,
          orcid: a.author?.orcid
        })),
        abstract: work.abstract_inverted_index ? Object.keys(work.abstract_inverted_index).join(" ") : null,
        topics: work.concepts?.map(c => ({
          id: c.id,
          display_name: c.display_name,
          score: c.score
        })),
        cited_by_count: work.cited_by_count,
        citation_percentile: null,
        open_access_status: work.open_access?.oa_status,
        fwci: null,
        source_api: "openalex",
        external_ids: {
          openalex: work.id
        }
      };

      const savedPub = await Publication.findOneAndUpdate(
        { id: pub.id },
        { $set: pub },
        { upsert: true, new: true }
      );

      profile.works.push({ workID: [savedPub._id] });
    }

    await ResearcherProfile.create(profile);
    return res.status(200).json({ profile, works: profile.works });

  } catch (err) {
    console.error("Author search error:", err.message);
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = { searchByAuthor };
