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

module.exports = {
  getResearcherProfile,
};
