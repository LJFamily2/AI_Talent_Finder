/**
 * API Service Module
 *
 * This module handles all API calls to the backend server.
 * It provides functions for fetching researcher profiles and works data.
 */

import { API_BASE_URL as CONFIG_API_BASE_URL } from "../config/api";
// fall back to env var if config export is not available
const API_BASE_URL = CONFIG_API_BASE_URL || import.meta.env.BACKEND_URL || "";

/**
 * Generic function to make API requests
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} API response data
 */
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const fetchOptions = {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  };
  try {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
    }
    const contentType = (
      response.headers.get("content-type") || ""
    ).toLowerCase();
    if (contentType.includes("application/json")) {
      const json = await response.json();
      if (Object.prototype.hasOwnProperty.call(json, "success")) {
        if (json.success) {
          return json.data;
        } else {
          throw new Error(json.message || "API request failed");
        }
      }
      return json;
    }
    return await response.text();
  } catch (error) {
    console.error("API request error:", error);
    throw error;
  }
};

/**
 * Fetch researcher profile by ID
 * @param {string} researcherId - OpenAlex researcher ID
 * @returns {Promise<Object>} Researcher profile data
 */
export const getResearcherProfile = async (researcherId) => {
  return apiRequest(`/api/researcher/${researcherId}`);
};

/**
 * Fetch researcher works from OpenAlex with pagination
 * @param {string} researcherId - OpenAlex researcher ID (e.g., "a5110863171")
 * @param {number} page - Page number (default: 1)
 * @param {number} perPage - Number of works per page (default: 20)
 * @returns {Promise<Object>} Researcher works data from OpenAlex
 */
export const getResearcherWorks = async (
  researcherId,
  page = 1,
  perPage = 20
) => {
  return apiRequest(
    `/api/researcher/${researcherId}/works?page=${page}&per_page=${perPage}`
  );
};

/**
 * Export researcher profile (downloads file)
 * @param {string} researcherId - OpenAlex researcher ID
 * @returns {Promise<Blob>} Exported file blob
 */
export const exportResearcherProfile = async (researcherId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/export/excel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        researcherIds: [researcherId],
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.blob();
  } catch (error) {
    console.error("Export request error:", error);
    throw error;
  }
};
