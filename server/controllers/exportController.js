const excel = require("exceljs");
const researcherProfile = require("../models/researcherProfileModel");

const exportResearchersToExcel = async (req, res) => {
  try {
    const { researcherIds } = req.body;

    // Validate researcherIds
    if (
      !researcherIds ||
      !Array.isArray(researcherIds) ||
      researcherIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of researcher IDs",
      });
    }

    // Fetch researchers data
    const researchers = await researcherProfile.find({
      _id: { $in: researcherIds },
    });

    if (!researchers || researchers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No researchers found",
      });
    }

    // Create workbook and worksheet
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet("Researchers");

    // Define columns
    worksheet.columns = [
      { header: "Name", key: "name" },
      { header: "Institution", key: "institution" },
      { header: "Institution ROR", key: "institutionRor" },
      { header: "Institution Country", key: "institutionCountry" },
      { header: "Institution Years", key: "institutionYears" },
      { header: "Scopus ID", key: "scopusId" },
      { header: "OpenAlex ID", key: "openalexId" },
      { header: "ORCID", key: "orcid" },
      { header: "Google Scholar ID", key: "googleScholarId" },
      { header: "H-Index", key: "hIndex" },
      { header: "i10-Index", key: "i10Index" },
      { header: "2-Year Mean Citedness", key: "meanCitedness" },
      { header: "Total Citations", key: "totalCitations" },
      { header: "Total Works", key: "totalWorks" },
      { header: "Research Fields", key: "researchFields" },
      { header: "Research Topics", key: "researchTopics" },
      { header: "Current Institution", key: "currentInstitution" },
      { header: "Current Institution Name", key: "currentInstitutionName" },
      { header: "Current Institution ROR", key: "currentInstitutionRor" },
      {
        header: "Current Institution Country",
        key: "currentInstitutionCountry",
      },
    ];

    // Add researcher data
    researchers.forEach((researcher) => {
      // Get the first affiliation if it exists
      const primaryAffiliation = researcher.basic_info?.affiliations?.[0] || {};

      // Process research fields and topics
      const fields =
        researcher.research_areas?.fields
          ?.map((f) => f.display_name)
          .join(", ") || "";
      const topics =
        researcher.research_areas?.topics
          ?.map((t) => t.display_name)
          .join(", ") || "";

      worksheet.addRow({
        name: researcher.basic_info?.name || "",
        institution: primaryAffiliation?.institution?.display_name || "",
        institutionRor: primaryAffiliation?.institution?.ror || "",
        institutionCountry: primaryAffiliation?.institution?.country_code || "",
        institutionYears: primaryAffiliation?.years?.join(", ") || "",
        scopusId: researcher.identifiers?.scopus || "",
        openalexId: researcher.identifiers?.openalex || "",
        orcid: researcher.identifiers?.orcid || "",
        googleScholarId: researcher.identifiers?.google_scholar_id || "",
        hIndex: researcher.research_metrics?.h_index || "",
        i10Index: researcher.research_metrics?.i10_index || "",
        meanCitedness:
          researcher.research_metrics?.two_year_mean_citedness || "",
        totalCitations: researcher.research_metrics?.total_citations || "",
        totalWorks: researcher.research_metrics?.total_works || "",
        researchFields: fields,
        researchTopics: topics,
        currentInstitution: researcher.current_affiliation?.institution || "",
        currentInstitutionName:
          researcher.current_affiliation?.display_name || "",
        currentInstitutionRor: researcher.current_affiliation?.ror || "",
        currentInstitutionCountry:
          researcher.current_affiliation?.country_code || "",
      });
    });

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=researchers.xlsx"
    );

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({
      success: false,
      message: "Error exporting researchers",
      error: error.message,
    });
  }
};

module.exports = {
  exportResearchersToExcel,
};
