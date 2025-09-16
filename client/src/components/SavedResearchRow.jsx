import React from 'react';
import { FaTimes } from 'react-icons/fa';
import { RiFolderSharedFill } from "react-icons/ri";


function SavedResearchRow({
    person,
    selectMode,
    selectedResearchers = [],
    toggleSelectResearcher,
    openMoveModal,
    confirmUnsave,
    onNavigate,
}) {
    const id = person._id || person.id || person.slug || (person.__raw && (person.__raw._id || person.__raw.id));
    const checked = selectedResearchers.includes(id);

    const name =
        person.basic_info?.name ||
        person.name ||
        person.display_name ||
        person.__raw?.name ||
        id;

    const institution =
        person.current_affiliations?.[0]?.display_name ||
        person.institution ||
        (Array.isArray(person.institutions) && person.institutions[0]) ||
        "";

    // total citations / works from research_metrics or fallback properties
    const totalCitations =
        person.research_metrics?.total_citations ??
        0;

    const totalWorks =
        person.research_metrics?.total_works ??
        0;

    const hIndex = person.research_metrics?.h_index ?? person.hIndex ?? 0;
    const i10Index = person.research_metrics?.i10_index ?? person.i10Index ?? 0;

    return (
        <div
            className={`flex items-center border ${checked ? 'border-blue-500' : 'border-[#D9D9D9]'} bg-white rounded-md px-4 py-2 shadow-sm hover:shadow-md transition-all cursor-pointer text-md`}
            onClick={() => {
                if (selectMode) {
                    toggleSelectResearcher(id);
                } else {
                    onNavigate(person.slug || id);
                }
            }}
        >
            <div className="w-1/4 flex items-center">
                {selectMode && (
                    <div className="w-6 h-6 rounded-full border-2 border-gray-400 bg-white flex items-center justify-center mr-3 pointer-events-none">
                        {checked && <div className="w-4 h-4 bg-blue-500 rounded-full" />}
                    </div>
                )}
                <span className="font-bold">{name}</span>
            </div>

            <div className="w-1/3 text-[#6A6A6A] text-sm">
                {institution}
            </div>

            <div className="w-1/7 flex items-center justify-center text-[#6A6A6A]">
                <span className="text-center">{totalCitations.toLocaleString?.() ?? totalCitations}</span>
            </div>

            <div className="w-1/8 flex items-center justify-center text-[#6A6A6A]">
                <span className="text-center">{totalWorks.toLocaleString?.() ?? totalWorks}</span>
            </div>

            <div className="w-1/11 flex items-center justify-center text-[#6A6A6A]">
                <span className="text-center">{hIndex}</span>
            </div>

            <div className="w-1/11 flex items-center justify-center text-[#6A6A6A]">
                <span className="text-center">{i10Index}</span>
            </div>

            <div className="w-1/12 flex items-center justify-end gap-6">
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        openMoveModal(person);
                    }}
                    className="text-gray-600 hover:text-gray-800"
                    aria-label="Move"
                    title="Move folder"
                >
                    <RiFolderSharedFill />
                </button>

                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        confirmUnsave(person);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                    aria-label="Remove"
                    title="Remove"
                >
                    <FaTimes />
                </button>
            </div>
        </div>
    );
}

export default React.memo(SavedResearchRow);