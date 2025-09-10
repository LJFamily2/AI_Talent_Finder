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

// Get only the IDs of bookmarked researchers
export const getBookmarkIds = async () => {
  try {
    const response = await api.get("/api/bookmarks/get-ids");
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Add bookmark(s) for researcher profile(s)
export const addBookmarks = async (researcherIds, folderName) => {
  try {
    const payload = { researcherIds };
    if (folderName) payload.folderName = folderName;
    const response = await api.post("/api/bookmarks", payload);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Remove a bookmark for a specific researcher
export const removeBookmark = async (researcherId, folderName) => {
  try {
    const url = `/api/bookmarks/${encodeURIComponent(researcherId)}`;
    const config = folderName ? { params: { folderName } } : undefined;
    const response = await api.delete(url, config);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/* =========================
   Folder & Folder items API
   ========================= */

// Create a new folder
export const createFolder = async (name) => {
  try {
    const response = await api.post("/api/bookmarks/folders", { name });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Delete a folder by name
export const deleteFolder = async (folderName) => {
  try {
    const response = await api.delete(`/api/bookmarks/folders/${encodeURIComponent(folderName)}`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Rename a folder: oldName -> newName
export const renameFolder = async (oldName, newName) => {
  try {
    const response = await api.patch(`/api/bookmarks/folders/${encodeURIComponent(oldName)}`, { newName });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Replace entire researcher list in a folder
export const replaceResearchersInFolder = async (folderName, researcherIds = []) => {
  try {
    const response = await api.put(
      `/api/bookmarks/folders/${encodeURIComponent(folderName)}/researchers`,
      { researcherIds }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Update researchers in folder (add/remove arrays)
export const updateResearchersInFolder = async (folderName, { add = [], remove = [] } = {}) => {
  try {
    const response = await api.patch(
      `/api/bookmarks/folders/${encodeURIComponent(folderName)}/researchers`,
      { add, remove }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Move researchers between folders
export const moveResearchersBetweenFolders = async (fromFolder, toFolder, researcherIds = []) => {
  try {
    const response = await api.post("/api/bookmarks/folders/move", {
      from: fromFolder,
      to: toFolder,
      researcherIds,
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
