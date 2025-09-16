import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { listInstitutions, searchInstitutions, getInstitutionsTotal } from '../services/searchFiltersService';

const InstitutionModal = React.memo(function InstitutionModal({ open, onClose, selected, onSelect }) {
  const modalRef = useRef(null);
  const listRef = useRef(null);
  const scrollPosRef = useRef(0);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef(null);
  const PAGE_SIZE = 50;
  const lastQueryRef = useRef("");
  const [totalCount, setTotalCount] = useState(null);

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
    setItems([]);
    setOffset(0);
    setHasMore(true);
    setQuery("");
    lastQueryRef.current = "";
    scrollPosRef.current = 0;

    (async () => {
      setLoading(true);
      try {
        try {
          const total = await getInstitutionsTotal();
          setTotalCount(Number(total) || 0);
        } catch (e) {
          console.error("getInstitutionsTotal error:", e);
          setTotalCount(null);
        }
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

  useEffect(() => {
    const q = (query || "").trim();
    lastQueryRef.current = q;
    const timer = setTimeout(async () => {
      if (!open) return;
      if (!q) {
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
    if (query && query.trim()) return;
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

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = scrollPosRef.current || 0;
  }, [selected, items, loading]);

  const handleListScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    scrollPosRef.current = el.scrollTop;
  }, []);

  const filtered = items;

  return open ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
      <div ref={modalRef} className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] p-6 pr-10 pt-8 relative flex flex-col">
        <button type="button" className="absolute top-1 right-4 text-2xl text-gray-400 hover:text-gray-600" onClick={onClose} aria-label="Close">&times;</button>
        <input type="text" placeholder="Search institutions..." className="w-full border border-gray-200 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring" value={query} onChange={e => setQuery(e.target.value)} />
        <div className="text-gray-500 text-sm mb-2">All institutions ({totalCount !== null ? totalCount : '…'})</div>
        <div className="border-b mb-2"></div>
        <div ref={listRef} onScroll={handleListScroll} className="overflow-y-auto flex-1 pr-2" style={{ maxHeight: '50vh' }}>
          {filtered.map((item) => {
            const checked = selected.some(s => s.search_tag === item.search_tag);
            return (
              <label key={item.search_tag} className="flex items-start gap-3 py-2 px-2 rounded-lg cursor-pointer hover:bg-gray-100">
                <input type="checkbox" checked={checked} onChange={() => onSelect(item)} className="w-5 h-5 mt-0.5 shrink-0 accent-[#E60028]" />
                <span className="leading-snug">{item.display_name}</span>
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
});

export default InstitutionModal;

