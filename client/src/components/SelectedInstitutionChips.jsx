import React from 'react';

export default function SelectedInstitutionChips({ items = [], onRemove }) {
  return (
    <div className='flex flex-wrap gap-3 mt-4'>
      {items.map(inst => (
        <div key={inst.search_tag} className='flex items-center bg-gray-300 text-[#6A6A6A] pl-3 pr-6 py-2 rounded-lg max-w-full text-md font-normal gap-2'>
          <button
            type="button"
            className='text-2xl text-gray-500 hover:text-gray-700 focus:outline-none mr-2'
            onClick={() => onRemove?.(inst)}
          >
            ×
          </button>
          <span className='min-w-0 break-words whitespace-normal' title={inst.display_name}>{inst.display_name}</span>
        </div>
      ))}
    </div>
  );
}

