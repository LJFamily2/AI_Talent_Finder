import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import * as Select from '@radix-ui/react-select';
import { ChevronDown, Check, ArrowRight, X } from 'lucide-react';
import '../App.css';
import InlineInstitutionsDropdown from '@/components/InlineInstitutionsDropdown';
import InlineNameDropdown from '@/components/InlineNameDropdown';
import InlineFieldDropdown from '@/components/InlineFieldDropdown';
import { searchInstitutions, loadAllFields, searchTopicsAutocomplete, searchResearcherNames, loadCountriesFilter, listInstitutions, getInstitutionsTotal, loadTopicsForField } from '@/services/searchFiltersService';

export default function SearchStart() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchField, setSearchField] = useState('expertise');
  const [iconBounce, setIconBounce] = useState(false);

  // Suggestion states (by category)
  const [instLoading, setInstLoading] = useState(false);
  const [instSuggestions, setInstSuggestions] = useState([]);
  const [nameLoading, setNameLoading] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [expertiseLoading, setExpertiseLoading] = useState(false);
  const [expertiseResults, setExpertiseResults] = useState([]); // [{ field, topics: [] }]
  const [countries, setCountries] = useState([]); // [{ search_tag, display_name }]
  const [allFields, setAllFields] = useState([]);
  // Full-list states
  const [showFullList, setShowFullList] = useState(false);
  // Institutions full list
  const [instFullItems, setInstFullItems] = useState([]);
  const [instFullLoading, setInstFullLoading] = useState(false);
  const [instFullOffset, setInstFullOffset] = useState(0);
  const [instFullTotal, setInstFullTotal] = useState(null);
  const instFullLimit = 50;
  // Expertise full list topics per field
  const [expandedFields, setExpandedFields] = useState({}); // fieldId -> boolean
  const [topicsByField, setTopicsByField] = useState({}); // fieldId -> array
  const [topicsLoadingByField, setTopicsLoadingByField] = useState({}); // fieldId -> boolean
  const [topicsOffsetByField, setTopicsOffsetByField] = useState({}); // fieldId -> number
  const [topicsTotalByField, setTopicsTotalByField] = useState({}); // fieldId -> number
  // Cache for chip topic lookups within session
  const topicChipCacheRef = useRef(new Map()); // key: normalized label -> topic or null

  const norm = (s) => String(s || '').trim().toLowerCase();
  // Restore chip cache from session on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('topicChipCache');
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === 'object') {
          const entries = Array.isArray(obj) ? obj : Object.entries(obj);
          topicChipCacheRef.current = new Map(entries);
        }
      }
    } catch {}
  }, []);

  function persistTopicChipCache() {
    try {
      const entries = Array.from(topicChipCacheRef.current.entries());
      sessionStorage.setItem('topicChipCache', JSON.stringify(entries));
    } catch {}
  }
  async function resolveTopicByLabel(label) {
    const key = norm(label);
    if (!key) return null;
    if (topicChipCacheRef.current.has(key)) return topicChipCacheRef.current.get(key);
    // 1) Atlas autocomplete
    try {
      let hits = await searchTopicsAutocomplete(label, 100);
      let t = (hits || []).find(h => norm(h.display_name) === key) || (hits && hits[0]);
      if (!t) {
        // 2) Per-field fallback
        let fieldsList = allFields;
        if (!fieldsList || !fieldsList.length) {
          try { fieldsList = await loadAllFields(); setAllFields(fieldsList || []); } catch { fieldsList = []; }
        }
        const perField = await Promise.all((fieldsList || []).map(async (f) => {
          try {
            const res = await loadTopicsForField(f._id ? f._id : 'null', 0, 200, label);
            const arr = res?.topics || [];
            return arr.map(x => ({ ...x, field_id: f._id, field_display_name: f.display_name }));
          } catch { return []; }
        }));
        const flat = perField.flat();
        t = flat.find(x => norm(x.display_name) === key) || flat[0];
      }
      topicChipCacheRef.current.set(key, t || null);
      persistTopicChipCache();
      return t || null;
    } catch {
      topicChipCacheRef.current.set(key, null);
      persistTopicChipCache();
      return null;
    }
  }

  // Reset highlight when full list opens
  useEffect(() => {
    if (showFullList) setHighlightIndex(0);
  }, [showFullList]);

  const suggestions = [
    'Academic Writing and Publishing',
    'Big Data and Business Intelligence',
    'Artificial Intelligence Applications',
    'Cinema and Media Studies',
    'Digital Marketing and Social Media',
    'Gender and Feminist Studies',
  ];

  const options = [
    { label: 'Institution', value: 'institution' },
    { label: 'Expertise', value: 'expertise' },
    { label: 'Institution Country', value: 'country' },
    { label: 'Name', value: 'name' },
  ];

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const suggestionRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        suggestionRef.current &&
        !suggestionRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
        setShowFullList(false);
        setHighlightIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close when category changes
  useEffect(() => {
    setShowSuggestions(false);
    setHighlightIndex(-1);
    setSearchTerm("");
    setShowFullList(false);
  }, [searchField]);

  // Load countries once (for country suggestions)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await loadCountriesFilter();
        if (mounted) setCountries(list || []);
      } catch (e) {
        setCountries([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load fields once for quick mapping
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await loadAllFields();
        if (mounted) setAllFields(list || []);
      } catch (e) {
        setAllFields([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const placeholders = {
    institution: 'Enter an institution',
    expertise: 'Enter a research expertise',
    country: 'Enter a country',
    name: 'Enter a name',
  };

  const getPlaceholder = () => placeholders[searchField] || 'Enter your search query';

  // Debounced suggestions fetch based on selected category
  useEffect(() => {
    const q = (searchTerm || '').trim();
    // Reset highlight on new query
    setHighlightIndex(-1);

    if (searchField === 'institution') {
      const t = setTimeout(async () => {
        if (!q) { setInstSuggestions([]); setInstLoading(false); return; }
        setInstLoading(true);
        try {
          const res = await searchInstitutions(q, 10);
          setInstSuggestions(res || []);
        } catch (e) {
          setInstSuggestions([]);
        } finally {
          setInstLoading(false);
        }
      }, 250);
      return () => clearTimeout(t);
    }

    if (searchField === 'name') {
      const t = setTimeout(async () => {
        if (!q) { setNameSuggestions([]); setNameLoading(false); return; }
        setNameLoading(true);
        try {
          const res = await searchResearcherNames(q, 10);
          setNameSuggestions(res || []);
        } catch (e) {
          setNameSuggestions([]);
        } finally {
          setNameLoading(false);
        }
      }, 250);
      return () => clearTimeout(t);
    }

    if (searchField === 'expertise') {
      let cancelled = false;
      const t = setTimeout(async () => {
        if (!q) { setExpertiseResults([]); setExpertiseLoading(false); return; }
        setExpertiseLoading(true);
        try {
          // Ensure fields list
          let fieldsList = [];
          try { fieldsList = await loadAllFields(); } catch { fieldsList = []; }
          // Atlas topics autocomplete
          let topicHits = await searchTopicsAutocomplete(q, 50);

          if (cancelled) return;

          const qlow = q.toLowerCase();
          const nameMatchSet = new Set(
            (fieldsList || [])
              .filter(f => (f.display_name || '').toLowerCase().includes(qlow))
              .map(f => String(f._id))
          );
          const idToField = new Map((fieldsList || []).map(f => [String(f._id), f]));
          // Fallback to per-field topic queries when no atlas hits
          if (!topicHits || topicHits.length === 0) {
            try {
              const perField = await Promise.all((fieldsList || []).map(async (f) => {
                try {
                  const res = await loadTopicsForField(f._id ? f._id : 'null', 0, 200, q);
                  const topics = res?.topics || [];
                  return topics.map(t => ({ ...t, field_id: f._id, field_display_name: f.display_name }));
                } catch {
                  return [];
                }
              }));
              topicHits = perField.flat();
            } catch {}
          }

          const byFieldId = new Map();
          (topicHits || []).forEach(t => {
            const fid = String(t.field_id ?? 'null');
            if (!byFieldId.has(fid)) byFieldId.set(fid, { fieldDisplayName: t.field_display_name || 'Uncategorized', topics: [] });
            byFieldId.get(fid).topics.push({ _id: t._id, display_name: t.display_name });
          });

          const results = [];
          for (const [fid, entry] of byFieldId.entries()) {
            const field = fid === 'null' ? { _id: null, display_name: 'Uncategorized' } : (idToField.get(fid) || { _id: fid, display_name: entry.fieldDisplayName || 'Unknown' });
            const nameMatch = nameMatchSet.has(fid);
            results.push({ field, topics: entry.topics, nameMatch });
          }
          (fieldsList || []).forEach(f => {
            const fid = String(f._id);
            if (nameMatchSet.has(fid) && !byFieldId.has(fid)) {
              results.push({ field: f, topics: [], nameMatch: true });
            }
          });
          const filtered = results.filter(r => r.nameMatch || (r.topics && r.topics.length));
          if (!cancelled) setExpertiseResults(filtered);
        } catch (e) {
          if (!cancelled) setExpertiseResults([]);
        } finally {
          if (!cancelled) setExpertiseLoading(false);
        }
      }, 300);
      return () => { cancelled = true; clearTimeout(t); };
    }
  }, [searchTerm, searchField]);

  const filteredCountries = useMemo(() => {
    const q = (searchTerm || '').trim().toLowerCase();
    if (!q) return [];
    return (countries || []).filter(c => (c.display_name || '').toLowerCase().includes(q)).slice(0, 10);
  }, [countries, searchTerm]);

  // Build bootstrap state and navigate
  const goWithBootstrap = (bootstrap, payload) => {
    try { sessionStorage.setItem('searchInterfaceBootstrap', JSON.stringify(bootstrap || {})); } catch {}
    if (payload && typeof payload === 'object') {
      try { sessionStorage.setItem('searchInterfaceBootstrapPayload', JSON.stringify(payload)); } catch {}
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate('/search/advanced');
    }, 300);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setShowSuggestions(false);
      setShowFullList(false);
      setHighlightIndex(-1);
      return;
    }

    // For simplicity: Enter selects first suggestion per category
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showFullList) {
        // Handle Enter for full-list selection per category
        if (searchField === 'institution' && instFullItems.length > 0 && highlightIndex >= 0) {
          const item = instFullItems[Math.min(highlightIndex, instFullItems.length - 1)];
          if (item) goWithBootstrap({ selectedInstitutions: [item], selectedCountries: [], selectedFields: [], selectedTopicIds: [], topicKeyToId: {}, nameInput: '' }, { search_tags: [item.search_tag], page: 1, limit: 10 });
          return;
        }
        if (searchField === 'country' && countries.length > 0 && highlightIndex >= 0) {
          const c = countries[Math.min(highlightIndex, countries.length - 1)];
          if (c) goWithBootstrap({ selectedInstitutions: [], selectedCountries: [c.search_tag], selectedFields: [], selectedTopicIds: [], topicKeyToId: {}, nameInput: '' }, { search_tags: [c.search_tag], page: 1, limit: 10 });
          return;
        }
        if (searchField === 'expertise' && allFields.length > 0 && highlightIndex >= 0) {
          const f = allFields[Math.min(highlightIndex, allFields.length - 1)];
          if (f) {
            const fid = f?._id ? String(f._id) : null;
            const payload = fid ? { search_tags: [`field:${fid}`], page: 1, limit: 10 } : undefined;
            goWithBootstrap({ selectedInstitutions: [], selectedCountries: [], selectedFields: [f.display_name], selectedTopicIds: [], topicKeyToId: {}, nameInput: '' }, payload);
          }
          return;
        }
      }
      if (searchField === 'institution') {
        if (instSuggestions.length > 0) {
          const item = instSuggestions[0];
          goWithBootstrap({ selectedInstitutions: [item], selectedCountries: [], selectedFields: [], selectedTopicIds: [], topicKeyToId: {}, nameInput: '' }, { search_tags: [item.search_tag], page: 1, limit: 10 });
        }
        return;
      }
      if (searchField === 'name') {
        const n = nameSuggestions.length > 0 ? (nameSuggestions[0]?.name || '') : (searchTerm || '').trim();
        if (n) goWithBootstrap({ selectedInstitutions: [], selectedCountries: [], selectedFields: [], selectedTopicIds: [], topicKeyToId: {}, nameInput: n }, { name: n, researcher_name: n, page: 1, limit: 10 });
        return;
      }
      if (searchField === 'expertise' && expertiseResults.length > 0) {
        const first = expertiseResults[0];
        if (first.topics && first.topics.length > 0) {
          const t = first.topics[0];
          const key = `${first.field.display_name} > ${t.display_name}`;
          goWithBootstrap({
            selectedInstitutions: [],
            selectedCountries: [],
            selectedFields: [key],
            selectedTopicIds: [String(t._id)],
            topicKeyToId: { [key]: String(t._id) },
            nameInput: ''
          }, { search_tags: [`topic:${String(t._id)}`], page: 1, limit: 10 });
        } else {
          const fid = first?.field?._id ? String(first.field._id) : null;
          const payload = fid ? { search_tags: [`field:${fid}`], page: 1, limit: 10 } : undefined;
          goWithBootstrap({ selectedInstitutions: [], selectedCountries: [], selectedFields: [first.field.display_name], selectedTopicIds: [], topicKeyToId: {}, nameInput: '' }, payload);
        }
        return;
      }
      if (searchField === 'country' && filteredCountries.length > 0) {
        const c = filteredCountries[0];
        goWithBootstrap({ selectedInstitutions: [], selectedCountries: [c.search_tag], selectedFields: [], selectedTopicIds: [], topicKeyToId: {}, nameInput: '' }, { search_tags: [c.search_tag], page: 1, limit: 10 });
        return;
      }
    }

    // Arrow navigation for full lists
    if (showFullList && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      let max = 0;
      if (searchField === 'institution') max = instFullItems.length;
      else if (searchField === 'country') max = countries.length;
      else if (searchField === 'expertise') max = allFields.length;
      if (max <= 0) return;
      setHighlightIndex(prev => {
        if (prev < 0) return 0;
        if (e.key === 'ArrowDown') return (prev + 1) % max;
        return (prev - 1 + max) % max;
      });
      return;
    }
  };

  return (
    <>
      <div className="w-full bg-[#000054] fixed top-0 left-0 z-10">
        <Header />
      </div>
      <div className="w-full flex justify-end px-4 pt-24">
        <button
          onClick={() => navigate('/search/advanced')}
          className="flex items-center gap-2 text-sm bg-transparent font-semibold transition group cursor-pointer"
          onMouseEnter={() => setIconBounce(true)}
          onMouseLeave={() => setIconBounce(false)}
          style={{ boxShadow: 'none' }}
        >
          <span className="group-hover:underline group-hover:text-blue-400 text-blue-600 transition">
            Advanced Search
          </span>
          <span
            className={`rounded-full bg-blue-100 p-2 transition ${iconBounce ? 'bounce-right' : ''} cursor-pointer`}
          >
            <ArrowRight className="w-5 h-5 text-blue-600" />
          </span>
        </button>
      </div>
      <div className="min-h-screen flex flex-col items-center justify-center px-4 -mt-25">
        <p
          className="text-gray-800 text-4xl font-medium text-center mb-10 w-full xl:whitespace-nowrap lg:whitespace-normal"
          style={{ fontFamily: "'Nata Sans', sans-serif" }}
        >
          Search for academic talents by a criteria of your choice
        </p>
        <div className="flex flex-row w-full">
          <div className='basis-3/7'></div>

          {/* Search input and select */}
          <div className="flex w-full max-w-4xl mx-auto rounded-xl">
            {/* Dropdown */}
            <Select.Root value={searchField} onValueChange={setSearchField}>
              <Select.Trigger
                className="inline-flex items-center justify-between px-3 py-2 text-gray-800 text-base bg-blue-100 border border-blue-200 border-r-0 rounded-l-xl shadow-lg focus:outline-none hover:bg-blue-100 transition-colors min-w-[140px]"
                aria-label="Search field"
              >
                <Select.Value />
                <Select.Icon className="ml-1">
                  <ChevronDown className="w-4 h-4 text-blue-500 group-hover:text-blue-700 transition-colors" />
                </Select.Icon>
              </Select.Trigger>

              <Select.Portal>
                <Select.Content
                  side="bottom"
                  align="end"
                  sideOffset={4}
                  position="popper"
                  className="z-50"
                >
                  <Select.Viewport className="bg-white rounded-md shadow-xl p-1 min-w-[100%]">
                    <Select.Group>
                      <Select.Label className="px-3 py-2 text-sm text-gray-500">
                        What are you looking for?
                      </Select.Label>
                      <Select.Separator className="h-px bg-gray-200 my-1" />
                      {options.map((option) => (
                        <Select.Item
                          key={option.value}
                          value={option.value}
                          className="flex items-center px-3 py-2 text-base text-gray-800 rounded-md hover:bg-blue-50 focus:outline-none focus:bg-blue-100"
                        >
                          <Select.ItemText>{option.label}</Select.ItemText>
                          <Select.ItemIndicator className="ml-auto">
                            <Check className="w-4 h-4 text-blue-600" />
                          </Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Group>
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>

            {/* Search input */}
            <div className="relative flex-grow" ref={suggestionRef}>
              <input
                type="text"
                placeholder={getPlaceholder()}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSuggestions(!!e.target.value.trim());
                  if (e.target.value.trim()) setShowFullList(false);
                }}
                onKeyDown={handleKeyDown}
                className="w-full p-4 py-4 text-base text-black bg-white border border-blue-200 rounded-r-xl shadow-lg focus:outline-none"
              />

              {/* Dropdown chevron */}
              <button
                type="button"
                onClick={() => {
                  // Toggle full list view regardless of current input
                  setShowFullList(prev => {
                    const next = !prev;
                    if (next) {
                      // Ensure container visible
                      setShowSuggestions(true);
                      // Kick off initial loads per category
                      if (searchField === 'institution') {
                        setInstFullItems([]);
                        setInstFullOffset(0);
                        setInstFullTotal(null);
                        (async () => {
                          try {
                            setInstFullLoading(true);
                            const [total, first] = await Promise.all([
                              getInstitutionsTotal().catch(() => null),
                              listInstitutions(0, instFullLimit).catch(() => [])
                            ]);
                            setInstFullTotal(total);
                            setInstFullItems(first || []);
                            setInstFullOffset((first || []).length);
                          } finally {
                            setInstFullLoading(false);
                          }
                        })();
                      } else if (searchField === 'expertise') {
                        if (!allFields || allFields.length === 0) {
                          (async () => {
                            try {
                              const list = await loadAllFields();
                              setAllFields(list || []);
                            } catch {}
                          })();
                        }
                      }
                    } else {
                      // Closing: also hide suggestions to avoid empty dropdown UI
                      setShowSuggestions(false);
                    }
                    return next;
                  });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showFullList ? (
                  <X className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {/* Suggestions dropdown - mirrors Search Interface behavior */}
              {showSuggestions && (
                <div>
                  {showFullList ? (
                    <>
                      {searchField === 'institution' && (
                        <div
                          className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-72 overflow-y-auto z-50"
                          onScroll={(e) => {
                            const el = e.currentTarget;
                            const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
                            const hasMore = instFullTotal == null || instFullOffset < instFullTotal;
                            if (nearBottom && !instFullLoading && hasMore) {
                              (async () => {
                                try {
                                  setInstFullLoading(true);
                                  const next = await listInstitutions(instFullOffset, instFullLimit);
                                  setInstFullItems(prev => [...prev, ...(next || [])]);
                                  setInstFullOffset(prev => prev + (next?.length || 0));
                                } finally {
                                  setInstFullLoading(false);
                                }
                              })();
                            }
                          }}
                        >
                          {/* (header removed as requested) */}
                          {(instFullItems || []).map((item, idx) => (
                            <div
                              key={item.search_tag}
                              className={`px-4 py-2 text-base text-gray-800 cursor-pointer ${idx === highlightIndex ? 'bg-blue-100' : 'hover:bg-blue-50'}`}
                              onMouseDown={() => {
                                goWithBootstrap({ selectedInstitutions: [item], selectedCountries: [], selectedFields: [], selectedTopicIds: [], topicKeyToId: {}, nameInput: '' }, { search_tags: [item.search_tag], page: 1, limit: 10 });
                              }}
                            >
                              {item.display_name}
                            </div>
                          ))}
                          <div className="px-4 py-2 text-sm text-gray-500">{instFullLoading ? 'Loading…' : ((instFullTotal != null && instFullOffset >= instFullTotal) ? 'End of list' : '')}</div>
                        </div>
                      )}
                      {searchField === 'expertise' && (
                        <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-80 overflow-y-auto z-50">
                          {/* (header removed as requested) */}
                          {(allFields || []).map((f, fIdx) => (
                            <div key={String(f._id)} className="py-2">
                              <div
                                className={`px-4 py-2 text-gray-800 font-medium cursor-pointer flex items-center justify-between ${fIdx === highlightIndex ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                                onMouseDown={() => {
                                  const fid = f?._id ? String(f._id) : null;
                                  const payload = fid ? { search_tags: [`field:${fid}`], page: 1, limit: 10 } : undefined;
                                  goWithBootstrap({ selectedInstitutions: [], selectedCountries: [], selectedFields: [f.display_name], selectedTopicIds: [], topicKeyToId: {}, nameInput: '' }, payload);
                                }}
                              >
                                <span>{f.display_name}</span>
                                <button
                                  type="button"
                                  className="text-xs text-blue-600 ml-4"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    const fid = f?._id ? String(f._id) : 'null';
                                    setExpandedFields(prev => ({ ...prev, [fid]: !prev[fid] }));
                                    const alreadyLoaded = (topicsByField[fid] || []).length > 0;
                                    if (!alreadyLoaded) {
                                      (async () => {
                                        try {
                                          setTopicsLoadingByField(m => ({ ...m, [fid]: true }));
                                          const res = await loadTopicsForField(fid === 'null' ? 'null' : fid, 0, 50, '');
                                          const arr = res?.topics || [];
                                          setTopicsByField(map => ({ ...map, [fid]: arr }));
                                          setTopicsOffsetByField(map => ({ ...map, [fid]: arr.length }));
                                          setTopicsTotalByField(map => ({ ...map, [fid]: Number(res?.total || arr.length) }));
                                        } finally {
                                          setTopicsLoadingByField(m => ({ ...m, [fid]: false }));
                                        }
                                      })();
                                    }
                                  }}
                                >
                                  View topics
                                </button>
                              </div>
                              {expandedFields[String(f._id) || 'null'] && (
                                <div className="pl-8 pr-4 py-1">
                                  {(topicsByField[String(f._id) || 'null'] || []).map(t => (
                                    <div
                                      key={String(t._id)}
                                      className="py-1 text-gray-800 cursor-pointer hover:bg-gray-100"
                                      onMouseDown={() => {
                                        const key = `${f.display_name} > ${t.display_name}`;
                                        goWithBootstrap({ selectedInstitutions: [], selectedCountries: [], selectedFields: [key], selectedTopicIds: [String(t._id)], topicKeyToId: { [key]: String(t._id) }, nameInput: '' }, { search_tags: [`topic:${String(t._id)}`], page: 1, limit: 10 });
                                      }}
                                    >
                                      <span className="text-sm">{t.display_name}</span>
                                    </div>
                                  ))}
                                  <div className="py-1">
                                    {topicsLoadingByField[String(f._id) || 'null'] ? (
                                      <div className="text-xs text-gray-500">Loading…</div>
                                    ) : (
                                      ((topicsTotalByField[String(f._id) || 'null'] || 0) > (topicsOffsetByField[String(f._id) || 'null'] || 0)) && (
                                        <button
                                          type="button"
                                          className="text-xs text-blue-600 hover:underline"
                                          onMouseDown={async (e) => {
                                            e.stopPropagation();
                                            const fid = String(f._id) || 'null';
                                            try {
                                              setTopicsLoadingByField(m => ({ ...m, [fid]: true }));
                                              const offset = topicsOffsetByField[fid] || 0;
                                              const res = await loadTopicsForField(fid === 'null' ? 'null' : fid, offset, 50, '');
                                              const arr = res?.topics || [];
                                              setTopicsByField(map => ({ ...map, [fid]: [...(map[fid] || []), ...arr] }));
                                              setTopicsOffsetByField(map => ({ ...map, [fid]: (map[fid] || []).length }));
                                              setTopicsTotalByField(map => ({ ...map, [fid]: Number(res?.total || (map[fid] || []).length) }));
                                            } finally {
                                              setTopicsLoadingByField(m => ({ ...m, [fid]: false }));
                                            }
                                          }}
                                        >
                                          Load more topics
                                        </button>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {searchField === 'country' && (
                        <ul className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-72 overflow-y-auto z-50">
                          {/* (header removed as requested) */}
                          {(countries || []).map((c, idx) => (
                            <li
                              key={c.search_tag}
                              className={`px-4 py-2 text-base text-gray-800 cursor-pointer ${idx === highlightIndex ? 'bg-blue-100' : 'hover:bg-blue-50'}`}
                              onMouseDown={() => {
                                goWithBootstrap({ selectedInstitutions: [], selectedCountries: [c.search_tag], selectedFields: [], selectedTopicIds: [], topicKeyToId: {}, nameInput: '' }, { search_tags: [c.search_tag], page: 1, limit: 10 });
                              }}
                            >
                              {c.display_name}
                            </li>
                          ))}
                        </ul>
                      )}
                      {searchField === 'name' && (
                        <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                          <div className="px-4 py-3 text-sm text-gray-600">Type a name to see suggestions</div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                  {searchField === 'institution' && (
                    <InlineInstitutionsDropdown
                      show={true}
                      loading={instLoading}
                      suggestions={instSuggestions}
                      selected={[]}
                      onSelect={(item) => {
                        goWithBootstrap({ selectedInstitutions: [item], selectedCountries: [], selectedFields: [], selectedTopicIds: [], topicKeyToId: {}, nameInput: '' }, { search_tags: [item.search_tag], page: 1, limit: 10 });
                      }}
                    />
                  )}
                  {searchField === 'name' && (
                    <InlineNameDropdown
                      show={true}
                      loading={nameLoading}
                      suggestions={nameSuggestions}
                      onSelect={(s) => {
                        const n = s?.name || '';
                        goWithBootstrap({ selectedInstitutions: [], selectedCountries: [], selectedFields: [], selectedTopicIds: [], topicKeyToId: {}, nameInput: n }, { name: n, researcher_name: n, page: 1, limit: 10 });
                      }}
                    />
                  )}
                  {searchField === 'expertise' && (
                    <InlineFieldDropdown
                      show={true}
                      loading={expertiseLoading}
                      results={expertiseResults}
                      selectedFields={[]}
                      onSelectField={(name) => {
                        const matched = (expertiseResults || []).find(r => r?.field?.display_name === name);
                        const fid = matched?.field?._id ? String(matched.field._id) : null;
                        const payload = fid ? { search_tags: [`field:${fid}`], page: 1, limit: 10 } : undefined;
                        goWithBootstrap({ selectedInstitutions: [], selectedCountries: [], selectedFields: [name], selectedTopicIds: [], topicKeyToId: {}, nameInput: '' }, payload);
                      }}
                      onSelectTopic={({ key, id }) => {
                        if (!key || !id) return;
                        goWithBootstrap({ selectedInstitutions: [], selectedCountries: [], selectedFields: [key], selectedTopicIds: [String(id)], topicKeyToId: { [key]: String(id) }, nameInput: '' }, { search_tags: [`topic:${String(id)}`], page: 1, limit: 10 });
                      }}
                    />
                  )}
                  {searchField === 'country' && (
                    <ul className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto z-50">
                      {(filteredCountries || []).length > 0 ? (
                        filteredCountries.map((c, idx) => (
                          <li
                            key={c.search_tag}
                            className={`px-4 py-2 text-base text-gray-800 cursor-pointer ${idx === highlightIndex ? 'bg-blue-100' : 'hover:bg-blue-50'}`}
                            onMouseDown={() => {
                              goWithBootstrap({ selectedInstitutions: [], selectedCountries: [c.search_tag], selectedFields: [], selectedTopicIds: [], topicKeyToId: {}, nameInput: '' }, { search_tags: [c.search_tag], page: 1, limit: 10 });
                            }}
                            onMouseEnter={() => setHighlightIndex(idx)}
                          >
                            {c.display_name}
                          </li>
                        ))
                      ) : (
                        <li className="px-4 py-2 text-sm text-gray-500 italic">No matches</li>
                      )}
                    </ul>
                  )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className='basis-3/7'></div>
        </div>

        {/* Quick suggestions */}
        <div className="max-w-5xl w-full mt-40 -mb-40">
          <div className="text-center">
            <p className="text-gray-600 text-base mb-4">
              First time here? Select an expertise domain below to start.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              {suggestions.map((field) => (
                <button
                  key={field}
                  onClick={async () => {
                    const label = String(field || '').trim();
                    const t = await resolveTopicByLabel(label);
                    if (t && t._id) {
                      const key = `${t.field_display_name || 'Uncategorized'} > ${t.display_name}`;
                      goWithBootstrap(
                        { selectedInstitutions: [], selectedCountries: [], selectedFields: [key], selectedTopicIds: [String(t._id)], topicKeyToId: { [key]: String(t._id) }, nameInput: '' },
                        { search_tags: [`topic:${String(t._id)}`], page: 1, limit: 10 }
                      );
                      return;
                    }
                    // Fallback to suggestions
                    setSearchField('expertise');
                    setSearchTerm(label);
                    setShowFullList(false);
                    setShowSuggestions(true);
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-base rounded-full transition cursor-pointer"
                >
                  {field}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="bg-white px-10 py-8 rounded-lg shadow-lg flex flex-col items-center">
            <svg
              className="animate-spin h-8 w-8 text-blue-600 mb-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              ></path>
            </svg>
            <span className="text-lg text-gray-700">Loading, please wait...</span>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}
