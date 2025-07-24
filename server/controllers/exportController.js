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
      "Identifiers", // B1
      "Research Metrics", // C1
      "",
      "",
      "",
      "", // D1-G1 (will be merged)
      "Research Areas", // H1
      "", // I1 (will be merged)
      "Current Affiliation", // J1
      "",
      "",
      "", // K1-M1 (will be merged)
      "Affiliations", // N1
      "",
      "",
      "",
      "", // O1-R1 (will be merged)
    ];

    // Merge Level 1 headers
    worksheet.mergeCells("C1:G1"); // Research Metrics
    worksheet.mergeCells("H1:I1"); // Research Areas
    worksheet.mergeCells("J1:M1"); // Current Affiliation
    worksheet.mergeCells("N1:R1"); // Affiliations

    // Style the Level 1 headers
    ["A1", "B1", "C1", "H1", "J1", "N1"].forEach((cell) => {
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
      "ORCID", // B2
      "H-Index", // C2
      "i10-Index", // D2
      "2-Year Mean Citedness", // E2
      "Total Citations", // F2
      "Total Works", // G2
      "Fields", // H2
      "Topics", // I2
      "Institution", // J2
      "Display Name", // K2
      "ROR", // L2
      "Country Code", // M2
      "Display Name", // N2
      "ROR", // O2
      "ID", // P2
      "Country Code", // Q2
      "Years", // R2
    ];

    // Style the Level 2 headers
    [
      "A2",
      "B2",
      "C2",
      "D2",
      "E2",
      "F2",
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

    // Define columns with widths
    worksheet.columns = [
      { key: "name", width: 20 }, // Basic Info - Name
      { key: "orcid", width: 20 }, // Identifiers - ORCID
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
      { key: "affiliation_display_name", width: 30 }, // Affiliations
      { key: "affiliation_ror", width: 20 },
      { key: "affiliation_id", width: 20 },
      { key: "affiliation_country_code", width: 15 },
      { key: "affiliation_years", width: 15 },
    ];

    // Add researcher data starting from row 3
    let currentRow = 3;

    researchers.forEach((researcher) => {
      // Process research fields and topics
      const fields = researcher.research_areas?.fields || [];
      const topics = researcher.research_areas?.topics || [];
      const affiliations = researcher.basic_info?.affiliations || [];

      // Find the maximum array length to determine how many rows this researcher needs
      const maxArrayLength = Math.max(
        fields.length || 1,
        topics.length || 1,
        affiliations.length || 1
      );

      const startRow = currentRow;

      // Add rows for each array element
      for (let i = 0; i < maxArrayLength; i++) {
        const field = fields[i]?.display_name || "";
        const topic = topics[i]?.display_name || "";
        const affiliation = affiliations[i] || {};

        worksheet.addRow({
          name: i === 0 ? researcher.basic_info?.name || "" : "",
          orcid: i === 0 ? researcher.identifiers?.orcid || "" : "",
          hIndex: i === 0 ? researcher.research_metrics?.h_index || "" : "",
          i10Index: i === 0 ? researcher.research_metrics?.i10_index || "" : "",
          meanCitedness:
            i === 0
              ? researcher.research_metrics?.two_year_mean_citedness || ""
              : "",
          totalCitations:
            i === 0 ? researcher.research_metrics?.total_citations || "" : "",
          totalWorks:
            i === 0 ? researcher.research_metrics?.total_works || "" : "",
          researchFields: field,
          researchTopics: topic,
          currentInstitution:
            i === 0 ? researcher.current_affiliation?.institution || "" : "",
          currentDisplayName:
            i === 0 ? researcher.current_affiliation?.display_name || "" : "",
          currentRor: i === 0 ? researcher.current_affiliation?.ror || "" : "",
          currentCountryCode:
            i === 0 ? researcher.current_affiliation?.country_code || "" : "",
          affiliation_display_name:
            affiliation?.institution?.display_name || "",
          affiliation_ror: affiliation?.institution?.ror || "",
          affiliation_id: affiliation?.institution?.id || "",
          affiliation_country_code:
            affiliation?.institution?.country_code || "",
          affiliation_years: affiliation?.years?.join(", ") || "",
        });
        currentRow++;
      }

      const endRow = currentRow - 1;

      // Merge cells for single-value fields (non-array fields)
      if (maxArrayLength > 1) {
        // Merge Name
        if (researcher.basic_info?.name) {
          worksheet.mergeCells(`A${startRow}:A${endRow}`);
        }

        // Merge ORCID
        if (researcher.identifiers?.orcid) {
          worksheet.mergeCells(`B${startRow}:B${endRow}`);
        }

        // Merge Research Metrics
        if (researcher.research_metrics?.h_index !== undefined) {
          worksheet.mergeCells(`C${startRow}:C${endRow}`);
        }
        if (researcher.research_metrics?.i10_index !== undefined) {
          worksheet.mergeCells(`D${startRow}:D${endRow}`);
        }
        if (
          researcher.research_metrics?.two_year_mean_citedness !== undefined
        ) {
          worksheet.mergeCells(`E${startRow}:E${endRow}`);
        }
        if (researcher.research_metrics?.total_citations !== undefined) {
          worksheet.mergeCells(`F${startRow}:F${endRow}`);
        }
        if (researcher.research_metrics?.total_works !== undefined) {
          worksheet.mergeCells(`G${startRow}:G${endRow}`);
        }

        // Merge Current Affiliation
        if (researcher.current_affiliation?.institution) {
          worksheet.mergeCells(`J${startRow}:J${endRow}`);
        }
        if (researcher.current_affiliation?.display_name) {
          worksheet.mergeCells(`K${startRow}:K${endRow}`);
        }
        if (researcher.current_affiliation?.ror) {
          worksheet.mergeCells(`L${startRow}:L${endRow}`);
        }
        if (researcher.current_affiliation?.country_code) {
          worksheet.mergeCells(`M${startRow}:M${endRow}`);
        }
      }
    });

    // Set column styles
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: "FF000000" } },
          left: { style: "thin", color: { argb: "FF000000" } },
          bottom: { style: "thin", color: { argb: "FF000000" } },
          right: { style: "thin", color: { argb: "FF000000" } },
        };
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
