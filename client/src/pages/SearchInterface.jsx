import React, { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import searchIcon from '../assets/search.png';
import menuIcon from '../assets/menu.png';
// import sortIcon from '../assets/sort.png';
// import { Switch } from "@/components/ui/switch"
import Bulb from '../assets/lightbulb.png';
import Dot from '../assets/dot.png';
import letterH from '../assets/letter-h.png';
import scholarHat from '../assets/scholar-hat.png';
import citationIcon from '../assets/citation.png';
import documentIcon from '../assets/document.png';
import filterIcon from '../assets/filter.png';
import noResultImage from '../assets/no-result.png';
// pagination primitives are used via PaginationBar component
import Footer from '@/components/Footer';
// icons used inside SortModal are imported there
import { buildFilterPayload, searchResearchers, loadCountriesFilter, searchInstitutions, loadAllFields, loadTopicsForField, searchResearcherNames, searchTopicsAutocomplete } from '../services/searchFiltersService';
import BookmarkIcon from '@/components/BookmarkIcon';
import CountryModalComp from '@/components/CountryModal';
import InstitutionModalComp from '@/components/InstitutionModal';
import FieldModalComp from '@/components/FieldModal';
import InlineInstitutionsDropdown from '@/components/InlineInstitutionsDropdown';
import InlineNameDropdown from '@/components/InlineNameDropdown';
import InlineFieldDropdown from '@/components/InlineFieldDropdown';
import SelectedFieldChips from '@/components/SelectedFieldChips';
import SelectedInstitutionChips from '@/components/SelectedInstitutionChips';
import PaginationBar from '@/components/PaginationBar';
import SortBar from '@/components/SortBar';

function SearchInterface() {
    // Plan restoration before effects run to avoid clobbering saved state
    let initialShouldRestore = false;
    try {
        initialShouldRestore = sessionStorage.getItem('restoreSearchState') === '1' && !!sessionStorage.getItem('searchInterfaceState');
    } catch {}
    const restorePlannedRef = useRef(initialShouldRestore);
    const restoredRef = useRef(false);
    const navigate = useNavigate();
    const [showFilterPanel, setShowFilterPanel] = useState(true);
    const [showCountryModal, setShowCountryModal] = useState(false);
    const [countrySearch, setCountrySearch] = useState("");
    const [selectedCountries, setSelectedCountries] = useState([]);
    const [countriesList, setCountriesList] = useState([]); // loaded from API for left-panel display
    const [showFieldModal, setShowFieldModal] = useState(false);
    const [fieldSearch, setFieldSearch] = useState("");
    const [selectedFields, setSelectedFields] = useState([]);
    const [allFields, setAllFields] = useState([]);
    const [selectedTopicIds, setSelectedTopicIds] = useState([]); // topic _ids for payload
    const [topicKeyToId, setTopicKeyToId] = useState({}); // map "Field > Topic" -> topic _id
    const [expertiseResults, setExpertiseResults] = useState([]); // [{ field, topics: [] }]
    const [expertiseLoading, setExpertiseLoading] = useState(false);
    const expertiseLastQueryRef = useRef("");
    const [hiddenTopicsByField, setHiddenTopicsByField] = useState({}); // fieldName -> ["Field > Topic", ...]
    const hiddenTopicsRef = useRef({});
    useEffect(() => { hiddenTopicsRef.current = hiddenTopicsByField || {}; }, [hiddenTopicsByField]);
    // Add state for expertise input and focus
    const [expertiseInput, setExpertiseInput] = useState("");
    const [expertiseInputFocused, setExpertiseInputFocused] = useState(false);
    // const [peopleList, setPeopleList] = useState([]);
    const [sortBy, setSortBy] = useState('match');
    const [sortOrder, setSortOrder] = useState('desc');
    const [hasSearched, setHasSearched] = useState(false);
    const [onlyFullMatches, setOnlyFullMatches] = useState(false);
    const [peopleList, setPeopleList] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [totalResults, setTotalResults] = useState(0);
    // Metric filters
    const [hIndexOp, setHIndexOp] = useState('>=');
    const [hIndexVal, setHIndexVal] = useState('');
    const [i10Op, setI10Op] = useState('>=');
    const [i10Val, setI10Val] = useState('');
    // const navigate = useNavigate();

    // useEffect(() => {
    //     fetch('/api/researchers?page=1&limit=10')
    //       .then(res => res.json())
    //     .then(data => {
    //         console.log('API response:', data);
    //         setPeopleList(data.peopleList || []);
    // });
    //   }, []);

    // // State for institutions filter
    const [showInstitutionModal, setShowInstitutionModal] = useState(false);
    const [selectedInstitutions, setSelectedInstitutions] = useState([]); // array of { search_tag, display_name }
    const [institutionInput, setInstitutionInput] = useState("");
    const [institutionInputFocused, setInstitutionInputFocused] = useState(false);
    const [institutionSuggestions, setInstitutionSuggestions] = useState([]);
    const [institutionLoading, setInstitutionLoading] = useState(false);
    const instLastQueryRef = useRef("");

    // Name suggestions state
    const [nameInput, setNameInput] = useState("");
    const [nameInputFocused, setNameInputFocused] = useState(false);
    const [nameSuggestions, setNameSuggestions] = useState([]);
    const [nameLoading, setNameLoading] = useState(false);
    const nameLastQueryRef = useRef("");

    // Stable callbacks for modals (prevents unnecessary prop identity changes)
    const handleCountryClose = useCallback(() => setShowCountryModal(false), []);
    const handleCountrySelect = useCallback((countryObj) => {
        setSelectedCountries(sel => sel.includes(countryObj.search_tag)
            ? sel.filter(c => c !== countryObj.search_tag)
            : [...sel, countryObj.search_tag]
        );
    }, []);
    const handleInstitutionClose = useCallback(() => setShowInstitutionModal(false), []);
    const handleFieldClose = useCallback(() => setShowFieldModal(false), []);
    const handleFieldSelect = useCallback((value) => {
        setSelectedFields(prev => {
            const isTopic = typeof value === 'string' && value.includes(' > ');
            if (isTopic) {
                const [fieldName] = value.split(' > ');
                // If the field is selected, ignore topic selection
                if (prev.includes(fieldName)) return prev;
                // Toggle topic
                const willSelect = !prev.includes(value);
                // update topicIds if we have mapping
                const id = topicKeyToId[value];
                if (id) {
                    setSelectedTopicIds(ids => willSelect ? (ids.includes(id) ? ids : [...ids, id]) : ids.filter(x => x !== id));
                }
                return willSelect ? [...prev, value] : prev.filter(v => v !== value);
            } else {
                const fieldName = value;
                const already = prev.includes(fieldName);
                if (already) {
                    // Unselect field: restore previously hidden topics
                    const toRestore = (hiddenTopicsRef.current && hiddenTopicsRef.current[fieldName]) || [];
                    const withoutField = prev.filter(v => v !== fieldName);
                    const merged = [...withoutField, ...toRestore.filter(t => !withoutField.includes(t))];
                    // clear cache for this field
                    setHiddenTopicsByField(h => {
                        const next = { ...(h || {}) };
                        delete next[fieldName];
                        return next;
                    });
                    // restore topic ids for restored topics if we have mapping
                    setSelectedTopicIds(ids => {
                        const addIds = toRestore.map(k => topicKeyToId[k]).filter(Boolean);
                        const set = new Set(ids);
                        addIds.forEach(x => set.add(x));
                        return Array.from(set);
                    });
                    return merged;
                }
                // Select field: remove any topics under this field
                const topicsUnderField = prev.filter(v => typeof v === 'string' && v.startsWith(fieldName + ' > '));
                if (topicsUnderField.length) {
                    setHiddenTopicsByField(h => ({ ...(h || {}), [fieldName]: topicsUnderField }));
                }
                const pruned = prev.filter(v => !topicsUnderField.includes(v));
                // also remove associated topic ids while keeping mapping for potential restore
                setSelectedTopicIds(ids => ids.filter(id => !topicsUnderField.some(k => topicKeyToId[k] === id)));
                return [...pruned, fieldName];
            }
        });
    }, [topicKeyToId]);

    // uniform error message mapping for UI display
    const formatError = useCallback((err) => {
        const status = err?.response?.status ?? err?.status;
        const serverMessage = err?.response?.data?.message || err?.message;
        if (err?.request && !err?.response) return 'Network error. Please check your connection.';
        if (status === 401) return 'Please log in to continue.';
        if (status === 403) return 'You do not have permission to perform this action.';
        if (status === 404) return serverMessage || 'Requested resource was not found.';
        if (status >= 500) return 'Server error. Please try again later.';
        return serverMessage || 'Something went wrong while searching.';
    }, []);

    // Stable callbacks for CountryModal to avoid prop identity changes

    const hasFilters = useMemo(() => {
        return (
            (selectedCountries && selectedCountries.length > 0) ||
            (selectedFields && selectedFields.length > 0) ||
            (selectedInstitutions && selectedInstitutions.length > 0) ||
            (String(nameInput || '').trim().length > 0) ||
            (fieldSearch && fieldSearch.trim().length > 0) ||
            (countrySearch && countrySearch.trim().length > 0)
        );
    }, [selectedCountries, selectedFields, selectedInstitutions, nameInput, fieldSearch, countrySearch]);

    // // ============ Test load countries data ===========
    // async function loadTest() {
    //     try {
    //         const countries = await loadCountriesFilter();
    //         console.log(countries)  // to UI
    //     } catch (err) {
    //         console.error("loadCountriesFilter error:", err);
    //     }
    // }
    // loadTest();
    // // =================================================

    // // =========== Example for search function =========
    // const filters = {
    //     "search_tags": [
    //         "topic:68a8de08121e05e29ad0d0da",
    //         "field:68a8de2b121e05e29ad0d14c",
    //         "country:AU"
    //     ],
    //     "h_index": {
    //         "operator": ">=",
    //         "value": 200
    //     },
    //     "page": 1,
    //     "limit": 20
    // }
    // async function search(filters) {
    //     try {
    //         const results = await searchResearchers(filters)
    //         console.log(results) // to UI
    //     } catch (error) {
    //         console.log(error)
    //     }
    // }
    // search(filters)
    // // =================================================

// SortModal moved to components/SortModal.jsx



    // FieldModal moved to module scope above

    // Load all fields once on first expertise search usage
    useEffect(() => {
        if (!expertiseInputFocused) return;
        if (allFields.length) return;
        (async () => {
            try {
                const list = await loadAllFields();
                setAllFields(list || []);
            } catch (e) {
                console.error("loadAllFields (inline) error:", e);
                setAllFields([]);
            }
        })();
    }, [expertiseInputFocused]);

    // Debounced search for field/topic suggestions in the left UI
    useEffect(() => {
        const q = (expertiseInput || "").trim();
        expertiseLastQueryRef.current = q;
        if (!expertiseInputFocused || !q) {
            setExpertiseResults([]);
            setExpertiseLoading(false);
            return;
        }
        const timer = setTimeout(async () => {
            setExpertiseLoading(true);
            // Helper to ensure fields list
            async function ensureFields() {
                let fieldsList = allFields;
                if (!fieldsList || !fieldsList.length) {
                    try {
                        fieldsList = await loadAllFields();
                        setAllFields(fieldsList || []);
                    } catch (e) {
                        fieldsList = [];
                    }
                }
                return fieldsList || [];
            }

            try {
                // Try Atlas topics endpoint first
                const [fieldsList, topicHits] = await Promise.all([
                    ensureFields(),
                    searchTopicsAutocomplete(q, 50)
                ]);
                if (expertiseLastQueryRef.current !== q) return;

                const qlow = q.toLowerCase();
                const nameMatchSet = new Set(
                    (fieldsList || [])
                        .filter(f => (f.display_name || "").toLowerCase().includes(qlow))
                        .map(f => String(f._id))
                );

                // If no hits from Atlas, fallback to per-field topic query
                let effectiveTopicHits = topicHits;
                if (!effectiveTopicHits || effectiveTopicHits.length === 0) {
                    try {
                        const perField = await Promise.all((fieldsList || []).map(async (f) => {
                            try {
                                const res = await loadTopicsForField(f._id ? f._id : "null", 0, 200, q);
                                const topics = res?.topics || [];
                                return topics.map(t => ({ ...t, field_id: f._id, field_display_name: f.display_name }));
                            } catch {
                                return [];
                            }
                        }));
                        effectiveTopicHits = perField.flat();
                    } catch {}
                }

                // Group topic hits by field_id
                const byFieldId = new Map();
                (effectiveTopicHits || []).forEach(t => {
                    const fid = t.field_id === null || t.field_id === undefined ? 'null' : String(t.field_id);
                    if (!byFieldId.has(fid)) byFieldId.set(fid, { topics: [], fieldDisplayName: t.field_display_name });
                    const entry = byFieldId.get(fid);
                    entry.topics.push({ _id: t._id, display_name: t.display_name });
                    if (!entry.fieldDisplayName && t.field_display_name) entry.fieldDisplayName = t.field_display_name;
                });

                // Build result list merging name-matched fields and topic-matched fields
                const idToField = new Map((fieldsList || []).map(f => [String(f._id), f]));
                const results = [];

                // From topic matches
                for (const [fid, entry] of byFieldId.entries()) {
                    const field = fid === 'null'
                        ? { _id: null, display_name: 'Uncategorized' }
                        : (idToField.get(fid) || { _id: fid, display_name: entry.fieldDisplayName || 'Unknown' });
                    const nameMatch = nameMatchSet.has(fid);
                    results.push({ field, topics: entry.topics, nameMatch });
                }

                // Include fields with nameMatch but no topic hits
                (fieldsList || []).forEach(f => {
                    const fid = String(f._id);
                    if (nameMatchSet.has(fid) && !byFieldId.has(fid)) {
                        results.push({ field: f, topics: [], nameMatch: true });
                    }
                });

                // Filter to keep same semantics
                const filtered = results.filter(r => r.nameMatch || (r.topics && r.topics.length));
                setExpertiseResults(filtered);
            } catch (err) {
                // Fallback to existing per-field search
                try {
                    const fieldsList = await ensureFields();
                    const qlow = q.toLowerCase();
                    const promises = (fieldsList || []).map(async (f) => {
                        const nameMatch = (f.display_name || "").toLowerCase().includes(qlow);
                        let topics = [];
                        try {
                            const res = await loadTopicsForField(f._id ? f._id : "null", 0, 1000, q);
                            topics = res?.topics || [];
                        } catch (e) { topics = []; }
                        return { field: f, topics, nameMatch };
                    });
                    const results = await Promise.all(promises);
                    if (expertiseLastQueryRef.current !== q) return;
                    const filtered = results.filter(r => r.nameMatch || (r.topics && r.topics.length));
                    setExpertiseResults(filtered);
                } catch (e2) {
                    if (expertiseLastQueryRef.current === q) setExpertiseResults([]);
                }
            } finally {
                if (expertiseLastQueryRef.current === q) setExpertiseLoading(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [expertiseInput, expertiseInputFocused, allFields]);

    // debounced suggestion fetch using searchInstitutions
    useEffect(() => {
        const q = (institutionInput || "").trim();
        instLastQueryRef.current = q;
        const timer = setTimeout(async () => {
            if (!q) {
                setInstitutionSuggestions([]);
                return;
            }
            setInstitutionLoading(true);
            try {
                const results = await searchInstitutions(q, 10);
                if (instLastQueryRef.current !== q) return; // avoid race overwrite
                setInstitutionSuggestions(results || []);
            } catch (err) {
                console.error("searchInstitutions (suggest) error", err);
            } finally {
                setInstitutionLoading(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [institutionInput]);

    // re-run search when sort or full-match toggle changes (after initial search)
    useEffect(() => {
        if (!hasSearched) return;
        // reset to first page on sort change
        loadResults({ page: 1, limit: perPage });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortBy, sortOrder, onlyFullMatches]);

    // helper: toggle selection by search_tag
    function toggleInstitutionSelection(item) {
        setSelectedInstitutions(prev => {
            const exists = prev.some(s => s.search_tag === item.search_tag);
            if (exists) return prev.filter(s => s.search_tag !== item.search_tag);
            return [...prev, item];
        });
    }

    // when adding from inline suggestions
    function addInstitutionSelection(item) {
        setSelectedInstitutions(prev => prev.some(s => s.search_tag === item.search_tag) ? prev : [...prev, item]);
        setInstitutionInput("");
        setInstitutionSuggestions([]);
    }

    // reset all filters and results
function handleReset() {
        setSelectedCountries([]);
        setSelectedFields([]);
        setHiddenTopicsByField({});
        setSelectedTopicIds([]);
        setTopicKeyToId({});
        setSelectedInstitutions([]);
        setInstitutionInput("");
        setInstitutionSuggestions([]);
        setExpertiseInput("");
        setExpertiseInputFocused(false);
        setFieldSearch("");
        setCountrySearch("");
        setPeopleList([]);
        setHasSearched(false);
        setIsSearching(false);
        setSearchError(null);
        setShowCountryModal(false);
        setShowFieldModal(false);
        setShowInstitutionModal(false);
        setSortBy('match');
        setSortOrder('desc');
        setOnlyFullMatches(false);
        setNameInput("");
        setNameSuggestions([]);
        setNameInputFocused(false);
        setHIndexOp('>='); setHIndexVal('');
        setI10Op('>='); setI10Val('');
    }

    // central loader for search results supporting pagination
async function loadResults({ page = 1, limit = perPage } = {}) {
        setIsSearching(true);
        setSearchError(null);
        // Resolve field IDs for selectedFields (which hold display names and topic labels)
        let fieldIds = [];
        try {
            let fieldsList = allFields;
            if (!fieldsList || fieldsList.length === 0) {
                fieldsList = await loadAllFields();
                setAllFields(fieldsList || []);
            }
            const nameToId = new Map((fieldsList || []).map(f => [String(f.display_name || ""), String(f._id || "")]));
            fieldIds = (selectedFields || [])
                .filter(v => typeof v === 'string' && !v.includes(' > ')) // only pure field selections
                .map(name => nameToId.get(String(name)))
                .filter(Boolean);
        } catch (e) {
            // If fields cannot be resolved, proceed without field filter
            console.warn('Could not resolve field IDs for search payload:', e);
            fieldIds = [];
        }

        // derive sort field mapping for API
        function mapSortField(key) {
            switch (key) {
                case 'match': return 'match_count';
                case 'name': return 'name';
                case 'h_index': return 'h_index';
                case 'i10_index': return 'i10_index';
                case 'citations': return 'total_citations';
                case 'works': return 'total_works';
                default: return 'match_count';
            }
        }

        // build payload from UI state
        const payload = buildFilterPayload({
            selectedInstitutions,
            selectedFields: fieldIds,
            selectedTopics: selectedTopicIds,
            selectedCountries,
            name: nameInput,
            sort_field: mapSortField(sortBy),
            sort_order: sortOrder,
            require_full_match: onlyFullMatches,
            hIndex: (hIndexVal !== '' && hIndexVal !== null ? { operator: hIndexOp, value: Number(hIndexVal) } : null),
            i10Index: (i10Val !== '' && i10Val !== null ? { operator: i10Op, value: Number(i10Val) } : null),
            page,
            limit
        });

        try {
            const results = await searchResearchers(payload);
            // resilient shape handling:
            const list = results?.researchers || results?.items || results?.results || [];
            const total = results?.total || results?.count || results?.total_count || list.length;

            setPeopleList(list);
            setTotalResults(Number(total || 0));
            setCurrentPage(Number(page));
            setHasSearched(true);
        } catch (err) {
            console.error("searchResearchers failed error:", err);
            setPeopleList([]);
            setTotalResults(0);
            setHasSearched(true);
            setSearchError(formatError(err));
        } finally {
            setIsSearching(false);
        }
    }

    // handler used by Apply button - resets to first page
    async function handleApply(e) {
        e?.preventDefault?.();
        await loadResults({ page: 1, limit: perPage });
    }

    // load countries once on mount so left panel can show common countries
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const raw = await loadCountriesFilter();
                const normalized = (raw || []).map(item => {
                    if (!item) return null;
                    if (typeof item === 'string') return { search_tag: item, display_name: item };
                    return {
                        search_tag: item.search_tag || item._id || item.code || item.id || item.value || "",
                        display_name: item.display_name || item.name || item.label || item.display || ""
                    };
                }).filter(Boolean);
                if (mounted) setCountriesList(normalized);
            } catch (err) {
                console.error("loadCountriesFilter (left panel) error:", err);
                if (mounted) setCountriesList([]);
            }
        })();
        return () => { mounted = false; };
    }, []);

    // Persist search UI state and results for restoring after login redirect
    useEffect(() => {
        if (restorePlannedRef.current && !restoredRef.current) return;
        const snapshot = {
            selectedCountries,
            selectedFields,
            selectedInstitutions,
            selectedTopicIds,
            topicKeyToId,
            hIndexOp,
            hIndexVal,
            i10Op,
            i10Val,
            peopleList,
            currentPage,
            perPage,
            totalResults,
            sortBy,
            sortOrder,
            hasSearched,
            nameInput,
            onlyFullMatches,
        };
        try { sessionStorage.setItem('searchInterfaceState', JSON.stringify(snapshot)); } catch {}
    }, [selectedCountries, selectedFields, selectedInstitutions, selectedTopicIds, topicKeyToId, hIndexOp, hIndexVal, i10Op, i10Val, peopleList, currentPage, perPage, totalResults, sortBy, sortOrder, hasSearched, nameInput]);

    // Restore state after login redirect (when bookmark was clicked)
    useEffect(() => {
        const shouldRestore = (() => { try { return sessionStorage.getItem('restoreSearchState') === '1'; } catch { return false; } })();
        const raw = (() => { try { return sessionStorage.getItem('searchInterfaceState'); } catch { return null; } })();
        if (shouldRestore && raw) {
            try {
                const s = JSON.parse(raw);
                if (s) {
                    setSelectedCountries(s.selectedCountries || []);
                    setSelectedFields(s.selectedFields || []);
                    setSelectedInstitutions(s.selectedInstitutions || []);
                    setSelectedTopicIds(s.selectedTopicIds || []);
                    setTopicKeyToId(s.topicKeyToId || {});
                    setHIndexOp(s.hIndexOp || '>=');
                    setHIndexVal(s.hIndexVal || '');
                    setI10Op(s.i10Op || '>=');
                    setI10Val(s.i10Val || '');
                    setPeopleList(s.peopleList || []);
                    setCurrentPage(Number(s.currentPage || 1));
                    setPerPage(Number(s.perPage || 10));
                    setTotalResults(Number(s.totalResults || 0));
                    setSortBy(s.sortBy || 'match');
                    setSortOrder(s.sortOrder || 'desc');
                    setHasSearched(Boolean(s.hasSearched));
                    setNameInput(s.nameInput || '');
                    if (typeof s.onlyFullMatches === 'boolean') setOnlyFullMatches(s.onlyFullMatches);
                    // mark restored to allow subsequent snapshot writes
                    restoredRef.current = true;
                }
            } catch {}
            try { sessionStorage.removeItem('restoreSearchState'); } catch {}
        }
    }, []);

    // Bootstrap from SearchStart (apply initial selection and auto-run)
    useEffect(() => {
        const raw = (() => { try { return sessionStorage.getItem('searchInterfaceBootstrap'); } catch { return null; } })();
        const rawPayload = (() => { try { return sessionStorage.getItem('searchInterfaceBootstrapPayload'); } catch { return null; } })();
        if (!raw && !rawPayload) return;
        try {
            const b = raw ? (JSON.parse(raw) || {}) : {};
            // Apply incoming bootstrap filters
            if (Array.isArray(b.selectedCountries)) setSelectedCountries(b.selectedCountries);
            if (Array.isArray(b.selectedFields)) setSelectedFields(b.selectedFields);
            if (Array.isArray(b.selectedInstitutions)) setSelectedInstitutions(b.selectedInstitutions);
            if (Array.isArray(b.selectedTopicIds)) setSelectedTopicIds(b.selectedTopicIds.map(String));
            if (b.topicKeyToId && typeof b.topicKeyToId === 'object') setTopicKeyToId(b.topicKeyToId);
            if (typeof b.nameInput === 'string') setNameInput(b.nameInput);
        } catch {}
        try { sessionStorage.removeItem('searchInterfaceBootstrap'); } catch {}

        // Run search, preferring a prebuilt payload if present
        setTimeout(async () => {
            try {
                setIsSearching(true);
                if (rawPayload) {
                    const payload = JSON.parse(rawPayload);
                    const results = await searchResearchers(payload);
                    const list = results?.researchers || results?.items || results?.results || [];
                    const total = results?.total || results?.count || results?.total_count || list.length;
                    setPeopleList(list);
                    setTotalResults(Number(total || 0));
                    setCurrentPage(Number(payload?.page || 1));
                    setHasSearched(true);
                } else {
                    await loadResults({ page: 1, limit: perPage });
                }
            } catch (err) {
                console.error('bootstrap search error:', err);
                setPeopleList([]);
                setTotalResults(0);
                setHasSearched(true);
                setSearchError(formatError(err));
            } finally {
                setIsSearching(false);
                try { sessionStorage.removeItem('searchInterfaceBootstrapPayload'); } catch {}
            }
        }, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Debounced name suggestions
    useEffect(() => {
        const q = (nameInput || "").trim();
        nameLastQueryRef.current = q;
        const timer = setTimeout(async () => {
            if (!q) { setNameSuggestions([]); return; }
            setNameLoading(true);
            try {
                const results = await searchResearcherNames(q, 10);
                if (nameLastQueryRef.current !== q) return;
                setNameSuggestions(results || []);
            } catch (err) {
                console.error("searchResearcherNames error", err);
            } finally {
                setNameLoading(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [nameInput]);

    // common display names to show when no selection exists (order matters)
    const COMMON_COUNTRY_DISPLAY_NAMES = [
        'Vietnam',
        'China',
        'India',
        'United Kingdom',
        'Australia',
    ];

    // derive what to show in the left panel: selected countries (if any) else common ones from API
    const commonCountries = countriesList.filter(c => COMMON_COUNTRY_DISPLAY_NAMES.includes(c.display_name));
    const fallbackCommon = countriesList.slice(0, 6);
    const leftPanelCountries = (selectedCountries && selectedCountries.length > 0)
        ? countriesList.filter(c => selectedCountries.includes(c.search_tag))
        : (commonCountries.length ? commonCountries : fallbackCommon);

    return (
        <div>
            <div className="w-full bg-[#000054] fixed top-0 left-0 z-30">
                <Header />
            </div>
            <div className='w-screen bg-[#F3F4F6] flex flex-col lg:flex-row min-h-screen pb-20 pt-20 sm:pt-24 relative'>
                {/* Mobile filter toggle button */}
                <button
                    type="button"
                    onClick={() => setShowFilterPanel(!showFilterPanel)}
                    className="lg:hidden fixed top-20 sm:top-24 left-4 z-20 bg-[#E60028] text-white p-2 rounded-md shadow-lg"
                    aria-label="Toggle filters"
                >
                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                    </svg>
                </button>

                <form>
                    {/* Left side: filter */}
                    <div className={`${showFilterPanel ? 'block' : 'hidden'} lg:block fixed lg:relative inset-0 lg:inset-auto w-full lg:w-[390px] h-screen lg:h-auto z-15 lg:z-auto bg-black/50 lg:bg-transparent`} 
                         onClick={(e) => {
                             // Close when clicking on overlay (only on mobile)
                             if (e.target === e.currentTarget && window.innerWidth < 1024) {
                                 setShowFilterPanel(false);
                             }
                         }}>
                        <div className='w-full max-w-sm lg:max-w-none mx-auto lg:mx-0 bg-white py-6 lg:py-10 px-4 lg:pl-8 lg:pr-10 h-full lg:h-auto border-0 lg:border border-[#D9D9D9] overflow-y-auto'
                             onClick={(e) => e.stopPropagation()}>
                            {/* Mobile close button */}
                            <div className="flex lg:hidden justify-between items-center mb-4">
                                <h2 className='text-lg font-semibold text-[#625B71]'>FILTERS</h2>
                                <button
                                    type="button"
                                    onClick={() => setShowFilterPanel(false)}
                                    className="text-gray-500 hover:text-gray-700 p-1"
                                    aria-label="Close filters"
                                >
                                    <svg width="24" height="24" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>

                            <div className='hidden lg:flex items-center mb-5'>
                                <img src={filterIcon} alt='Filter' className='w-4 h-4 mr-4' />
                                <h2 className='text-lg font-semibold text-[#625B71]'>FILTER</h2>
                            </div>

                            {/* Clear and Apply all filters button */}
                            <div className='flex gap-1 sm:gap-2'>
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    className='w-full bg-white text-[#6A6A6A] py-2 text-sm sm:text-base rounded-lg cursor-pointer hover:bg-[#F3F4F6] border border-[#BDD7EF]'
                                >
                                    Reset
                                </button>
                                { /* disable when searching or when no filters selected */}
                                <button
                                    type="button"
                                    onClick={handleApply}
                                    disabled={isSearching || !hasFilters}
                                    className={`w-full rounded-lg border text-sm sm:text-base ${isSearching || !hasFilters ? 'bg-gray-200 text-gray-500 border-gray-200 cursor-not-allowed' : 'bg-[#E60028] text-white py-2 hover:bg-[#B4001F] border border-[#E60028]'}`}
                                >
                                    {isSearching ? 'Searching...' : 'Apply'}
                                </button>
                            </div>

                            <hr className='mt-4 sm:mt-6 mb-6 sm:mb-10' />

                            {/* Subsection: Academics name */}
                            <h4 className='text-base sm:text-lg mb-3 sm:mb-5 font-semibold'>Academics name</h4>
                            <div className='w-full relative'>
                                <input
                                    type="text"
                                    className='w-full border border-gray-300 rounded-sm py-2 px-3 sm:px-5 text-sm sm:text-base text-gray-500'
                                    placeholder='e.g. Michael'
                                    value={nameInput}
                                    onChange={e => setNameInput(e.target.value)}
                                    onFocus={() => setNameInputFocused(true)}
                                    onBlur={() => setNameInputFocused(false)}
                                />
                                <InlineNameDropdown
                                    show={nameInputFocused && !!nameInput.trim()}
                                    loading={nameLoading}
                                    suggestions={nameSuggestions}
                                    onSelect={(s) => { setNameInput(s.name); setNameSuggestions([]); }}
                                />
                            </div>

                            {/* Subsection: Research-based metrics */}
                            <div className='mt-8 sm:mt-16'>
                                <h4 className='text-base sm:text-lg mb-3 sm:mb-5 font-semibold'>Research-based metrics</h4>
                                <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0'>
                                    <label htmlFor="hIndex" className='whitespace-nowrap text-sm sm:text-base'>h-index</label>
                                    <div className='grid w-full sm:w-3/4 grid-cols-2 items-center gap-2 sm:gap-4'>
                                        <select
                                            className='border border-gray-300 bg-white rounded-sm py-1 px-2 text-gray-600 text-center text-sm sm:text-base'
                                            style={{ textAlign: 'center', textAlignLast: 'center' }}
                                            value={hIndexOp}
                                            onChange={e => setHIndexOp(e.target.value)}
                                            aria-label="h-index operator"
                                        >
                                            <option value="=">=</option>
                                            <option value="<">&lt;</option>
                                            <option value="<=">&le;</option>
                                            <option value=">">&gt;</option>
                                            <option value=">=">&ge;</option>
                                        </select>
                                        <div className='w-full border-b-1 border-[#6A6A6A] flex items-center py-1'>
                                            <input
                                                type='number'
                                                className='w-full focus:outline-0 text-center px-2 sm:px-3 text-sm sm:text-base'
                                                min={0}
                                                value={hIndexVal}
                                                onChange={e => setHIndexVal(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Space between elements */}
                                <div className='h-2' />

                                <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0'>
                                    <label htmlFor="i10Index" className='whitespace-nowrap text-sm sm:text-base'>i10-index</label>
                                    <div className='grid w-full sm:w-3/4 grid-cols-2 items-center gap-2 sm:gap-4'>
                                        <select
                                            className='border border-gray-300 bg-white rounded-sm py-1 px-2 text-gray-600 text-center text-sm sm:text-base'
                                            style={{ textAlign: 'center', textAlignLast: 'center' }}
                                            value={i10Op}
                                            onChange={e => setI10Op(e.target.value)}
                                            aria-label="i10-index operator"
                                        >
                                            <option value="=">=</option>
                                            <option value="<">&lt;</option>
                                            <option value="<=">&le;</option>
                                            <option value=">">&gt;</option>
                                            <option value=">=">&ge;</option>
                                        </select>
                                        <div className='w-full border-b-1 border-[#6A6A6A] flex items-center py-1'>
                                            <input
                                                type='number'
                                                className='w-full focus:outline-0 text-center px-2 sm:px-3 text-sm sm:text-base'
                                                min={0}
                                                value={i10Val}
                                                onChange={e => setI10Val(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Subsection: Field */}
                            <div className='mt-8 sm:mt-12'>
                                <div className='flex items-center justify-between'>
                                    <h4 className='text-base sm:text-lg mb-3 sm:mb-5 font-semibold mt-4 sm:mt-6'>Expertise field</h4>
                                    <button
                                        type="button"
                                        className='text-blue-600 text-sm sm:text-md font-normal hover:underline focus:outline-none mb-3 sm:mb-5'
                                        style={{ visibility: selectedFields.length > 0 ? 'visible' : 'hidden' }}
                                        onClick={() => { setSelectedFields([]); setHiddenTopicsByField({}); setSelectedTopicIds([]); setTopicKeyToId({}); }}
                                    >
                                        Clear filter
                                    </button>
                                </div>
                                <div className='flex items-center gap-2 sm:gap-3'>
                                    <img
                                        src={menuIcon}
                                        alt='Menu'
                                        className='w-3 h-4 sm:w-4 sm:h-5 cursor-pointer'
                                        onClick={() => setShowFieldModal(true)}
                                    />
                                    <div className='w-full relative'>
                                        <div className='border border-gray-300 bg-white rounded-lg flex justify-between items-center py-2 px-3 sm:px-4'>
                                            <input
                                                type='text'
                                                placeholder='e.g. Food nutrition'
                                                className='focus:outline-0 w-full text-sm sm:text-base'
                                                value={expertiseInput}
                                                onChange={e => setExpertiseInput(e.target.value)}
                                                onFocus={() => setExpertiseInputFocused(true)}
                                                onBlur={() => setTimeout(() => setExpertiseInputFocused(false), 150)}
                                            />
                                        </div>
                                        <InlineFieldDropdown
                                            show={expertiseInputFocused && !!expertiseInput.trim()}
                                            loading={expertiseLoading}
                                            results={expertiseResults}
                                            selectedFields={selectedFields}
                                            onSelectField={(name) => { handleFieldSelect(name); setExpertiseInput(""); setExpertiseResults([]); }}
                                            onSelectTopic={(payload) => {
                                                const { key, id } = payload || {};
                                                if (!key || !id) { return; }
                                                setTopicKeyToId(map => ({ ...(map || {}), [key]: String(id) }));
                                                // Determine selection toggle before calling handler
                                                const willSelect = !selectedFields.includes(key);
                                                setSelectedTopicIds(ids => willSelect ? (ids.includes(String(id)) ? ids : [...ids, String(id)]) : ids.filter(x => String(x) !== String(id)));
                                                handleFieldSelect(key);
                                                setExpertiseInput(""); setExpertiseResults([]);
                                            }}
                                        />
                                    </div>
                                </div>
                                <SelectedFieldChips
                                    items={selectedFields}
                                    onRemove={(field) => {
                                        setSelectedFields(prev => prev.filter(f => f !== field));
                                        // If it's a topic chip, also remove its id
                                        if (typeof field === 'string' && field.includes(' > ')) {
                                            const id = topicKeyToId[field];
                                            if (id) setSelectedTopicIds(ids => ids.filter(x => String(x) !== String(id)));
                                        }
                                    }}
                                />
                            </div>

                            {/* Subsection: Institution */}
                            <div className='mt-10'>
                                <div className='flex items-center justify-between'>
                                    <h4 className='text-lg mb-5 font-semibold mt-6'>Institutions</h4>
                                    <button
                                        type="button"
                                        className='text-blue-600 text-md font-normal hover:underline focus:outline-none mb-5'
                                        style={{ visibility: selectedInstitutions.length > 0 ? 'visible' : 'hidden' }}
                                        onClick={() => setSelectedInstitutions([])}
                                    >
                                        Clear filter
                                    </button>
                                </div>
                                <div className='flex items-center gap-3'>
                                    <img
                                        src={menuIcon}
                                        alt='Menu'
                                        className='w-4 h-5 cursor-pointer'
                                        onClick={() => setShowInstitutionModal(true)}
                                    />
                                    <div className='w-full relative'>
                                        <div className='border border-gray-300 bg-white rounded-lg flex justify-between items-center py-2 px-4'>
                                            <input
                                                type='text'
                                                placeholder='e.g. RMIT Vietnam'
                                                className='focus:outline-0 w-full'
                                                value={institutionInput}
                                                onChange={e => setInstitutionInput(e.target.value)}
                                                onFocus={() => setInstitutionInputFocused(true)}
                                                onBlur={() => setInstitutionInputFocused(false)}
                                            />
                                        </div>
                                        <InlineInstitutionsDropdown
                                            show={institutionInputFocused && !!institutionInput.trim()}
                                            loading={institutionLoading}
                                            suggestions={institutionSuggestions}
                                            selected={selectedInstitutions}
                                            onSelect={addInstitutionSelection}
                                        />
                                    </div>
                                </div>
                                <SelectedInstitutionChips
                                    items={selectedInstitutions}
                                    onRemove={(inst) => setSelectedInstitutions(prev => prev.filter(s => s.search_tag !== inst.search_tag))}
                                />
                            </div>

                            {/* Subsection: Institution country */}
                            <div className='mt-12'>
                                <h4 className='text-lg mb-5 font-semibold'>Institution countries</h4>
                                <div className='flex flex-col gap-2'>
                                    {leftPanelCountries.map(c => {
                                        const checked = selectedCountries.includes(c.search_tag);
                                        return (
                                            <label key={c.search_tag} className="flex items-center gap-3 py-1">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => {
                                                        setSelectedCountries(prev => prev.includes(c.search_tag) ? prev.filter(x => x !== c.search_tag) : [...prev, c.search_tag]);
                                                    }}
                                                    className="mr-3"
                                                />
                                                <span>{c.display_name}</span>
                                            </label>
                                        );
                                    })}

                                    {/* If there are no countries loaded yet show a small placeholder list */}
                                    {leftPanelCountries.length === 0 && (
                                        <div className="text-sm text-gray-500">Loading countries…</div>
                                    )}

                                    <button
                                        type="button"
                                        className='w-min self-end cursor-pointer text-gray-500'
                                        onClick={() => setShowCountryModal(true)}
                                    >More...</button>
                                </div>
                            </div>

                            <hr className='mt-3 mb-10 border-[#e9e9e9]' />

                            {/* Clear and Apply all filters button */}
                            <div className='flex gap-1 mb-8'>
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    className='w-full bg-white text-[#6A6A6A] py-2 rounded-lg cursor-pointer hover:bg-[#F3F4F6] border border-[#BDD7EF]'
                                >
                                    Reset
                                </button>
                                <button
                                    type="button"
                                    onClick={handleApply}
                                    disabled={isSearching || !hasFilters}
                                    className={`w-full rounded-lg border ${isSearching || !hasFilters ? 'bg-gray-200 text-gray-500 border-gray-200 cursor-not-allowed' : 'bg-[#E60028] text-white py-2 hover:bg-[#B4001F] border border-[#E60028]'}`}
                                >
                                    {isSearching ? 'Searching...' : 'Apply'}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>

                {/* Right side: conditional rendering */}
                <div className='w-full lg:w-3/5 mt-4 lg:mt-10 mx-auto px-4 lg:px-0'>
                    <div className='w-full flex flex-col'>
                        {isSearching ? (
                            <div className="flex flex-col items-center justify-center h-[300px] lg:h-[400px]">
                                <div className="animate-spin rounded-full h-8 w-8 lg:h-12 lg:w-12 border-b-2 border-[#E60028] mb-4"></div>
                                <h3 className='font-semibold text-lg lg:text-xl mb-2'>Searching…</h3>
                                <p className="text-xs lg:text-sm text-gray-500 text-center px-4">Looking for researchers that match your filters</p>
                            </div>
                        ) : searchError ? (
                            <div className="w-full mb-4 lg:mb-6">
                                <div className='bg-red-50 border border-red-200 text-red-700 rounded-md p-3 lg:p-4 flex flex-col sm:flex-row justify-between items-start gap-2'>
                                    <div>
                                        <h3 className='font-semibold mb-1 text-sm lg:text-base'>Search failed</h3>
                                        <p className='text-xs lg:text-sm'>{searchError}</p>
                                    </div>
                                    <button type="button" className='text-red-700 underline text-xs lg:text-sm self-end sm:self-start' onClick={() => setSearchError(null)}>Dismiss</button>
                                </div>
                            </div>
                        ) : !hasSearched ? (
                            <div className="flex flex-col items-center justify-center h-[300px] lg:h-[400px]">
                                <img src={noResultImage} alt="No results" className="w-24 h-24 lg:w-32 lg:h-32 mb-4" />
                                <h3 className='font-semibold text-lg lg:text-2xl mb-2'>No results to show</h3>
                                <p className="text-sm lg:text-md text-gray-500 text-center px-4">
                                    Choose the filters on the left panel to begin.
                                </p>
                            </div>
                        ) : (hasSearched && peopleList.length === 0) ? (
                            <>
                                {(() => {
                                    const topics = [];
                                    (selectedFields || []).forEach(l => {
                                        if (!l) return;
                                        const s = String(l);
                                        const topicOnly = s.includes(' > ') ? s.split(' > ').pop() : s;
                                        topics.push(topicOnly);
                                    });
                                    const insts = (selectedInstitutions || []).map(i => i?.display_name).filter(Boolean).map(String);
                                    const countriesDisp = (selectedCountries || []).map(tag => {
                                        const item = countriesList.find(c => c.search_tag === tag);
                                        return item?.display_name ? String(item.display_name) : null;
                                    }).filter(Boolean);
                                    const name = String(nameInput || '').trim();

                                    return (
                                        <div className='text-sm lg:text-base text-gray-700 font-medium'>
                                            <p className='mb-1'>
                                                Found <span className='font-semibold'>{totalResults.toLocaleString()}</span> results:
                                            </p>
                                            {(topics.length || insts.length || countriesDisp.length || name) ? (
                                                <ul className='list-disc pl-4 lg:pl-5 space-y-1'>
                                                    {topics.length ? <li className="text-xs lg:text-sm">Topics: <span className='font-semibold'>{topics.join(', ')}</span></li> : null}
                                                    {insts.length ? <li className="text-xs lg:text-sm">Institutions: <span className='font-semibold'>{insts.join(', ')}</span></li> : null}
                                                    {countriesDisp.length ? <li className="text-xs lg:text-sm">Countries: <span className='font-semibold'>{countriesDisp.join(', ')}</span></li> : null}
                                                    {name ? <li className="text-xs lg:text-sm">Name: <span className='font-semibold'>{name}</span></li> : null}
                                                </ul>
                                            ) : null}
                                        </div>
                                    );
                                })()}
                                <div className='w-full flex flex-col gap-4 lg:gap-6 my-6 lg:my-10'>
                                    <div className='w-full flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4'>
                                        <div className='flex-1 w-full lg:w-auto'>
                                            <SortBar
                                                sortBy={sortBy}
                                                sortOrder={sortOrder}
                                                onChange={(key, order) => { setSortBy(key); setSortOrder(order); }}
                                            />
                                        </div>
                                        <label className='shrink-0 flex items-center gap-2 text-xs lg:text-sm text-[#6A6A6A]'>
                                            <input
                                                type='checkbox'
                                                className='w-3 h-3 lg:w-4 lg:h-4 accent-[#E60028]'
                                                checked={onlyFullMatches}
                                                onChange={(e) => setOnlyFullMatches(e.target.checked)}
                                            />
                                            Exact matches only
                                        </label>
                                    </div>
                                </div>
                                <div className="flex flex-col items-center justify-center h-[250px] lg:h-[300px]">
                                    <img src={noResultImage} alt="No results" className="w-20 h-20 lg:w-24 lg:h-24 mb-4" />
                                    <h3 className='font-semibold text-lg lg:text-2xl mb-2'>No results to show</h3>
                                    <p className="text-sm lg:text-md text-gray-500 text-center mt-2 px-4">
                                        We couldn't find anyone matching your filter. <br />
                                        Try changing your search criteria.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Sort and toolbar */}
                                {(() => {
                                    const topics = [];
                                    (selectedFields || []).forEach(l => {
                                        if (!l) return;
                                        const s = String(l);
                                        const topicOnly = s.includes(' > ') ? s.split(' > ').pop() : s;
                                        topics.push(topicOnly);
                                    });
                                    const insts = (selectedInstitutions || []).map(i => i?.display_name).filter(Boolean).map(String);
                                    const countriesDisp = (selectedCountries || []).map(tag => {
                                        const item = countriesList.find(c => c.search_tag === tag);
                                        return item?.display_name ? String(item.display_name) : null;
                                    }).filter(Boolean);
                                    const name = String(nameInput || '').trim();

                                    return (
                                        <div className='text-sm lg:text-base text-gray-700 -mt-2 lg:-mt-5 mb-4 lg:mb-8 font-medium'>
                                            <p className='mb-1'>
                                                Found <span className='font-semibold'>{totalResults.toLocaleString()}</span> results:
                                            </p>
                                            {(topics.length || insts.length || countriesDisp.length || name) ? (
                                                <ul className='list-disc pl-6 lg:pl-10 space-y-1'>
                                                    {topics.length ? <li className="text-xs lg:text-sm">Topics: <span className='font-semibold'>{topics.join(', ')}</span></li> : null}
                                                    {insts.length ? <li className="text-xs lg:text-sm">Institutions: <span className='font-semibold'>{insts.join(', ')}</span></li> : null}
                                                    {countriesDisp.length ? <li className="text-xs lg:text-sm">Countries: <span className='font-semibold'>{countriesDisp.join(', ')}</span></li> : null}
                                                    {name ? <li className="text-xs lg:text-sm">Name: <span className='font-semibold'>{name}</span></li> : null}
                                                </ul>
                                            ) : null}
                                        </div>
                                    );
                                })()}
                                <div className='w-full flex flex-col gap-4 lg:gap-6 mb-3'>
                                    <div className='w-full flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-3 lg:mb-5'>
                                        <div className='flex-1 w-full lg:w-auto'>
                                            <SortBar
                                                sortBy={sortBy}
                                                sortOrder={sortOrder}
                                                onChange={(key, order) => { setSortBy(key); setSortOrder(order); }}
                                            />
                                        </div>
                                        <label className='shrink-0 flex items-center gap-2 text-xs lg:text-sm text-[#6A6A6A]'>
                                            <input
                                                type='checkbox'
                                                className='w-3 h-3 lg:w-4 lg:h-4 accent-[#E60028]'
                                                checked={onlyFullMatches}
                                                onChange={(e) => setOnlyFullMatches(e.target.checked)}
                                            />
                                            Exact matches only
                                        </label>
                                    </div>
                                    {/* Results toolbar */}
                                    <div className='w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative'>
                                        <p className="text-sm lg:text-base">
                                            Showing <b>
                                                {totalResults === 0 ? 0 : ((currentPage - 1) * perPage + 1)}
                                                -
                                                {Math.min(currentPage * perPage, totalResults)}
                                            </b> in <b>{totalResults.toLocaleString()}</b>
                                        </p>
                                    <div className='flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4'>
                                        <label htmlFor='resultsPerPage' className='text-xs lg:text-sm text-[#6A6A6A] whitespace-nowrap'>Max results per page:</label>
                                        <select
                                            name="resultsPerPage"
                                            id="resultsPerPage"
                                            value={perPage}
                                            onChange={async (e) => {
                                                const newLimit = Number(e.target.value);
                                                setPerPage(newLimit);
                                                // reset to page 1 when changing page size
                                                await loadResults({ page: 1, limit: newLimit });
                                            }}
                                            className='border border-gray-300 bg-white rounded-lg py-1 px-2 text-sm lg:text-base'
                                        >
                                            <option value="10">10</option>
                                            <option value="20">20</option>
                                            <option value="50">50</option>
                                        </select>
                                    </div>
                                    </div>
                                </div>

                                {/* People List */}
                                {peopleList.map((person, index) => {
                                    const name = person.name || person.basic_info?.name || '';
                                    const institution = person.institution || (Array.isArray(person.last_known_affiliations) ? person.last_known_affiliations.filter(Boolean).join(', ') : '');
                                    const hIndex = person.hIndex ?? person.research_metrics?.h_index ?? '';
                                    const i10Index = person.i10Index ?? person.research_metrics?.i10_index ?? '';
                                    const fieldsArr = Array.isArray(person.fields) && person.fields.length
                                        ? person.fields.filter(Boolean)
                                        : (person.field ? [person.field] : []);
                                    const totalCitations = person.research_metrics?.total_citations ?? '';
                                    const totalWorks = person.research_metrics?.total_works ?? '';
                                    const fmt = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v))) ? '' : Number(v).toLocaleString();
                                    const slug = person.slug || '';
                                    const researcherId = person._id || person.id || person.slug;
                                    return (
                                        <div className='relative w-full h-max mb-4 lg:mb-6 flex items-center justify-between border-1 border-[#D9D9D9] py-4 lg:py-6 pl-4 lg:pl-6 pr-6 lg:pr-8 bg-white rounded-sm' key={index}>
                                            <div className='absolute top-2 lg:top-0 right-2 lg:right-3'>
                                                <BookmarkIcon size={24} className='lg:w-8 lg:h-8 m-0 p-0' researcherId={String(researcherId || '')} researcherName={name} />
                                            </div>
                                            <div className='w-full'>
                                                <div className='flex flex-col lg:flex-row gap-4 lg:gap-6 justify-between items-start w-full pr-8 lg:pr-5'>
                                                    <div className='flex-1 min-w-0 w-full'>
                                                        <div className='flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3 lg:mb-1 min-w-0'>
                                                            <p className='font-bold text-lg lg:text-xl'>{name}</p>
                                                            <div className="hidden sm:flex items-center gap-3">
                                                                <img src={Dot} alt='Dot' className='w-2 h-2' />
                                                                <p className='text-[#6A6A6A] text-sm lg:text-md truncate min-w-0 flex-1' title={institution}>{institution}</p>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Mobile institution display */}
                                                        <div className="sm:hidden mb-3">
                                                            <p className='text-[#6A6A6A] text-sm truncate' title={institution}>{institution}</p>
                                                        </div>

                                                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-x-4 lg:gap-x-8 gap-y-2 lg:gap-y-1 items-start justify-start'>
                                                            <div className='text-xs lg:text-sm text-[#6A6A6A] flex items-center gap-2'>
                                                                <img src={letterH} alt='H' className='w-3 h-3 lg:w-4 lg:h-4' />
                                                                <span>h-index: {fmt(hIndex)}</span>
                                                            </div>
                                                            <div className='text-xs lg:text-sm text-[#6A6A6A] flex items-center gap-2'>
                                                                <img src={documentIcon} alt='Works' className='w-3 h-3 lg:w-4 lg:h-4' />
                                                                <span>Total works: {fmt(totalWorks)}</span>
                                                            </div>
                                                            <div className='text-xs lg:text-sm text-[#6A6A6A] flex items-center gap-2'>
                                                                <img src={scholarHat} alt='i10' className='w-3 h-3 lg:w-4 lg:h-4' />
                                                                <span>i10-index: {fmt(i10Index)}</span>
                                                            </div>
                                                            <div className='text-xs lg:text-sm text-[#6A6A6A] flex items-center gap-2'>
                                                                <img src={citationIcon} alt='Citations' className='w-3 h-3 lg:w-4 lg:h-4' />
                                                                <span>Total citations: {fmt(totalCitations)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className='shrink-0 self-start flex items-center gap-3 w-full sm:w-auto mt-4 lg:mt-0'>
                                                        <button
                                                            className='w-full sm:w-auto whitespace-nowrap text-[#3C72A5] text-sm lg:text-md font-semibold py-2 px-4 lg:px-6 bg-[#d2e4f4] rounded-lg cursor-pointer hover:underline disabled:opacity-50 disabled:cursor-not-allowed'
                                                            onClick={() => { try { sessionStorage.setItem('restoreSearchState','1'); } catch {} if (slug) navigate(`/researcher-profile/${slug}`); }}
                                                            disabled={!slug}
                                                        >
                                                            View profile
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className='mt-4 lg:mt-6'>
                                                    {(() => {
                                                        const matchObj = person.match || {};
                                                        const matchedCount = Number(matchObj.matchCount || 0);
                                                        const totalFilters = Number(matchObj.totalFilters || 0);
                                                        const matched = Array.isArray(matchObj.matched) ? matchObj.matched.filter(Boolean) : [];
                                                        const unmatched = Array.isArray(matchObj.unmatched) ? matchObj.unmatched.filter(Boolean) : [];
                                                        return (
                                                            <div>
                                                                {(() => {
                                                                    const full = totalFilters > 0 && matchedCount === totalFilters;
                                                                    const chipClass = full
                                                                        ? 'bg-green-100 text-green-700 border border-green-200'
                                                                        : 'bg-gray-100 text-gray-700 border border-gray-200';
                                                                    return (
                                                                        <div className={`inline-flex items-center py-1 px-2 lg:px-3 rounded-full text-xs lg:text-sm font-medium ${chipClass}`}>
                                                                            Matches {matchedCount}/{totalFilters} filters
                                                                        </div>
                                                                    );
                                                                })()}
                                                                {matched.length > 0 && !(totalFilters > 0 && matchedCount === totalFilters) && (
                                                                    <div className='mt-2 text-xs text-gray-700'>
                                                                        <span className='font-medium mr-1'>Matched:</span>
                                                                        <span className="break-words">{matched.join(', ')}</span>
                                                                    </div>
                                                                )}
                                                                {unmatched.length > 0 && (
                                                                    <div className='mt-1 text-xs text-gray-600'>
                                                                        <span className='font-medium mr-1'>Not matched:</span>
                                                                        <span className="break-words">{unmatched.join(', ')}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <PaginationBar
                                    currentPage={currentPage}
                                    perPage={perPage}
                                    totalResults={totalResults}
                                    onGoToPage={(p) => loadResults({ page: p, limit: perPage })}
                                />
                            </>
                        )}
                    </div>
                </div>

            </div>

            <CountryModalComp open={showCountryModal} onClose={handleCountryClose} selected={selectedCountries} onSelect={handleCountrySelect} />
            <FieldModalComp
                open={showFieldModal}
                onClose={handleFieldClose}
                selected={selectedFields}
                onSelect={handleFieldSelect}
                onSelectTopic={({ key, id }) => {
                    if (!key || !id) return;
                    setTopicKeyToId(map => ({ ...(map || {}), [key]: String(id) }));
                    const willSelect = !selectedFields.includes(key);
                    setSelectedTopicIds(ids => willSelect ? (ids.includes(String(id)) ? ids : [...ids, String(id)]) : ids.filter(x => String(x) !== String(id)));
                }}
                search={fieldSearch}
                onSearch={setFieldSearch}
            />

            <InstitutionModalComp open={showInstitutionModal} onClose={handleInstitutionClose} selected={selectedInstitutions} onSelect={toggleInstitutionSelection} />
            <Footer />
        </div>
    );
}
export default SearchInterface;
