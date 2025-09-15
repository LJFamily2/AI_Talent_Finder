import React from "react";

export default function InlineNameDropdown({ show, loading, suggestions = [], onSelect }) {
  if (!show) return null;
  return (
    <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
      {loading && (
        <div className="px-4 py-2 text-sm text-gray-500">Searching…</div>
      )}
      {!loading && suggestions.length === 0 && (
        <div className="px-4 py-2 text-sm text-gray-500">No matches</div>
      )}
      {!loading && suggestions.map((s) => (
        <div
          key={s.id}
          className="px-4 py-2 text-gray-800 cursor-pointer hover:bg-gray-100"
          onMouseDown={() => onSelect?.(s)}
        >
          {s.name}
        </div>
      ))}
    </div>
  );
}

