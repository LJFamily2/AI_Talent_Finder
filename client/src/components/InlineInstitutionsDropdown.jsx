import React from 'react';

export default function InlineInstitutionsDropdown({ show, loading, suggestions = [], selected = [], onSelect }) {
  if (!show) return null;
  return (
    <div className='absolute left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto'>
      {loading && (
        <div className='px-4 py-2 text-sm text-gray-500'>Searching…</div>
      )}
      {!loading && suggestions.length === 0 && (
        <div className='px-4 py-2 text-sm text-gray-500'>No institutions found</div>
      )}
      {!loading && suggestions.map(item => {
        const isSelected = selected.some(s => s.search_tag === item.search_tag);
        return (
          <div
            key={item.search_tag}
            className={`px-4 py-2 text-gray-800 ${isSelected ? 'bg-gray-50 text-gray-500 cursor-default' : 'cursor-pointer hover:bg-gray-100'}`}
            onMouseDown={() => { if (!isSelected) onSelect?.(item); }}
          >
            {item.display_name}
            {isSelected && <span className='ml-2 text-xs text-gray-400'>(selected)</span>}
          </div>
        );
      })}
    </div>
  );
}

