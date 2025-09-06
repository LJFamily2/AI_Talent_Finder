import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import searchIcon from '../assets/search.png';
import menuIcon from '../assets/menu.png';
import sortIcon from '../assets/sort.png';
import { Switch } from "@/components/ui/switch"
import Bulb from '../assets/lightbulb.png';
import Dot from '../assets/dot.png';
import filterIcon from '../assets/filter.png';
import noResultImage from '../assets/no-result.png';
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination"
import Footer from '@/components/Footer';
import documentIcon from '../assets/document.png';
import nameIcon from '../assets/name.png';
import citationIcon from '../assets/citation.png';
import scoreIcon from '../assets/score.png';
import {
    buildFilterPayload,
    searchResearchers,
    // loadCountriesFilter,
    searchInstitutions,
    listInstitutions,
    loadAllFields,
    loadTopicsForField,
} from '@/services/searchFiltersService';

function SearchInterface() {
    const [showCountryModal, setShowCountryModal] = useState(false);
    const [countrySearch, setCountrySearch] = useState("");
    const [selectedCountries, setSelectedCountries] = useState([]);
    const [showFieldModal, setShowFieldModal] = useState(false);
    const [fieldSearch, setFieldSearch] = useState("");
    const [selectedFields, setSelectedFields] = useState([]);
    // Add state for expertise input and focus
    const [expertiseInput, setExpertiseInput] = useState("");
    const [expertiseInputFocused, setExpertiseInputFocused] = useState(false);
    // const [peopleList, setPeopleList] = useState([]);
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [hasSearched, setHasSearched] = useState(false);
    const [peopleList, setPeopleList] = useState([]);
    // const navigate = useNavigate();

    useEffect(() => {
        fetch('/api/researchers?page=1&limit=10')
          .then(res => res.json())
        .then(data => {
            console.log('API response:', data);
            setPeopleList(data.peopleList || []);
    });
      }, []);

    // // State for institutions filter
    const [showInstitutionModal, setShowInstitutionModal] = useState(false);
    const [selectedInstitutions, setSelectedInstitutions] = useState([]); // array of { search_tag, display_name }
    const [institutionInput, setInstitutionInput] = useState("");
    const [institutionInputFocused, setInstitutionInputFocused] = useState(false);
    const [institutionSuggestions, setInstitutionSuggestions] = useState([]);
    const [institutionLoading, setInstitutionLoading] = useState(false);
    const instLastQueryRef = useRef("");

    const COUNTRY_LIST = [
        'United States of America', 'China', 'Brazil', 'India', 'Germany',
        'United Kingdom of Great Britain and Northern Ireland', 'Indonesia', 'Japan', 'France', 'Russian Federation', 'Spain',
        // ... add more countries as needed
    ];
    const FIELD_LIST = [
        'Aviation', 'Psychology', 'Mechanical Engineering', 'Food Nutrition', 'Software Testing',
        'Data Science', 'Civil Engineering', 'Business Administration', 'Physics', 'Mathematics',
        // ... add more fields as needed
    ];

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

    let initialPeopleList = [
        { name: 'Jason Carroll', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 },
        { name: 'James Kim', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 },
        { name: 'Medison Pham', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 },
        { name: 'Linh Cao', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 },
        { name: 'Cuong Nguyen', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 },
        { name: 'Kim Cheoul', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 },
        { name: 'Minh Tran', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 },
        { name: 'Cuong Nguyen', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 }]

    function SortModal({ selected, onSelect, onClose }) {
        const modalRef = useRef(null);
        useEffect(() => {
            function handleClickOutside(event) {
                if (modalRef.current && !modalRef.current.contains(event.target)) {
                    onClose();
                }
            }
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }, [onClose]);
        return (
            <div
                ref={modalRef}
                className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 p-6"
            >
                <div className="text-[#6A6A6A] text-md mb-2">Sort by:</div>
                <hr className="mb-4" />
                <div className="flex flex-col gap-4">
                    <label className="flex items-center gap-5 cursor-pointer rounded-lg transition-colors hover:bg-gray-100 px-2 py-2">
                        <img src={scoreIcon} alt="Score" className="w-6 h-6" />
                        <span className="flex-1">Ranking score</span>
                        <input
                            type="radio"
                            name="sort"
                            checked={selected === 'ranking'}
                            onChange={() => onSelect('ranking')}
                            className="sr-only"
                        />
                    </label>
                    <label className="flex items-center gap-5 cursor-pointer rounded-lg transition-colors hover:bg-gray-100 px-2 py-2">
                        <img src={citationIcon} alt="Citations" className="w-6 h-6" />
                        <span className="flex-1">Citations count</span>
                        <input
                            type="radio"
                            name="sort"
                            checked={selected === 'citations'}
                            onChange={() => onSelect('citations')}
                            className="sr-only"
                        />
                    </label>
                    <label className="flex items-center gap-5 cursor-pointer rounded-lg transition-colors hover:bg-gray-100 px-2 py-2">
                        <img src={documentIcon} alt="Publications" className="w-6 h-6" />
                        <span className="flex-1">Publications count</span>
                        <input
                            type="radio"
                            name="sort"
                            checked={selected === 'publications'}
                            onChange={() => onSelect('publications')}
                            className="sr-only"
                        />
                    </label>
                    <label className="flex items-center gap-5 cursor-pointer rounded-lg transition-colors hover:bg-gray-100 px-2 py-2">
                        <img src={nameIcon} alt="Name" className="w-6 h-6" />
                        <span className="flex-1">Name</span>
                        <input
                            type="radio"
                            name="sort"
                            checked={selected === 'name'}
                            onChange={() => onSelect('name')}
                            className="sr-only"
                        />
                    </label>
                </div>
            </div>
        );
    }

    function CountryModal({ open, onClose, countries, selected, onSelect, search, onSearch }) {
        const modalRef = useRef(null);
        useEffect(() => {
            function handleClickOutside(event) {
                if (modalRef.current && !modalRef.current.contains(event.target)) {
                    onClose();
                }
            }
            if (open) document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }, [onClose, open]);
        const filtered = countries.filter(c => c.toLowerCase().includes(search.toLowerCase()));
        return open ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
                <div ref={modalRef} className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] p-6 pr-10 pt-8 relative flex flex-col">
                    <button className="absolute top-1 right-4 text-2xl text-gray-400 hover:text-gray-600" onClick={onClose} aria-label="Close">&times;</button>
                    <input
                        type="text"
                        placeholder="Search institution countries"
                        className="w-full border border-gray-200 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring"
                        value={search}
                        onChange={e => onSearch(e.target.value)}
                    />
                    <div className="text-gray-500 text-sm mb-2">All countries ({countries.length})</div>
                    <div className="border-b mb-2"></div>
                    <div className="overflow-y-auto flex-1 pr-2" style={{ maxHeight: '50vh' }}>
                        {filtered.map((country, idx) => (
                            <label key={country} className="flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer hover:bg-gray-100">
                                <input
                                    type="checkbox"
                                    checked={selected.includes(country)}
                                    onChange={() => onSelect(country)}
                                    className="w-5 h-5 accent-[#E60028]"
                                />
                                <span>{country}</span>
                            </label>
                        ))}
                        {filtered.length === 0 && <div className="text-gray-400 text-center py-8">No countries found</div>}
                    </div>
                </div>
            </div>
        ) : null;
    }

    // REPLACED FieldModal: load all fields once, lazy-load topics per-field on expand
    function FieldModal({ open, onClose, selected, onSelect, search, onSearch }) {
        const modalRef = useRef(null);
        const [fields, setFields] = useState([]); // [{ _id, display_name }]
        const [loadingFields, setLoadingFields] = useState(false);
        const [topicsMap, setTopicsMap] = useState({}); // { fieldIdKey: { topics: [], total } }
        const [loadingTopics, setLoadingTopics] = useState({}); // { fieldIdKey: boolean }
        const [expandedSet, setExpandedSet] = useState(new Set()); // store fieldId keys that are expanded

        useEffect(() => {
            function handleClickOutside(event) {
                if (modalRef.current && !modalRef.current.contains(event.target)) {
                    onClose();
                }
            }
            if (open) document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }, [onClose, open]);

        // load all fields once when modal opens
        useEffect(() => {
            if (!open) return;
            setFields([]);
            setTopicsMap({});
            setExpandedSet(new Set());
            setLoadingFields(true);
            loadAllFields()
                .then(list => setFields(list))
                .catch(err => console.error("loadAllFields error:", err))
                .finally(() => setLoadingFields(false));
        }, [open]);

        function toggleField(fieldName) {
            onSelect(fieldName);
        }

        // toggle topic selection using a synthetic key "Field > Topic"
        function toggleTopic(fieldName, topicName) {
            const key = `${fieldName} > ${topicName}`;
            onSelect(key);
        }

        function toggleExpand(field) {
            const fieldIdKey = field._id ? String(field._id) : `null`;
            setExpandedSet(prev => {
                const next = new Set(prev);
                if (next.has(fieldIdKey)) next.delete(fieldIdKey);
                else next.add(fieldIdKey);
                return next;
            });

            // if topics not loaded yet, fetch them
            if (!topicsMap[fieldIdKey]) {
                setLoadingTopics(prev => ({ ...prev, [fieldIdKey]: true }));
                const fetchId = field._id ? field._id : "null";
                loadTopicsForField(fetchId, 0, 5000, "") // limit large enough to pull all topics for that field
                    .then(res => {
                        setTopicsMap(prev => ({ ...prev, [fieldIdKey]: { topics: res.topics || [], total: res.total || 0 } }));
                    })
                    .catch(err => {
                        console.error("loadTopicsForField error:", err);
                        setTopicsMap(prev => ({ ...prev, [fieldIdKey]: { topics: [], total: 0 } }));
                    })
                    .finally(() => setLoadingTopics(prev => ({ ...prev, [fieldIdKey]: false })));
            }
        }

        return open ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
                <div ref={modalRef} className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] p-6 pr-10 pt-8 relative flex flex-col">
                    <button className="absolute top-1 right-4 text-2xl text-gray-400 hover:text-gray-600" onClick={onClose} aria-label="Close">&times;</button>
                    <input
                        type="text"
                        placeholder="Search fields or topics"
                        className="w-full border border-gray-200 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring"
                        value={search}
                        onChange={e => onSearch(e.target.value)}
                    />
                    <div className="text-gray-500 text-sm mb-2">Fields ({fields.length})</div>
                    <div className="border-b mb-2"></div>
                    <div className="overflow-y-auto flex-1 pr-2" style={{ maxHeight: '50vh' }}>
                        {loadingFields && <div className="text-center py-4 text-gray-500">Loading fields…</div>}
                        {!loadingFields && fields.map((f, fi) => {
                            const fieldIdKey = f._id ? String(f._id) : `null`;
                            const fieldSelected = selected.includes(f.display_name);
                            const isExpanded = expandedSet.has(fieldIdKey);
                            const topicEntry = topicsMap[fieldIdKey];
                            return (
                                <div key={fieldIdKey} className="py-2 px-2 border-b last:border-b-0">
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={fieldSelected}
                                                onChange={() => toggleField(f.display_name)}
                                                className="w-5 h-5 accent-[#E60028]"
                                            />
                                            <span className="font-medium">{f.display_name}</span>
                                            <span className="text-sm text-gray-400 ml-2">({
                                                // prefer server-provided count from loadAllFields,
                                                // fallback to already-loaded topics total, otherwise show '...'
                                                f.topics_count !== undefined && f.topics_count !== null
                                                    ? f.topics_count
                                                    : (topicEntry ? topicEntry.total : '...')
                                            })</span>
                                        </label>
                                        <button
                                            className="text-sm text-gray-600 hover:text-gray-800 px-2 py-1"
                                            onClick={() => toggleExpand(f)}
                                            aria-expanded={isExpanded}
                                            aria-controls={`topics_${fieldIdKey}`}
                                        >
                                            <span style={{ display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}>▸</span>
                                        </button>
                                    </div>

                                    {/* Collapsible topics */}
                                    <div id={`topics_${fieldIdKey}`} className={`ml-8 mt-2 flex flex-col gap-1 transition-all ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                                        {isExpanded ? (
                                            loadingTopics[fieldIdKey] ? (
                                                <div className="text-sm text-gray-500">Loading topics…</div>
                                            ) : (Array.isArray(topicEntry?.topics) && topicEntry.topics.length ? topicEntry.topics.map((t, ti) => {
                                                const topicKey = `${f.display_name} > ${t.display_name}`;
                                                const topicChecked = selected.includes(topicKey);
                                                return (
                                                    <label key={`${String(t._id)}_${ti}`} className={`flex items-center gap-3 text-sm ${fieldSelected ? 'opacity-50' : ''}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={topicChecked}
                                                            disabled={fieldSelected}
                                                            onChange={() => toggleTopic(f.display_name, t.display_name)}
                                                            className="w-4 h-4 accent-[#E60028]"
                                                        />
                                                        <span>{t.display_name}</span>
                                                    </label>
                                                );
                                            }) : <div className="text-sm text-gray-400">No topics</div>)
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}
                        {!loadingFields && fields.length === 0 && <div className="text-gray-400 text-center py-8">No fields found</div>}
                    </div>
                </div>
            </div>
        ) : null;
    }

    function InstitutionModal({ open, onClose, selected, onSelect }) {
        const modalRef = useRef(null);
        const [query, setQuery] = useState("");
        const [items, setItems] = useState([]);
        const [offset, setOffset] = useState(0);
        const [hasMore, setHasMore] = useState(true);
        const [loading, setLoading] = useState(false);
        const sentinelRef = useRef(null);
        const PAGE_SIZE = 50;
        const lastQueryRef = useRef("");

        useEffect(() => {
            function handleClickOutside(event) {
                if (modalRef.current && !modalRef.current.contains(event.target)) {
                    onClose();
                }
            }
            if (open) document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }, [onClose, open]);

        // load initial page when modal opens and no query
        useEffect(() => {
            if (!open) return;
            setItems([]);
            setOffset(0);
            setHasMore(true);
            setQuery("");
            lastQueryRef.current = "";

            (async () => {
                setLoading(true);
                try {
                    const page = await listInstitutions(0, PAGE_SIZE);
                    setItems(page);
                    setOffset(page.length);
                    setHasMore(page.length === PAGE_SIZE);
                } catch (error) {
                    console.error("listInstitutions error:", error);
                } finally {
                    setLoading(false);
                }
            })();

        }, [open]);

        //debounced search when query changes
        useEffect(() => {
            const q = (query || "").trim();
            lastQueryRef.current = q;
            const timer = setTimeout(async () => {
                if (!open) return;
                if (!q) {
                    // when query cleared, reload initial list
                    setLoading(true);
                    try {
                        const page = await listInstitutions(0, PAGE_SIZE);
                        setItems(page);
                        setOffset(page.length);
                        setHasMore(page.length === PAGE_SIZE);
                    } catch (error) {
                        console.error("listInstitutions error:", error);
                    } finally {
                        setLoading(false);
                    }
                    return;
                }

                setLoading(true);
                try {
                    const results = await searchInstitutions(q);
                    if (lastQueryRef.current !== q) return;
                    setItems(results);
                    setOffset(results.length);
                    setHasMore(false);
                } catch (error) {
                    console.error("searchInstitutions error", error);
                } finally {
                    setLoading(false);
                }
            }, 350);
            return () => clearTimeout(timer);
        }, [query, open]);

        useEffect(() => {
            if (!open) return;
            if (query && query.trim()) return;  // don't infinite-scroll while searching
            const el = sentinelRef.current;
            if (!el) return;
            const obs = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && hasMore && !loading) {
                        (async () => {
                            setLoading(true);
                            try {
                                const page = await listInstitutions(offset, PAGE_SIZE);
                                setItems(prev => [...prev, ...page]);
                                setOffset(prev => prev + page.length);
                                setHasMore(page.length === PAGE_SIZE);
                            } catch (err) {
                                console.error("listInstitutions (more) error", err);
                            } finally {
                                setLoading(false);
                            }
                        })();
                    }
                });
            }, { root: null, rootMargin: "0px", threshold: 1.0 });

            obs.observe(el);
            return () => obs.disconnect();
        }, [open, offset, hasMore, loading, query])

        const filtered = items;
        return open ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
                <div ref={modalRef} className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] p-6 pr-10 pt-8 relative flex flex-col">
                    <button className="absolute top-1 right-4 text-2xl text-gray-400 hover:text-gray-600" onClick={onClose} aria-label="Close">&times;</button>
                    <input
                        type="text"
                        placeholder="Search institutions..."
                        className="w-full border border-gray-200 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    <div className="text-gray-500 text-sm mb-2">All institutions ({items.length})</div>
                    <div className="border-b mb-2"></div>
                    <div className="overflow-y-auto flex-1 pr-2" style={{ maxHeight: '50vh' }}>
                        {filtered.map((item) => {
                            const checked = selected.some(s => s.search_tag === item.search_tag); // compare by search_tag
                            return (
                                <label key={item.search_tag} className="flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer hover:bg-gray-100">
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => onSelect(item)} // pass the item object; parent toggles by search_tag
                                        className="w-5 h-5 accent-[#E60028]"
                                    />
                                    <span>{item.display_name}</span>
                                </label>
                            );
                        })}
                        {filtered.length === 0 && !loading && <div className="text-gray-400 text-center py-8">No institutions found</div>}
                        {loading && <div className="text-center py-4 text-gray-500">Loading...</div>}
                        <div ref={sentinelRef} style={{ height: 1 }} />
                    </div>
                </div>
            </div>
        ) : null;
    }

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

    async function handleApply(e) {
        e?.preventDefault?.();
        setHasSearched(true); // Mark that a search has been performed
        // gather controlled state values (avoid DOM queries)
        const payload = buildFilterPayload({
            selectedInstitutions,
            // selectedFields,
            // selectedCountries,
            page: 1,
            limit: 20
        });

        try {
            const results = await searchResearchers(payload);
            setPeopleList(results.peopleList || []);
        } catch (err) {
            setPeopleList([]);
            // handle error
            console.error("searchResearchers failed error:", err);
        }
    }

    return (
        <div>
            <Header />
            <div className='w-screen h-max bg-[#F3F4F6] flex'>
                <form>
                    {/* Left side: filter */}
                <div className='w-fit min-w-[390px] h-full flex justify-center'>
                    <div className='w-full bg-white py-10 pl-8 pr-10 h-full border border-[#D9D9D9]'>
                        <div className='flex items-center mb-5'>
                            <img src={filterIcon} alt='Filter' className='w-4 h-4 mr-4' />
                            <h2 className='text-lg font-semibold text-[#625B71]'>FILTER</h2>
                        </div>

                        {/* Clear and Apply all filters button */}
                        <div className='flex gap-1'>
                            <input type='reset' value="Reset" className='w-full bg-white text-[#6A6A6A] py-2 rounded-lg cursor-pointer hover:bg-[#F3F4F6] border border-[#BDD7EF]' />
                            <button
                                type="button"
                                onClick={handleApply}
                                className='w-full bg-[#E60028] text-white rounded-lg cursor-pointer hover:bg-[#B4001F] border border-[#E60028]'
                            >
                                Apply
                            </button>
                        </div>

                        <hr className='mt-6 mb-10' />

                        {/* Subsection: Academics name */}
                        <h4 className='text-lg mb-5 font-semibold'>Academics name</h4>
                        <input type="text" className='w-full border border-gray-300 rounded-sm py-2 px-5 text-gray-500' placeholder='e.g. Michael' />

                        {/* Subsection: Research-based metrics */}
                        <div className='mt-16'>
                            <h4 className='text-lg mb-5 font-semibold'>Research-based metrics</h4>
                            <div className='flex items-center justify-between '>
                                <label htmlFor="hIndex" className='whitespace-nowrap'>h-index</label>
                                <div className='flex w-3/4 justify-end items-center gap-5'>
                                    <select name="comparison" className='border border-gray-300 bg-white rounded-sm py-1 px-2 text-gray-500'>
                                        <option value="equals" >equals</option>
                                        <option value="less-than">less than</option>
                                        <option value="larger-than">larger than</option>
                                    </select>
                                    <div className='w-2/5 border-b-1 border-[#6A6A6A] flex items-center py-1'>
                                        <input type='number' id="hIndex" className='w-30 focus:outline-0 text-end px-3' min={0} />
                                    </div>
                                </div>
                            </div>

                            {/* Space between elements */}
                            <div className='h-2' />

                            <div className='flex items-center justify-between'>
                                <label htmlFor="i10Index" className='whitespace-nowrap'>i10-index</label>
                                <div className='flex w-3/4 justify-end items-center gap-5'>
                                    <select name="comparison" className='border border-gray-300 bg-white rounded-sm py-1 px-2 text-gray-500'>
                                        <option value="equals" >equals</option>
                                        <option value="less-than">less than</option>
                                        <option value="larger-than">larger than</option>
                                    </select>
                                    <div className='w-2/5 border-b-1 border-[#6A6A6A] flex items-center py-1'>
                                        <input type='number' id="i10Index" className='w-30 focus:outline-0 text-end px-3' min={0} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Subsection: Field */}
                        <div className='mt-12'>
                            <div className='flex items-center justify-between'>
                                <h4 className='text-lg mb-5 font-semibold mt-6'>Expertise field</h4>
                                <button
                                    className='text-blue-600 text-md font-normal hover:underline focus:outline-none mb-5'
                                    style={{ visibility: selectedFields.length > 0 ? 'visible' : 'hidden' }}
                                    onClick={() => setSelectedFields([])}
                                >
                                    Clear filter
                                </button>
                            </div>
                            <div className='flex items-center gap-3'>
                                <img
                                    src={menuIcon}
                                    alt='Menu'
                                    className='w-4 h-5 cursor-pointer'
                                    onClick={() => setShowFieldModal(true)}
                                />
                                <div className='w-full relative'>
                                    <div className='border border-gray-300 bg-white rounded-lg flex justify-between items-center py-2 px-4'>
                                        <input
                                            type='text'
                                            placeholder='e.g. Food nutrition'
                                            className='focus:outline-0 w-full'
                                            value={expertiseInput}
                                            onChange={e => setExpertiseInput(e.target.value)}
                                            onFocus={() => setExpertiseInputFocused(true)}
                                            onBlur={() => setTimeout(() => setExpertiseInputFocused(false), 150)}
                                        />
                                    </div>
                                    {/* Dropdown for suggestions */}
                                    {expertiseInputFocused && expertiseInput.trim() && (
                                        <div className='absolute left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20'>
                                            {FIELD_LIST.filter(f => f.toLowerCase().includes(expertiseInput.toLowerCase()) && !selectedFields.includes(f)).slice(0, 4).map(f => (
                                                <div
                                                    key={f}
                                                    className='px-4 py-2 cursor-pointer hover:bg-gray-100 text-gray-800'
                                                    onMouseDown={() => {
                                                        setSelectedFields([...selectedFields, f]);
                                                        setExpertiseInput("");
                                                    }}
                                                >
                                                    {f}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className='flex flex-col gap-3 mt-4'>
                                {selectedFields.map(field => (
                                    <div key={field} className='flex items-center bg-gray-300 text-[#6A6A6A] pl-3 pr-6 py-2 rounded-lg w-max text-md font-normal gap-2'>
                                        <button
                                            className='text-2xl text-gray-500 hover:text-gray-700 focus:outline-none mr-2'
                                            onClick={() => setSelectedFields(selectedFields.filter(f => f !== field))}
                                        >
                                            ×
                                        </button>
                                        {field}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Subsection: Institution */}
                        <div className='mt-10'>
                            <div className='flex items-center justify-between'>
                                <h4 className='text-lg mb-5 font-semibold mt-6'>Institutions</h4>
                                <button
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
                                    {/* Dropdown for suggestions for institutions */}
                                    {institutionInputFocused && institutionInput.trim() && (
                                        <div className='absolute left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20'>
                                            {institutionLoading && (
                                                <div className='px-4 py-2 text-sm text-gray-500'>Searching…</div>
                                            )}
                                            {!institutionLoading && institutionSuggestions.length === 0 && (
                                                <div className='px-4 py-2 text-sm text-gray-500'>No institutions found</div>
                                            )}
                                            {!institutionLoading && institutionSuggestions.map(item => (
                                                <div
                                                    key={item.search_tag}
                                                    className='px-4 py-2 cursor-pointer hover:bg-gray-100 text-gray-800'
                                                    onMouseDown={() => addInstitutionSelection(item)} // pass whole item
                                                >
                                                    {item.display_name}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className='flex flex-col gap-3 mt-4'>
                                {selectedInstitutions.map(inst => (
                                    <div key={inst.search_tag} className='flex items-center bg-gray-300 text-[#6A6A6A] pl-3 pr-6 py-2 rounded-lg w-max text-md font-normal gap-2'>
                                        <button
                                            className='text-2xl text-gray-500 hover:text-gray-700 focus:outline-none mr-2'
                                            onClick={() => setSelectedInstitutions(prev => prev.filter(s => s.search_tag !== inst.search_tag))}
                                        >
                                            ×
                                        </button>
                                        {inst.display_name}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Subsection: Institution country */}
                        <div className='mt-12'>
                            <h4 className='text-lg mb-5 font-semibold'>Institution country</h4>
                            <div className='flex flex-col gap-2'>
                                <div>
                                    <input type='checkbox' id='insCountryIsVietNam' className='mr-4' />
                                    <label htmlFor='insCountryIsVietNam'>Vietnam</label>
                                </div>
                                <div>
                                    <input type='checkbox' id='insCountryIsUSA' className='mr-4' />
                                    <label htmlFor='insCountryIsUSA'>United States of America</label>
                                </div>
                                <div>
                                    <input type='checkbox' id='insCountryIsGermany' className='mr-4' />
                                    <label htmlFor='insCountryIsGermany'>Germany</label>
                                </div>
                                <div>
                                    <input type='checkbox' id='insCountryIsIndia' className='mr-4' />
                                    <label htmlFor='insCountryIsIndia'>India</label>
                                </div>
                                <div>
                                    <input type='checkbox' id='insCountryIsFrance' className='mr-4' />
                                    <label htmlFor='insCountryIsFrance'>France</label>
                                </div>
                                <button
                                    className='w-min self-end cursor-pointer text-gray-500'
                                    onClick={() => setShowCountryModal(true)}
                                >More...</button>
                            </div>
                        </div>

                        <hr className='mt-3 mb-10 border-[#e9e9e9]' />

                        {/* Clear and Apply all filters button */}
                        <div className='flex gap-1 mb-8'>
                            <input type='reset' value="Reset" className='w-full bg-white text-[#6A6A6A] py-2 rounded-lg cursor-pointer hover:bg-[#F3F4F6] border border-[#BDD7EF]' />
                            <button
                                type="button"
                                onClick={handleApply}
                                className='w-full bg-[#E60028] text-white py-2 rounded-lg cursor-pointer hover:bg-[#B4001F] border border-[#E60028]'
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
                </form>



                {/* Right side: conditional rendering */}
                <div className='w-3/5 h-full mx-auto'>
                    <div className='w-full h-screen flex flex-col justify-center'>
                        {(!hasSearched || (hasSearched && peopleList.length === 0)) ? (
                          <div className="flex flex-col items-center justify-center h-[400px]">
                            <img src={noResultImage} alt="No results" className="w-32 h-32 mb-4" />
                            <h3 className='font-semibold text-2xl mb-2'>No results to show</h3>
                            {!hasSearched ? (
                                <p className="text-md text-gray-500 text-center">
                                    Choose the filters on the left panel to begin.
                                </p>
                            ) : (
                                <p className="text-md text-gray-500 text-center mt-2">
                                    We couldn't find anyone matching your filter. <br/>
                                    Try changing your search criteria.
                                </p>
                            )}
                          </div>
                        ) : (
                          <>
                            {/* Max results per page */}
                            <div className='w-full flex justify-between items-center mb-10'>
                              <p>Showing <b>1-10</b> in <b>12,938</b></p>
                              <div className='flex items-center gap-2'>
                                <label htmlFor='resultsPerPage' className='text-sm text-[#6A6A6A]'>Max results per page:</label>
                                <select name="resultsPerPage" id="resultsPerPage" className='border border-gray-300 bg-white rounded-lg py-1 px-2'>
                                  <option value="10">10</option>
                                  <option value="20">20</option>
                                  <option value="50">50</option>
                                </select>
                              </div>
                            </div>

                            {/* People List */}
                            {peopleList.map((person, index) => (
                              <div className='w-full h-max mb-6 flex items-center justify-between border-1 border-[#D9D9D9] py-6 pl-6 pr-8 bg-white rounded-sm' key={index}>
                                <div className='w-full'>
                                  <div className='flex gap-6 justify-between w-full'>
                                    <div>
                                      <div className='flex gap-3 items-end mb-1'>
                                        <p className='font-bold text-xl'>{person.name}</p>
                                        <img src={Dot} alt='Dot' className='w-2 h-2 self-center' />
                                        <p className='text-[#6A6A6A] text-md'>{person.institution}</p>
                                      </div>

                                      <div className='flex-col justify-center'>
                                        <span className='text-sm text-[#6A6A6A]'>h-index: {person.hIndex}</span>
                                        <br />
                                        <span className='text-sm text-[#6A6A6A]'>i10-index: {person.i10Index}</span>
                                      </div>
                                    </div>
                                    <button className='h-fit text-[#3C72A5] text-md font-semibold py-2 px-6 bg-[#d2e4f4] rounded-lg cursor-pointer hover:underline'>View profile</button>
                                  </div>

                                  <div className='w-max py-1 px-8 rounded-full font-semibold bg-white border border-[#d2e4f4] text-[#3C72A5] text-sm mt-6'>{person.field}</div>
                                </div>
                              </div>
                            ))}
                            <Pagination>
                              <PaginationContent>
                                <PaginationItem>
                                  <PaginationPrevious href="#" />
                                </PaginationItem>
                                <PaginationItem>
                                  <PaginationLink href="#" isActive>1</PaginationLink>
                                </PaginationItem>
                                <PaginationItem>
                                  <PaginationLink href="#">
                                      2
                                  </PaginationLink>
                                </PaginationItem>
                                <PaginationItem>
                                  <PaginationLink href="#">3</PaginationLink>
                                </PaginationItem>
                                <PaginationItem>
                                  <PaginationEllipsis />
                                </PaginationItem>
                                <PaginationItem>
                                  <PaginationNext href="#" />
                                </PaginationItem>
                              </PaginationContent>
                            </Pagination>
                          </>
                        )}
                    </div>
                </div>

            </div>

            <CountryModal
                open={showCountryModal}
                onClose={() => setShowCountryModal(false)}
                countries={COUNTRY_LIST}
                selected={selectedCountries}
                onSelect={country => {
                    setSelectedCountries(sel => sel.includes(country) ? sel.filter(c => c !== country) : [...sel, country]);
                    setShowCountryModal(false);
                }}
                search={countrySearch}
                onSearch={setCountrySearch}
            />
            <FieldModal
                open={showFieldModal}
                onClose={() => setShowFieldModal(false)}
                fields={FIELD_LIST}
                selected={selectedFields}
                onSelect={field => {
                    // toggle selection (field is a string or synthetic topic key)
                    setSelectedFields(sel => sel.includes(field) ? sel.filter(f => f !== field) : [...sel, field]);
                    // keep modal open for multi-select; if you want to close after selecting uncomment next line:
                    // setShowFieldModal(false);
                }}
                search={fieldSearch}
                onSearch={setFieldSearch}
            />

            <InstitutionModal
                open={showInstitutionModal}
                onClose={() => setShowInstitutionModal(false)}
                selected={selectedInstitutions}
                onSelect={(item) => toggleInstitutionSelection(item)}
            />
            <Footer />
        </div>
    );
}
export default SearchInterface;
