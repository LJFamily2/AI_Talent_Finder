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

    // Add Level 1 headers (Main Categories)
    const row1 = worksheet.getRow(1);
    row1.values = [
      "Basic Info", // A1
      "",
      "",
      "",
      "",
      "", // B1-F1 (will be merged)
      "Identifiers", // G1
      "Research Metrics", // H1
      "",
      "",
      "",
      "", // I1-L1 (will be merged)
      "Research Areas", // M1
      "", // N1 (will be merged)
      "Current Affiliation", // O1
      "",
      "",
      "", // P1-R1 (will be merged)
    ];

    // Merge Level 1 headers
    worksheet.mergeCells("A1:F1"); // Basic Info
    worksheet.mergeCells("H1:L1"); // Research Metrics
    worksheet.mergeCells("M1:N1"); // Research Areas
    worksheet.mergeCells("O1:R1"); // Current Affiliation

    // Style the Level 1 headers
    ["A1", "G1", "H1", "M1", "O1"].forEach((cell) => {
      worksheet.getCell(cell).style = {
        font: { bold: true, size: 12 },
        alignment: { horizontal: "center", vertical: "middle" },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" },
        },
      };
    });

    // Add Level 2 headers
    const row2 = worksheet.getRow(2);
    row2.values = [
      "Name", // A2
      "Affiliations", // B2-F2 (will be merged)
      "",
      "",
      "",
      "", // C2-F2 (affiliations subfields)
      "ORCID", // G2
      "H-Index", // H2
      "i10-Index", // I2
      "2-Year Mean Citedness", // J2
      "Total Citations", // K2
      "Total Works", // L2
      "Fields", // M2
      "Topics", // N2
      "Institution", // O2
      "Display Name", // P2
      "ROR", // Q2
      "Country Code", // R2
    ];

    // Merge Level 2 headers for Affiliations
    worksheet.mergeCells("B2:F2"); // Affiliations

    // Add Level 3 headers (for Affiliations)
    const row3 = worksheet.getRow(3);
    row3.values = [
      "", // A3 (Name - extends from above)
      "Display Name", // B3
      "ROR", // C3
      "ID", // D3
      "Country Code", // E3
      "Years", // F3
      "", // G3 (ORCID - extends from above)
      "",
      "",
      "",
      "",
      "", // H3-L3 (Research Metrics - extend from above)
      "",
      "", // M3-N3 (Research Areas - extend from above)
      "",
      "",
      "",
      "", // O3-R3 (Current Affiliation - extend from above)
    ];

    // Merge cells vertically for non-affiliation columns
    [
      "A2:A3", // Name
      "G2:G3", // ORCID
      "H2:H3",
      "I2:I3",
      "J2:J3",
      "K2:K3",
      "L2:L3", // Research Metrics
      "M2:M3",
      "N2:N3", // Research Areas
      "O2:O3",
      "P2:P3",
      "Q2:Q3",
      "R2:R3", // Current Affiliation
    ].forEach((range) => {
      worksheet.mergeCells(range);
    });

    // Style the Level 2 headers
    [
      "A2",
      "B2",
      "G2",
      "H2",
      "I2",
      "J2",
      "K2",
      "L2",
      "M2",
      "N2",
      "O2",
      "P2",
      "Q2",
      "R2",
    ].forEach((cell) => {
      worksheet.getCell(cell).style = {
        font: { bold: true },
        alignment: { horizontal: "center", vertical: "middle" },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF0F0F0" },
        },
      };
    });

    // Style the Level 3 headers
    ["B3", "C3", "D3", "E3", "F3"].forEach((cell) => {
      worksheet.getCell(cell).style = {
        font: { bold: true },
        alignment: { horizontal: "center", vertical: "middle" },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8F8F8" },
        },
      };
    });

    // Define columns with widths
    worksheet.columns = [
      { key: "name", width: 20 }, // Basic Info - Name
      { key: "affiliation_display_name", width: 30 }, // Affiliation details
      { key: "affiliation_ror", width: 20 },
      { key: "affiliation_id", width: 20 },
      { key: "affiliation_country_code", width: 15 },
      { key: "affiliation_years", width: 15 },
      { key: "orcid", width: 20 }, // Identifiers - ORCID only
      { key: "hIndex", width: 10 }, // Research Metrics
      { key: "i10Index", width: 10 },
      { key: "meanCitedness", width: 20 },
      { key: "totalCitations", width: 15 },
      { key: "totalWorks", width: 15 },
      { key: "researchFields", width: 30 }, // Research Areas
      { key: "researchTopics", width: 30 },
      { key: "currentInstitution", width: 30 }, // Current Affiliation
      { key: "currentDisplayName", width: 30 },
      { key: "currentRor", width: 20 },
      { key: "currentCountryCode", width: 15 },
    ];

    // Add researcher data starting from row 4
    researchers.forEach((researcher) => {
      // Process research fields and topics
      const fields =
        researcher.research_areas?.fields
          ?.map((f) => f.display_name)
          .join(", ") || "";
      const topics =
        researcher.research_areas?.topics
          ?.map((t) => t.display_name)
          .join(", ") || "";

      // Get the first affiliation
      const primaryAffiliation = researcher.basic_info?.affiliations?.[0] || {};

      worksheet.addRow({
        name: researcher.basic_info?.name || "",
        affiliation_display_name:
          primaryAffiliation?.institution?.display_name || "",
        affiliation_ror: primaryAffiliation?.institution?.ror || "",
        affiliation_id: primaryAffiliation?.institution?.id || "",
        affiliation_country_code:
          primaryAffiliation?.institution?.country_code || "",
        affiliation_years: primaryAffiliation?.years?.join(", ") || "",
        orcid: researcher.identifiers?.orcid || "",
        hIndex: researcher.research_metrics?.h_index || "",
        i10Index: researcher.research_metrics?.i10_index || "",
        meanCitedness:
          researcher.research_metrics?.two_year_mean_citedness || "",
        totalCitations: researcher.research_metrics?.total_citations || "",
        totalWorks: researcher.research_metrics?.total_works || "",
        researchFields: fields,
        researchTopics: topics,
        currentInstitution: researcher.current_affiliation?.institution || "",
        currentDisplayName: researcher.current_affiliation?.display_name || "",
        currentRor: researcher.current_affiliation?.ror || "",
        currentCountryCode: researcher.current_affiliation?.country_code || "",
      });
    });

    // Set column styles
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 3) {
        // Skip header rows (now 3 rows)
        row.eachCell((cell) => {
          cell.alignment = { vertical: "middle", wrapText: true };
        });
      }
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
