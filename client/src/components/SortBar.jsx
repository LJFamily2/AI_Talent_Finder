import React from 'react';

export default function SortBar({ sortBy = 'match', sortOrder = 'desc', onChange }) {
  const active = (key) => sortBy === key;
  const arrow = (key) => (active(key) ? (sortOrder === 'asc' ? '▲' : '▼') : '');
  const baseBtn = 'w-full py-1.5 px-2 rounded-full text-sm border transition-colors flex items-center justify-center gap-2 whitespace-nowrap';
  const onClass = 'bg-[#E60028] text-white border-[#E60028]';
  const offClass = 'bg-white text-[#6A6A6A] border-gray-300 hover:bg-gray-50';

  const cycle = (key) => {
    if (key === 'match') { onChange?.('match', 'desc'); return; }
    if (!active(key)) { onChange?.(key, key === 'name' ? 'asc' : 'desc'); return; }
    if (sortOrder === 'asc') { onChange?.(key, 'desc'); return; }
    // third click disables -> fallback to Best Match
    onChange?.('match', 'desc');
  };

  return (
    <div className='w-full flex items-center gap-4'>
      <span className='text-sm text-[#6A6A6A] shrink-0'>Sort by:</span>
      <div className='flex-1 grid grid-cols-6 gap-2'>
        <button type='button' className={`${baseBtn} ${active('match') ? onClass : offClass}`} onClick={() => cycle('match')} aria-pressed={active('match')}>
          <span className='whitespace-nowrap'>Best Match</span>
        </button>
        <button type='button' className={`${baseBtn} ${active('name') ? onClass : offClass}`} onClick={() => cycle('name')} aria-pressed={active('name')}>
          <span className='whitespace-nowrap'>Name</span>
          <span className='text-xs leading-none'>{arrow('name')}</span>
        </button>
        <button type='button' className={`${baseBtn} ${active('h_index') ? onClass : offClass}`} onClick={() => cycle('h_index')} aria-pressed={active('h_index')}>
          <span className='whitespace-nowrap'>H-index</span>
          <span className='text-xs leading-none'>{arrow('h_index')}</span>
        </button>
        <button type='button' className={`${baseBtn} ${active('i10_index') ? onClass : offClass}`} onClick={() => cycle('i10_index')} aria-pressed={active('i10_index')}>
          <span className='whitespace-nowrap'>I10-index</span>
          <span className='text-xs leading-none'>{arrow('i10_index')}</span>
        </button>
        <button type='button' className={`${baseBtn} ${active('citations') ? onClass : offClass}`} onClick={() => cycle('citations')} aria-pressed={active('citations')}>
          <span className='whitespace-nowrap'>Citations</span>
          <span className='text-xs leading-none'>{arrow('citations')}</span>
        </button>
        <button type='button' className={`${baseBtn} ${active('works') ? onClass : offClass}`} onClick={() => cycle('works')} aria-pressed={active('works')}>
          <span className='whitespace-nowrap'>Works</span>
          <span className='text-xs leading-none'>{arrow('works')}</span>
        </button>
      </div>
    </div>
  );
}
