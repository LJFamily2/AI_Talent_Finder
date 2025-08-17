import api from "../config/api";

/**
 * Export researchers to Excel file
 * @param {Array} researchers - Array of researcher objects with IDs
 * @returns {Promise} - Promise that resolves when download starts
 */
export const exportResearchersToExcel = async (researchers) => {
  try {
    // Extract researcher IDs from the researcher objects
    const researcherIds = researchers.map((researcher) => researcher.id);

    if (researcherIds.length === 0) {
      throw new Error("No researchers to export");
    }

    const response = await api.post(
      "/api/export/excel",
      { researcherIds },
      {
        responseType: "blob", // Important for file downloads
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // Create blob link to download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    const filename = `researchers_${timestamp}.xlsx`;
    link.setAttribute("download", filename);

    // Append to html link element page
    document.body.appendChild(link);

    // Start download
    link.click();

    // Clean up and remove the link
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);

    return {
      success: true,
      filename,
      count: researcherIds.length,
    };
  } catch (error) {
    console.error("Export error:", error);

    // Handle different types of errors
    if (error.response) {
      // Server responded with error status
      const errorMessage = error.response.data?.message || "Export failed";
      throw new Error(errorMessage);
    } else if (error.request) {
      // Request was made but no response received
      throw new Error("Network error - please check your connection");
    } else {
      // Something else went wrong
      throw new Error(error.message || "Export failed");
    }
  }
};
