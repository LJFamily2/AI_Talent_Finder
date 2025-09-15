import React, { useState, useRef, useEffect, useMemo, useLayoutEffect, useCallback } from 'react';
import { loadCountriesFilter } from '../services/searchFiltersService';

const CountryModal = React.memo(function CountryModal({ open, onClose, selected, onSelect }) {
  const modalRef = useRef(null);
  const listRef = useRef(null);
  const scrollPosRef = useRef(0);
  const [countries, setCountries] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    setCountries([]);
    (async () => {
      try {
        const list = await loadCountriesFilter();
        const normalized = (list || []).map(item => {
          if (!item) return null;
          if (typeof item === 'string') return { search_tag: item, display_name: item };
          return {
            search_tag: item.search_tag || item._id || item.code || item.id || item.value || "",
            display_name: item.display_name || item.name || item.label || item.display || ""
          };
        }).filter(Boolean);
        setCountries(normalized);
      } catch (err) {
        console.error("loadCountriesFilter error:", err);
        setCountries([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const filtered = useMemo(() => {
    return (countries || []).filter(c => (c.display_name || "").toLowerCase().includes((q || "").toLowerCase()));
  }, [countries, q]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = scrollPosRef.current || 0;
  }, [selected, q]);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    scrollPosRef.current = el.scrollTop;
  }, []);

  const CountryItem = React.memo(({ country, isChecked, onToggle }) => {
    return (
      <label className="flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer hover:bg-gray-100">
        <input type="checkbox" checked={isChecked} onChange={onToggle} className="w-5 h-5 accent-[#E60028]" />
        <span>{country.display_name}</span>
      </label>
    );
  });

  return open ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
      <div ref={modalRef} className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] p-6 pr-10 pt-8 relative flex flex-col">
        <button type="button" className="absolute top-1 right-4 text-2xl text-gray-400 hover:text-gray-600" onClick={onClose} aria-label="Close">&times;</button>
        <input type="text" placeholder="Search institution countries" className="w-full border border-gray-200 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring" value={q} onChange={e => setQ(e.target.value)} />
        <div className="text-gray-500 text-sm mb-2">All countries ({countries.length})</div>
        <div className="border-b mb-2"></div>
        <div ref={listRef} onScroll={handleScroll} className="overflow-y-auto flex-1 pr-2" style={{ maxHeight: '50vh' }}>
          {loading && <div className="text-center py-4 text-gray-500">Loading countries…</div>}
          {!loading && filtered.map((country) => (
            <CountryItem key={country.search_tag} country={country} isChecked={selected.includes(country.search_tag)} onToggle={() => onSelect(country)} />
          ))}
          {!loading && filtered.length === 0 && <div className="text-gray-400 text-center py-8">No countries found</div>}
        </div>
      </div>
    </div>
  ) : null;
});

export default CountryModal;

