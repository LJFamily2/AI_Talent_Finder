export async function loadFilterOptions() {
    const [fieldsRes, topicsRes, institutionsRes, countriesRes] = await Promise.all([
        fetch('/api/fields').then(r => r.json()),
        fetch('/api/topics').then(r => r.json()),
        fetch('/api/institutions').then(r => r.json()),
        fetch('/api/countries').then(r => r.json())
    ]);

    return {
        fields: fieldsRes,
        topics: topicsRes,
        institutions: institutionsRes,
        countries: countriesRes
    };
}

// 2. Parse search_tags into structured object
export function parseSearchTags(search_tags) {
    const result = { fields: [], topics: [], institutions: [], countries: [] };
    search_tags.forEach(tag => {
        const [type, id] = tag.split(':');
        switch (type) {
            case 'field': result.fields.push(id); break;
            case 'topic': result.topics.push(id); break;
            case 'institution': result.institutions.push(id); break;
            case 'country': result.countries.push(id); break;
        }
    });
    return result;
}

// turns json from db to search_tag format
export function buildCountriesFilter(data) {
    if (!Array.isArray(data)) return [];
    return data
        .filter(item => item && item._id !== undefined && item._id !== null)
        .map(item => ({
            search_tag: `country:${item._id}`,
            display_name: item.display_name
        }));
}

// 3. Validate year range
export function validateYearRange(selectedInstitutions, yearFrom, yearTo) {
    if (selectedInstitutions.length > 1) return { yearFrom: null, yearTo: null };
    return { yearFrom: yearFrom || yearTo || null, yearTo: yearTo || yearFrom || null };
}

// 4. Build payload for API
export function buildFilterPayload(filters) {
    const search_tags = [
        ...filters.fields.map(id => `field:${id}`),
        ...filters.topics.map(id => `topic:${id}`),
        ...filters.institutions.map(id => `institution:${id}`),
        ...filters.countries.map(id => `country:${id}`)
    ];

    const { yearFrom, yearTo } = validateYearRange(filters.institutions, filters.yearFrom, filters.yearTo);

    return { search_tags, year_from: yearFrom, year_to: yearTo, h_index: filters.hIndex, i10_index: filters.i10Index };
}
