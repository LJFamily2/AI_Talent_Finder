const excel = require("exceljs");
const ResearcherProfile = require("../models/researcherProfile");

const exportResearchersToExcel = async (req, res) => {
  try {
    const { researcherIds } = req.body;

    // Fetch researchers data
    const researchers = await ResearcherProfile.find({
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
      worksheet.addRow({
        name: researcher.name || "",
        institution: researcher.institution?.display_name || "",
        institutionRor: researcher.institution?.ror || "",
        institutionCountry: researcher.institution?.country_code || "",
        institutionYears: researcher.institution?.years?.join(", ") || "",
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
        researchFields: researcher.research_areas?.fields?.join(", ") || "",
        researchTopics: researcher.research_areas?.topics?.join(", ") || "",
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
