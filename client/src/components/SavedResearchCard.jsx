import React from 'react';
import { RiFolderSharedFill } from "react-icons/ri";
import letterH from '@/assets/letter-h.png';
import scholarHat from '@/assets/scholar-hat.png';
import { FaTimes } from 'react-icons/fa';

export default function SavedResearchCard({
    person,
    selectMode,
    selectedResearchers,
    toggleSelectResearcher,
    openMoveModal,
    confirmUnsave,
    onNavigate,
}) {
    const firstAffiliation = person.current_affiliations?.[0]?.display_name || "";

    return (
        <div
            key={person._id}
            className={`relative flex flex-col justify-start border ${selectedResearchers.includes(person._id) ? 'border-blue-500' : 'border-[#D9D9D9]'} bg-white rounded-md p-4 shadow-sm hover:shadow-md transition-all cursor-pointer`}
            onClick={() => { selectMode ? toggleSelectResearcher(person._id) : onNavigate(person.slug); }}
        >
            <div>
                <div className="flex items-center gap-2">
                    {selectMode && (
                        <div className="w-5 h-5 rounded-full border-2 border-gray-400 bg-white flex items-center justify-center pointer-events-none">
                            {selectedResearchers.includes(person._id) && <div className="w-3 h-3 bg-blue-500 rounded-full" />}
                        </div>
                    )}
                    <p className="font-bold text-lg">{person.basic_info?.name || ""}</p>
                    <div className="ml-auto flex items-center gap-2">
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openMoveModal(person); }}
                            className="text-gray-500 hover:text-gray-700 p-1 rounded"
                            aria-label="Move"
                            title="Move folder"
                        >
                            <RiFolderSharedFill className="text-2xl" />
                        </button>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); confirmUnsave(person); }}
                            className="text-gray-500 hover:text-gray-700 p-1 rounded"
                            aria-label="Remove"
                            title="Remove"
                        >
                            <FaTimes className="text-2xl" />
                        </button>
                    </div>
                </div>

                {/* first affiliation only, single line with ellipsis */}
                {firstAffiliation ? (
                    <p className="text-[#6A6A6A] text-sm mt-1 truncate" style={{ maxWidth: '100%' }}>
                        {firstAffiliation}
                    </p>
                ) : null}
            </div>

            <div className="mt-3">
                <div className="text-sm text-[#6A6A6A] flex items-center gap-1">
                    <img src={letterH} alt="H" className="w-3 h-3" /> h-index: {person.research_metrics?.h_index}
                </div>
                <div className="text-sm text-[#6A6A6A] flex items-center gap-1">
                    <img src={scholarHat} alt="Scholar" className="w-3 h-3" /> i10-index: {person.research_metrics?.i10_index}
                </div>
                <div className="mt-3">
                    {person.research_areas?.fields?.map((field, idx) => (
                        <div key={idx} className="inline-block text-xs bg-[#4D8BC5] text-white px-3 py-1 rounded-md mb-1 mr-1">{field.display_name}</div>
                    ))}
                </div>
            </div>
        </div>
    );
}