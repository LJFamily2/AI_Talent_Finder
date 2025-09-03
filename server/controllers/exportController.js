const excel = require("exceljs");
const Researcher = require("../models/Researcher");
const Field = require("../models/Field");
const mongoose = require("mongoose");

const exportResearchersToExcel = async (req, res) => {
  try {
    const { researcherIds } = req.body;
    let researchers = [];

    if (Array.isArray(researcherIds) && researcherIds.length > 0) {
      // Use a single $or query for both ObjectId and slug
      const orQuery = researcherIds.map((id) =>
        mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { slug: id }
      );
      researchers = await Researcher.find({ $or: orQuery })
        .populate("last_known_affiliations")
        .populate({
          path: "topics",
          populate: {
            path: "field_id",
            select: "display_name",
            model: Field,
          },
        })
        .populate({
          path: "affiliations.institution",
          select: "display_name ror country_code",
        });
      if (!researchers || researchers.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No researchers found",
        });
      }
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
      "Affiliations", // H1
      "", // I1 (will be merged)
      "Fields", // J1
      "", // K1 (will be merged)
    ];

    // Merge Level 1 headers
    worksheet.mergeCells("C1:G1"); // Research Metrics
    worksheet.mergeCells("H1:I1"); // Affiliations
    worksheet.mergeCells("J1:K1"); // Fields

    // Style the Level 1 headers
    ["A1", "B1", "C1", "H1", "J1"].forEach((cell) => {
      worksheet.getCell(cell).style = {
        font: { bold: true, size: 12, color: { argb: "FFFFFFFF" } },
        alignment: { horizontal: "center", vertical: "middle" },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF16365C" },
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
      "Institution Name", // H2
      "Years", // I2
      "Field Name", // J2
      "Topics", // K2
    ];

    // Style the Level 2 headers
    ["A2", "B2", "C2", "D2", "E2", "F2", "G2", "H2", "I2", "J2", "K2"].forEach(
      (cell) => {
        worksheet.getCell(cell).style = {
          font: { bold: true, color: { argb: "FFFFFFFF" } },
          alignment: { horizontal: "center", vertical: "middle" },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFF0000" },
          },
        };
      }
    );

    // Define columns with widths
    worksheet.columns = [
      { key: "name", width: 20 }, // Basic Info - Name
      { key: "orcid", width: 20 }, // Identifiers - ORCID
      { key: "hIndex", width: 10 }, // Research Metrics
      { key: "i10Index", width: 10 },
      { key: "meanCitedness", width: 20 },
      { key: "totalCitations", width: 15 },
      { key: "totalWorks", width: 15 },
      { key: "affiliation_institution_name", width: 30 }, // Affiliations - Institution Name
      { key: "affiliation_years", width: 15 },
      { key: "fieldName", width: 30 }, // Fields - Field Name
      { key: "topics", width: 50 }, // Fields - Topics (comma-separated)
    ];

    // Add researcher data starting from row 3
    let currentRow = 3;

    researchers.forEach((researcher) => {
      // Process topics and group them by field
      const topics = researcher.topics || [];
      const affiliations = researcher.affiliations || [];

      // Group topics by field but keep each topic as individual entry
      const fieldGroups = {};
      topics.forEach((topic) => {
        const fieldName = topic.field_id?.display_name || "Unknown Field";
        const topicName = topic.display_name || "";

        if (!fieldGroups[fieldName]) {
          fieldGroups[fieldName] = [];
        }
        if (topicName) {
          fieldGroups[fieldName].push(topicName);
        }
      });

      // Create individual entries for each topic, but keep track of field grouping
      const fieldEntries = [];
      Object.entries(fieldGroups).forEach(([fieldName, topicsList]) => {
        topicsList.forEach((topicName, index) => {
          fieldEntries.push({
            fieldName: index === 0 ? fieldName : "", // Only show field name on first topic of each field
            topics: topicName, // Each topic gets its own row
            isFirstInField: index === 0, // Flag to identify first topic in field
            fieldGroupName: fieldName, // Keep original field name for merging
          });
        });
      });

      // If no topics, show empty entry
      if (fieldEntries.length === 0) {
        fieldEntries.push({
          fieldName: "",
          topics: "",
          isFirstInField: true,
          fieldGroupName: "",
        });
      }

      // Find the maximum array length to determine how many rows this researcher needs
      const maxArrayLength = Math.max(
        fieldEntries.length || 1,
        affiliations.length || 1
      );

      const startRow = currentRow;

      // Add rows for each array element
      for (let i = 0; i < maxArrayLength; i++) {
        const fieldEntry = fieldEntries[i] || {};
        const affiliation = affiliations[i] || {};

        // Handle populated institution data
        const institutionName =
          affiliation?.institution?.display_name ||
          affiliation?.institution ||
          "";

        worksheet.addRow({
          name: i === 0 ? researcher.name || "" : "",
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
          affiliation_institution_name: institutionName,
          affiliation_years: affiliation?.years?.join(", ") || "",
          fieldName: fieldEntry.fieldGroupName || "", // Use fieldGroupName for proper merging
          topics: fieldEntry.topics || "",
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

        // Merge field names for topics within the same field
        let fieldMergeStart = startRow;
        let currentFieldName = "";

        for (let rowIndex = 0; rowIndex < fieldEntries.length; rowIndex++) {
          const entry = fieldEntries[rowIndex];
          const currentRowNum = startRow + rowIndex;

          if (entry.fieldGroupName !== currentFieldName) {
            // End previous field merge if needed
            if (currentFieldName && fieldMergeStart < currentRowNum - 1) {
              worksheet.mergeCells(`J${fieldMergeStart}:J${currentRowNum - 1}`);
            }
            // Start new field merge
            fieldMergeStart = currentRowNum;
            currentFieldName = entry.fieldGroupName;
          }
        }

        // Handle the last field merge
        if (currentFieldName && fieldMergeStart < endRow) {
          worksheet.mergeCells(`J${fieldMergeStart}:J${endRow}`);
        }
      }
    });

    // Set column styles
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
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

        // Apply background colors to data rows (rowNumber >= 3)
        if (rowNumber >= 3) {
          if (colNumber === 1) {
            // Name column (A) - #daeef3
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFDAEEF3" },
            };
          } else if (colNumber === 8 || colNumber === 9) {
            // Affiliation columns (H, I) - Institution Name and Years - #ddd9c4
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFDDD9C4" },
            };
          }
        }
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
