const excel = require("exceljs");
const Researcher = require("../models/Researcher");

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

    // Fetch researchers data with populated references
    const researchers = await Researcher.find({
      _id: { $in: researcherIds },
    })
      .populate("last_known_affiliations")
      .populate("topics")
      .populate({
        path: "affiliations.institution_id",
        select: "display_name ror country_code",
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
      "", // C1 (will be merged with B1)
      "Research Metrics", // D1
      "",
      "",
      "",
      "", // E1-H1 (will be merged)
      "Topics", // I1
      "Last Known Affiliations", // J1
      "Affiliations", // K1
      "",
      "", // L1-M1 (will be merged)
      "Citation Trends", // N1
      "",
      "", // O1-P1 (will be merged)
    ];

    // Merge Level 1 headers
    worksheet.mergeCells("B1:C1"); // Identifiers
    worksheet.mergeCells("D1:H1"); // Research Metrics
    worksheet.mergeCells("K1:M1"); // Affiliations
    worksheet.mergeCells("N1:P1"); // Citation Trends

    // Style the Level 1 headers
    ["A1", "B1", "D1", "I1", "J1", "K1", "N1"].forEach((cell) => {
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
      "OpenAlex", // B2
      "ORCID", // C2
      "H-Index", // D2
      "i10-Index", // E2
      "2-Year Mean Citedness", // F2
      "Total Citations", // G2
      "Total Works", // H2
      "Topics", // I2
      "Last Known Affiliations", // J2
      "Institution Name", // K2
      "Years", // L2
      "", // M2 (spacing)
      "Year", // N2
      "Works Count", // O2
      "Cited By Count", // P2
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
      { key: "openalex", width: 20 }, // Identifiers - OpenAlex
      { key: "orcid", width: 20 }, // Identifiers - ORCID
      { key: "hIndex", width: 10 }, // Research Metrics
      { key: "i10Index", width: 10 },
      { key: "meanCitedness", width: 20 },
      { key: "totalCitations", width: 15 },
      { key: "totalWorks", width: 15 },
      { key: "topics", width: 30 }, // Topics
      { key: "lastKnownAffiliations", width: 30 }, // Last Known Affiliations
      { key: "affiliation_institution_name", width: 30 }, // Affiliations - Institution Name
      { key: "affiliation_years", width: 15 },
      { key: "spacing", width: 5 }, // Spacing column
      { key: "citation_year", width: 10 }, // Citation Trends
      { key: "works_count", width: 15 },
      { key: "cited_by_count", width: 15 },
    ];

    // Add researcher data starting from row 3
    let currentRow = 3;

    researchers.forEach((researcher) => {
      // Process topics, affiliations, and citation trends from new model
      const topics = researcher.topics || [];
      const lastKnownAffiliations = researcher.last_known_affiliations || [];
      const affiliations = researcher.affiliations || [];
      const citationTrends = researcher.citation_trends || [];

      // Find the maximum array length to determine how many rows this researcher needs
      const maxArrayLength = Math.max(
        topics.length || 1,
        lastKnownAffiliations.length || 1,
        affiliations.length || 1,
        citationTrends.length || 1
      );

      const startRow = currentRow;

      // Add rows for each array element
      for (let i = 0; i < maxArrayLength; i++) {
        const topic = topics[i]?.display_name || topics[i] || "";
        const lastKnownAffiliation =
          lastKnownAffiliations[i]?.display_name ||
          lastKnownAffiliations[i] ||
          "";
        const affiliation = affiliations[i] || {};
        const citationTrend = citationTrends[i] || {};

        // Handle populated institution data
        const institutionName =
          affiliation?.institution_id?.display_name ||
          affiliation?.institution_id ||
          "";

        worksheet.addRow({
          name: i === 0 ? researcher.name || "" : "",
          openalex: i === 0 ? researcher.identifiers?.openalex || "" : "",
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
          topics: topic,
          lastKnownAffiliations: lastKnownAffiliation,
          affiliation_institution_name: institutionName,
          affiliation_years: affiliation?.years?.join(", ") || "",
          spacing: "", // Empty spacing column
          citation_year: citationTrend?.year || "",
          works_count: citationTrend?.works_count || "",
          cited_by_count: citationTrend?.cited_by_count || "",
        });
        currentRow++;
      }

      const endRow = currentRow - 1;

      // Merge cells for single-value fields (non-array fields)
      if (maxArrayLength > 1) {
        // Merge Name
        if (researcher.name) {
          worksheet.mergeCells(`A${startRow}:A${endRow}`);
        }

        // Merge OpenAlex ID
        if (researcher.identifiers?.openalex) {
          worksheet.mergeCells(`B${startRow}:B${endRow}`);
        }

        // Merge ORCID
        if (researcher.identifiers?.orcid) {
          worksheet.mergeCells(`C${startRow}:C${endRow}`);
        }

        // Merge Research Metrics
        if (researcher.research_metrics?.h_index !== undefined) {
          worksheet.mergeCells(`D${startRow}:D${endRow}`);
        }
        if (researcher.research_metrics?.i10_index !== undefined) {
          worksheet.mergeCells(`E${startRow}:E${endRow}`);
        }
        if (
          researcher.research_metrics?.two_year_mean_citedness !== undefined
        ) {
          worksheet.mergeCells(`F${startRow}:F${endRow}`);
        }
        if (researcher.research_metrics?.total_citations !== undefined) {
          worksheet.mergeCells(`G${startRow}:G${endRow}`);
        }
        if (researcher.research_metrics?.total_works !== undefined) {
          worksheet.mergeCells(`H${startRow}:H${endRow}`);
        }
      }
    });

    // Set column styles
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
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
