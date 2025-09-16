import React from 'react';

export default function InlineFieldDropdown({ show, loading, results = [], selectedFields = [], onSelectField, onSelectTopic }) {
  if (!show) return null;
  return (
    <div className='absolute left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto'>
      {loading && (
        <div className='px-4 py-2 text-sm text-gray-500'>Searching…</div>
      )}
      {!loading && results.length === 0 && (
        <div className='px-4 py-2 text-sm text-gray-500'>No matches</div>
      )}
      {!loading && results.map(({ field: f, topics = [] }) => {
        const fieldSelected = selectedFields.includes(f.display_name);
        return (
          <div key={f._id || f.display_name} className='py-2'>
            <div
              className={`px-4 py-2 text-gray-800 font-medium ${fieldSelected ? 'bg-gray-50 text-gray-500 cursor-default' : 'cursor-pointer hover:bg-gray-100'}`}
              onMouseDown={() => { if (!fieldSelected) onSelectField?.(f.display_name); }}
            >
              {f.display_name}
              {fieldSelected && <span className='ml-2 text-xs text-gray-400'>(selected)</span>}
            </div>
            {(topics || []).map((t, ti) => {
              const topicKey = `${f.display_name} > ${t.display_name}`;
              const topicChecked = selectedFields.includes(topicKey);
              const disabled = fieldSelected;
              const clickable = !disabled && !topicChecked;
              return (
                <div
                  key={`${String(t._id || ti)}_${ti}`}
                  className={`pl-10 pr-4 py-1 text-gray-800 ${clickable ? 'cursor-pointer hover:bg-gray-100' : 'cursor-default'} ${disabled || topicChecked ? 'opacity-50' : ''}`}
                  onMouseDown={() => { if (clickable) onSelectTopic?.({ key: topicKey, id: t._id }); }}
                >
                  <span className='text-sm'>
                    {t.display_name}
                    {topicChecked && <span className='ml-2 text-[10px] text-gray-400'>(selected)</span>}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
