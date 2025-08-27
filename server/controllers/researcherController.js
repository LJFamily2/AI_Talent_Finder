const axios = require("axios");
const Researcher = require("../models/Researcher");

module.exports = {
  getResearcherProfile,
  getResearcherWorks,
};

// Get a single researcher profile by ID
async function getResearcherProfile(req, res) {
  try {
    const { slug } = req.params;

    // Validate slug
    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Please provide a researcher slug",
      });
    }

    // Fetch researcher data by slug
    const researcher = await Researcher.findOne({ slug })
      .populate({
        path: "topics",
        model: "Topic",
        populate: { path: "field_id", model: "Field" },
      })
      .populate({ path: "last_known_affiliations", model: "Institution" })
      .populate({ path: "affiliations.institution", model: "Institution" })
      .lean();

    if (!researcher) {
      return res.status(404).json({
        success: false,
        message: "Researcher not found",
      });
    }

    // Group topics by field
    const fieldTopicsMap = new Map();
    researcher.topics?.forEach((topic) => {
      const fieldName = topic.field_id?.display_name || "Uncategorized";
      if (!fieldTopicsMap.has(fieldName)) {
        fieldTopicsMap.set(fieldName, []);
      }
      fieldTopicsMap.get(fieldName).push({
        display_name: topic.display_name,
      });
    });

    // Convert map to array format for fields with their topics
    const fieldsWithTopics = Array.from(fieldTopicsMap.entries()).map(
      ([fieldName, topics]) => ({
        display_name: fieldName,
        topics: topics,
      })
    );

    // Transform data to match PDF exporter expected structure
    const transformedData = {
      basic_info: {
        name: researcher.name || "Unknown",
        affiliations: researcher.affiliations.map((aff) => ({
          institution: {
            display_name:
              aff.institution?.display_name || "Unknown Institution",
          },
        })),
      },
      identifiers: {
        orcid: researcher.identifiers?.orcid || "",
        openalex: researcher.identifiers?.openalex || "",
      },
      research_metrics: {
        h_index: researcher.research_metrics?.h_index || 0,
        i10_index: researcher.research_metrics?.i10_index || 0,
        two_year_mean_citedness:
          researcher.research_metrics?.two_year_mean_citedness || 0,
        total_citations: researcher.research_metrics?.total_citations || 0,
        total_works: researcher.research_metrics?.total_works || 0,
      },
      research_areas: {
        fields: fieldsWithTopics,
        topics: [], // Remove topics as a separate section
      },
      citation_trends: {
        counts_by_year: researcher.citation_trends || [],
      },
      current_affiliation: {
        display_name:
          researcher.last_known_affiliations?.[0]?.display_name ||
          "Unknown Institution",
      },
      current_affiliations:
        researcher.last_known_affiliations?.map((inst) => ({
          display_name: inst.display_name,
        })) || [],
    };

    res.status(200).json({
      success: true,
      data: transformedData,
    });
  } catch (error) {
    console.error("Error fetching researcher profile:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching researcher profile",
      error: error.message,
    });
  }
}

// Get researcher works from OpenAlex with pagination
async function getResearcherWorks(req, res) {
  try {
    const { id } = req.params;
    const { page = 1, per_page = 20 } = req.query;

    // Validate ID
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Please provide a researcher ID",
      });
    }

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page));
    const perPage = Math.min(200, Math.max(1, parseInt(per_page))); // Max 200 per OpenAlex limits

    // Build OpenAlex API URL for works with pagination
    const apiKey = process.env.OPENALEX_API_KEY;
    const baseUrl = "https://api.openalex.org/works";
    const selectFields =
      "id,doi,title,display_name,publication_year,type,type_crossref,authorships,primary_location,cited_by_count,biblio,open_access,best_oa_location,topics,counts_by_year";
    const filter = `authorships.author.id:${id}`;

    const url = `${baseUrl}?select=${selectFields}&filter=${filter}&per_page=${perPage}&page=${pageNum}`;

    // Prepare headers
    const headers = {
      "User-Agent": "AI Talent Finder (mailto:s3977794@rmit.edu.vn)",
    };

    // Add API key if available
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    // Make request to OpenAlex API
    const response = await axios.get(url, {
      timeout: 30000,
      headers,
    });

    const data = response.data;

    // Return the paginated works data
    res.status(200).json({
      success: true,
      data: {
        meta: {
          count: data.meta?.count || 0,
          page: pageNum,
          per_page: perPage,
          total_pages: Math.ceil((data.meta?.count || 0) / perPage),
          db_response_time_ms: data.meta?.db_response_time_ms,
        },
        results: data.results || [],
      },
    });
  } catch (error) {
    console.error("Error fetching researcher works:", error);

    // Handle axios errors specifically
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: "OpenAlex API error",
        error: error.response.data || error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error fetching researcher works",
      error: error.message,
    });
  }
}
