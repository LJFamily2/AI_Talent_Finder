import React, { useEffect, useRef } from 'react';
import scoreIcon from '../assets/score.png';
import citationIcon from '../assets/citation.png';
import documentIcon from '../assets/document.png';
import nameIcon from '../assets/name.png';

export default function SortModal({ selected, onSelect, onClose }) {
  const modalRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(event) {
      if (modalRef.current && !modalRef.current.contains(event.target)) onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div ref={modalRef} className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 p-6">
      <div className="text-[#6A6A6A] text-md mb-2">Sort by:</div>
      <hr className="mb-4" />
      <div className="flex flex-col gap-4">
        <label className="flex items-center gap-5 cursor-pointer rounded-lg transition-colors hover:bg-gray-100 px-2 py-2">
          <img src={scoreIcon} alt="Score" className="w-6 h-6" />
          <span className="flex-1">Ranking score</span>
          <input type="radio" name="sort" checked={selected === 'ranking'} onChange={() => onSelect('ranking')} className="sr-only" />
        </label>
        <label className="flex items-center gap-5 cursor-pointer rounded-lg transition-colors hover:bg-gray-100 px-2 py-2">
          <img src={citationIcon} alt="Citations" className="w-6 h-6" />
          <span className="flex-1">Citations count</span>
          <input type="radio" name="sort" checked={selected === 'citations'} onChange={() => onSelect('citations')} className="sr-only" />
        </label>
        <label className="flex items-center gap-5 cursor-pointer rounded-lg transition-colors hover:bg-gray-100 px-2 py-2">
          <img src={documentIcon} alt="Publications" className="w-6 h-6" />
          <span className="flex-1">Publications count</span>
          <input type="radio" name="sort" checked={selected === 'publications'} onChange={() => onSelect('publications')} className="sr-only" />
        </label>
        <label className="flex items-center gap-5 cursor-pointer rounded-lg transition-colors hover:bg-gray-100 px-2 py-2">
          <img src={nameIcon} alt="Name" className="w-6 h-6" />
          <span className="flex-1">Name</span>
          <input type="radio" name="sort" checked={selected === 'name'} onChange={() => onSelect('name')} className="sr-only" />
        </label>
      </div>
    </div>
  );
}

