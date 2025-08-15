const axios = require("axios");
const researcherProfile = require("../models/researcherProfileModel");

// Get a single researcher profile by ID
const getResearcherProfile = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Please provide a researcher ID",
      });
    }

    // Fetch researcher data
    const researcher = await researcherProfile.findById(id);

    if (!researcher) {
      return res.status(404).json({
        success: false,
        message: "Researcher not found",
      });
    }

    res.status(200).json({
      success: true,
      data: researcher,
    });
  } catch (error) {
    console.error("Error fetching researcher profile:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching researcher profile",
      error: error.message,
    });
  }
};

// Get researcher works from OpenAlex
const getResearcherWorks = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Please provide a researcher ID",
      });
    }

    // Build OpenAlex API URL for works
    const apiKey = process.env.OPENALEX_API_KEY;
    const baseUrl = "https://api.openalex.org/works";
    const selectFields =
      "id,doi,title,display_name,publication_year,type,type_crossref,authorships,primary_location,cited_by_count,biblio,open_access,best_oa_location,topics,counts_by_year";
    const filter = `authorships.author.id:${id}`;
    const perPage = 200;

    let url = `${baseUrl}?select=${selectFields}&filter=${filter}&per_page=${perPage}`;

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

    // Return the works data
    res.status(200).json({
      success: true,
      data: response.data,
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
};

module.exports = {
  getResearcherProfile,
  getResearcherWorks,
};
