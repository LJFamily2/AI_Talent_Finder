/**
 * API Service Module
 *
 * This module handles all API calls to the backend server.
 * It provides functions for fetching researcher profiles and works data.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL;

/**
 * Generic function to make API requests
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} API response data
 */
const apiRequest = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "API request failed");
    }

    return data.data;
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
 * Fetch researcher works from OpenAlex
 * @param {string} researcherId - OpenAlex researcher ID (e.g., "a5110863171")
 * @returns {Promise<Object>} Researcher works data from OpenAlex
 */
export const getResearcherWorks = async (researcherId) => {
  return apiRequest(`/api/researcher/${researcherId}/works`);
};