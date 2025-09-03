import api from "../config/api";
import { buildInstitutionsFilter, buildCountriesFilter } from "@/utils/searchFilterHelpers";

// ====== Build filters
export async function loadCountriesFilter() {
    try {
        const res = await api.get("/api/search-filters/countries");
        const allCountries = res.data.allCountries || res.data;
        return buildCountriesFilter(allCountries);
    } catch (error) {
        throw error.response?.data || error.message;
    }
}

export async function searchInstitutions(query, limit = 50) {
    try {
        const res = await api.get("/api/search-filters/institutions", {
            params: { q: query, limit }
        });
        const list = res.data.institutions || res.data;
        return buildInstitutionsFilter(list);
    } catch (error) {
        throw error.response?.data || error.message;
    }
}

export async function listInstitutions(offset = 0, limit = 50) {
    try {
        const res = await api.get("/api/search-filters/institutions", {
            params: { offset, limit }
        });
        const list = res.data.institutions || res.data;
        return buildInstitutionsFilter(list);
    } catch (error) {
        throw error.response?.data || error.message;
    }
}

// ====== Get search parameters
export function buildFilterPayload({
    selectedInstitutions = [],
    selectedFields = [],
    selectedCountries = [],
    name = "",
    sort_field = "match_count",
    sort_order = "desc",
    hIndex = null,
    i10Index = null,
    page = 1,
    limit = 20
} = {}) {
    const search_tags = [];

    selectedInstitutions.forEach(item => {
        if (!item) return;
        if (typeof item === "string") search_tags.push(item);
        else if (item.search_tag) search_tags.push(item.search_tag);
    });
    // selectedFields.forEach(f => { if (f) search_tags.push(`field:${f}`); });
    // selectedCountries.forEach(c => { if (c) search_tags.push(`country:${c}`); });

    const body = {};
    if (search_tags.length) body.search_tags = search_tags;
    if (hIndex && hIndex.value !== undefined && hIndex.value !== null && hIndex.value !== "") {
        body.h_index = { operator: hIndex.operator || ">=", value: Number(hIndex.value) };
    }
    if (i10Index && i10Index.value !== undefined && i10Index.value !== null && i10Index.value !== "") {
        body.i10_index = { operator: i10Index.operator || ">=", value: Number(i10Index.value) };
    }

    body.page = page;
    body.limit = limit;
    return body;
}

export const searchResearchers = async (payload) => {
    try {
        // if caller passed UI selections accidentally, normalize:
        const body = (payload && payload.search_tags) ? payload : buildFilterPayload(payload);
        const res = await api.post("/api/search-filters/search", body);
        return res.data;
    } catch (error) {
        throw error.response?.data || error.message;
    }
};