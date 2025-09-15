import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { CircularProgress } from '@mui/material';
import { loadAllFields, loadTopicsForField, searchTopicsAutocomplete } from '../services/searchFiltersService';

const FieldModal = React.memo(function FieldModal({ open, onClose, selected, onSelect, onSelectTopic, search, onSearch }) {
  const modalRef = useRef(null);
  const fieldListRef = useRef(null);
  const fieldScrollPosRef = useRef(0);
  const [fields, setFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [topicsMap, setTopicsMap] = useState({});
  const [loadingTopics, setLoadingTopics] = useState({});
  const [expandedSet, setExpandedSet] = useState(new Set());
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTopicsByField, setSearchTopicsByField] = useState({});
  const [searchFieldKeys, setSearchFieldKeys] = useState([]);
  const lastSearchRef = useRef("");

  useEffect(() => {
    function handleClickOutside(event) {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    setFields([]);
    setTopicsMap({});
    setExpandedSet(new Set());
    setSearchTopicsByField({});
    setSearchFieldKeys([]);
    setSearchLoading(false);
    setLoadingFields(true);
    fieldScrollPosRef.current = 0;
    loadAllFields()
      .then(list => setFields(list))
      .catch(err => console.error("loadAllFields error:", err))
      .finally(() => setLoadingFields(false));
  }, [open]);

  const toggleField = useCallback((fieldName) => {
    onSelect(fieldName);
  }, [onSelect]);

  const toggleTopic = useCallback((fieldName, topic) => {
    const key = `${fieldName} > ${topic.display_name}`;
    // notify parent about UI selection
    onSelect(key);
    // also provide topic id for payload construction
    onSelectTopic?.({ key, id: topic._id });
  }, [onSelect, onSelectTopic]);

  const toggleExpand = useCallback((field) => {
    const fieldIdKey = field._id ? String(field._id) : `null`;
    setExpandedSet(prev => {
      const next = new Set(prev);
      if (next.has(fieldIdKey)) next.delete(fieldIdKey);
      else next.add(fieldIdKey);
      return next;
    });

    if (!topicsMap[fieldIdKey]) {
      setLoadingTopics(prev => ({ ...prev, [fieldIdKey]: true }));
      const fetchId = field._id ? field._id : "null";
      loadTopicsForField(fetchId, 0, 5000, "")
        .then(res => {
          setTopicsMap(prev => ({ ...prev, [fieldIdKey]: { topics: res.topics || [], total: res.total || 0 } }));
        })
        .catch(err => {
          console.error("loadTopicsForField error:", err);
          setTopicsMap(prev => ({ ...prev, [fieldIdKey]: { topics: [], total: 0 } }));
        })
        .finally(() => setLoadingTopics(prev => ({ ...prev, [fieldIdKey]: false })));
    }
  }, [topicsMap]);

  useEffect(() => {
    if (!open) return;
    const q = (search || "").trim();
    lastSearchRef.current = q;
    if (!q) {
      setSearchLoading(false);
      setSearchTopicsByField({});
      setSearchFieldKeys([]);
      setExpandedSet(new Set());
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const qlow = q.toLowerCase();
        // compute field name matches
        const nameMatchSet = new Set((fields || [])
          .filter(f => (f.display_name || "").toLowerCase().includes(qlow))
          .map(f => (f._id ? String(f._id) : 'null')));

        // query topics once via autocomplete
        const hits = await searchTopicsAutocomplete(q, 1000);
        if (lastSearchRef.current !== q) return;

        const byField = {};
        (hits || []).forEach(t => {
          const fieldKey = t.field_id ? String(t.field_id) : 'null';
          if (!byField[fieldKey]) byField[fieldKey] = [];
          byField[fieldKey].push({ _id: t._id, display_name: t.display_name });
        });

        const matchKeys = new Set([...Object.keys(byField), ...nameMatchSet]);
        setSearchTopicsByField(byField);
        setSearchFieldKeys(Array.from(matchKeys));
      } catch (e) {
        // leave empty on error
        setSearchTopicsByField({});
        setSearchFieldKeys([]);
      } finally {
        if (lastSearchRef.current === q) setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, open, fields]);

  useLayoutEffect(() => {
    const el = fieldListRef.current;
    if (!el) return;
    el.scrollTop = fieldScrollPosRef.current || 0;
  }, [selected, expandedSet]);

  const handleFieldListScroll = useCallback(() => {
    const el = fieldListRef.current;
    if (!el) return;
    fieldScrollPosRef.current = el.scrollTop;
  }, []);

  return open ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
      <div ref={modalRef} className="bg-white rounded-xl shadow-xl w-full max-w-lg max-height-[80vh] max-h-[80vh] p-6 pr-10 pt-8 relative flex flex-col">
        <button type="button" className="absolute top-1 right-4 text-2xl text-gray-400 hover:text-gray-600" onClick={onClose} aria-label="Close">&times;</button>
        <input type="text" placeholder="Search fields or topics" className="w-full border border-gray-200 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring" value={search} onChange={e => onSearch(e.target.value)} />
        <div className="text-gray-500 text-sm mb-2">Fields ({fields.length})</div>
        <div className="border-b mb-2"></div>
        <div ref={fieldListRef} onScroll={handleFieldListScroll} className="overflow-y-auto flex-1 pr-2" style={{ maxHeight: '50vh' }}>
          {(loadingFields || searchLoading) && <div className="text-center py-4 text-gray-500">{loadingFields ? 'Loading fields…' : 'Searching…'}</div>}
          {!loadingFields && (!((search || "").trim()) ? fields : fields.filter(f => searchFieldKeys.includes(f._id ? String(f._id) : 'null'))).map((f) => {
            const fieldIdKey = f._id ? String(f._id) : `null`;
            const fieldSelected = selected.includes(f.display_name);
            const isSearchActive = (search || "").trim().length > 0;
            const isExpanded = isSearchActive ? ((searchTopicsByField[fieldIdKey] || []).length > 0) : expandedSet.has(fieldIdKey);
            const topicEntry = topicsMap[fieldIdKey];
            const matchingCount = isSearchActive ? ((searchTopicsByField[fieldIdKey] || []).length) : 0;
            return (
              <div key={fieldIdKey} className="py-2 px-2 border-b last:border-b-0">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={fieldSelected} onChange={() => toggleField(f.display_name)} className="w-5 h-5 accent-[#E60028]" />
                    <span className="font-medium">{f.display_name}</span>
                    {!isSearchActive && (
                      <span className="text-sm text-gray-400 ml-2">({
                        f.topics_count !== undefined && f.topics_count !== null
                          ? f.topics_count
                          : (topicEntry ? topicEntry.total : '...')
                      })</span>
                    )}
                    {isSearchActive && matchingCount > 0 && (
                      <span className="text-sm text-gray-400 ml-2">({matchingCount})</span>
                    )}
                  </label>
                  <button className="text-sm text-gray-600 hover:text-gray-800 px-2 py-1" onClick={() => toggleExpand(f)} aria-expanded={isExpanded} aria-controls={`topics_${fieldIdKey}`}>
                    <span style={{ display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}>▸</span>
                  </button>
                </div>

                <div id={`topics_${fieldIdKey}`} className={`ml-8 mt-2 flex flex-col gap-1 transition-all ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                  {isExpanded ? (
                    (() => {
                      const list = (isSearchActive ? (searchTopicsByField[fieldIdKey] || []) : (topicEntry?.topics || []));
                      if (isSearchActive && searchLoading && !(searchTopicsByField[fieldIdKey])) {
                        return (
                          <div className="py-2 flex justify-center"><CircularProgress size={24} /></div>
                        );
                      }
                      // Non-search path: show loading while first fetch is in progress
                      if (!isSearchActive && loadingTopics[fieldIdKey] && !topicEntry) {
                        return (
                          <div className="py-2 flex justify-center"><CircularProgress size={24} /></div>
                        );
                      }
                      return list && list.length ? list.map((t, ti) => {
                        const topicKey = `${f.display_name} > ${t.display_name}`;
                        const topicChecked = selected.includes(topicKey);
                        return (
                          <label key={`${String(t._id ?? ti)}_${ti}`} className={`flex items-center gap-3 text-sm ${fieldSelected ? 'opacity-50' : ''}`}>
                            <input type="checkbox" checked={topicChecked} disabled={fieldSelected} onChange={() => toggleTopic(f.display_name, t)} className="w-4 h-4 accent-[#E60028]" />
                            <span>{t.display_name}</span>
                          </label>
                        );
                      }) : (isSearchActive ? null : <div className="text-sm text-gray-400">No topics</div>);
                    })()
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
});

export default FieldModal;
