import { exportResearchersToPDF } from "../utils/pdfExporter";
import { getResearcherProfile } from "./api";

/**
 * Service for handling PDF exports with full researcher data
 */
class PDFExportService {
  /**
   * Export researchers to PDF with full profile data
   * @param {Array} researchers - Array of researcher objects (can be basic or full profiles)
   * @returns {Promise} - Promise that resolves when PDF is generated
   */
  static async exportResearchersWithFullData(researchers) {
    if (!Array.isArray(researchers)) {
      researchers = [researchers];
    }

    if (researchers.length === 0) {
      throw new Error("No researchers provided for export");
    }

    // Check if researchers already have full profile data
    const needsFullData = researchers.some((researcher) => {
      // Check if we have the essential PDF data
      const hasBasicInfo = researcher.basic_info?.name;
      const hasMetrics =
        researcher.research_metrics &&
        researcher.research_metrics.h_index !== undefined &&
        researcher.research_metrics.i10_index !== undefined;
      const hasAffiliation = researcher.current_affiliation?.display_name;

      return !(hasBasicInfo && hasMetrics && hasAffiliation);
    });

    let fullProfiles = researchers;

    if (needsFullData) {
      // Fetch full profiles for researchers that need it
      fullProfiles = await Promise.all(
        researchers.map(async (researcher) => {
          // If researcher already has essential data, return as-is
          const hasBasicInfo = researcher.basic_info?.name;
          const hasMetrics =
            researcher.research_metrics &&
            researcher.research_metrics.h_index !== undefined &&
            researcher.research_metrics.i10_index !== undefined;
          const hasAffiliation = researcher.current_affiliation?.display_name;

          if (hasBasicInfo && hasMetrics && hasAffiliation) {
            console.log(
              "PDFExportService - using existing data for:",
              researcher.basic_info?.name
            ); // Debug log
            return researcher;
          }

          // Otherwise, fetch full profile
          try {
            const researcherId = researcher._id || researcher.id;
            if (!researcherId) {
              throw new Error("No researcher ID found");
            }
            const fullProfile = await getResearcherProfile(researcherId);
            return fullProfile;
          } catch (error) {
            console.error(
              `Error fetching profile for ${
                researcher.name || researcher.basic_info?.name
              }:`,
              error
            );
            // Return a minimal profile if fetch fails
            const minimalProfile = this.createMinimalProfile(researcher);
            return minimalProfile;
          }
        })
      );
    }

    return exportResearchersToPDF(fullProfiles);
  }

  /**
   * Create a minimal profile for failed fetches
   * @param {Object} researcher - Basic researcher data
   * @returns {Object} - Minimal researcher profile
   */
  static createMinimalProfile(researcher) {
    return {
      basic_info: {
        name:
          researcher.name ||
          researcher.basic_info?.name ||
          "Unknown Researcher",
      },
      current_affiliation: {
        display_name: researcher.institution || "Unknown Institution",
      },
      research_metrics: {
        h_index: researcher.hIndex || 0,
        i10_index: researcher.i10Index || 0,
        total_citations: 0,
        total_works: 0,
        two_year_mean_citedness: 0,
      },
      research_areas: {
        fields: researcher.field ? [{ display_name: researcher.field }] : [],
        topics: [],
      },
      citation_trends: { counts_by_year: [] },
      current_affiliations: [],
      identifiers: {},
    };
  }

  /**
   * Export a single researcher to PDF by ID
   * @param {string} researcherId - Researcher ID
   * @returns {Promise} - Promise that resolves when PDF is generated
   */
  static async exportResearcherById(researcherId) {
    try {
      const researcher = await getResearcherProfile(researcherId);
      return exportResearchersToPDF([researcher]);
    } catch (error) {
      console.error("Error fetching researcher for PDF export:", error);
      throw new Error("Failed to fetch researcher data for PDF export");
    }
  }
}

export default PDFExportService;

// Named exports for convenience
export const exportResearchersWithFullData =
  PDFExportService.exportResearchersWithFullData.bind(PDFExportService);
export const exportResearcherById =
  PDFExportService.exportResearcherById.bind(PDFExportService);
