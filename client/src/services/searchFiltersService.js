import { buildCountriesFilter } from "@/utils/searchFilterHelpers";
import api from "../config/api";

export const searchResearchers = async (filters) => {
    try {
        // send filters as the request body (controller expects top-level fields)
        const response = await api.post("/api/search-filters/search", filters);
        return response.data;
    } catch (error) {
        throw error.response?.data || error.message;
    }
};

export async function loadCountriesFilter() {
    try {
        const res = await api.get("/api/search-filters/countries");
        const allCountries = res.data.allCountries || res.data;
        return buildCountriesFilter(allCountries)
    } catch (error) {
        throw error.response?.data || error.message;
    }
}

