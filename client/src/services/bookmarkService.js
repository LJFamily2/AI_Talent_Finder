import api from "../config/api";

// Get all bookmarked researchers for the authenticated user
export const getBookmarks = async () => {
  try {
    const response = await api.get("/api/bookmarks");
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Add bookmark(s) for researcher profile(s)
export const addBookmarks = async (researcherProfileIds) => {
  try {
    const response = await api.post("/api/bookmarks", {
      researcherProfileIds,
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Remove a bookmark for a specific researcher
export const removeBookmark = async (researcherId) => {
  try {
    const response = await api.delete(`/api/bookmarks/${researcherId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
