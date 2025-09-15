import React from 'react';

function FolderSidebar({ folders = [], currentFolderId = null, onSelectFolder = () => { } }) {
    return (
        <aside className="w-1/6 p-0 mt-16 text-black flex-shrink-0">
            <div className="px-3">
                <h3 className="font-semibold mb-0">Folders</h3>
                <hr className="border-t border-gray-300 mt-3 mb-4" />
            </div>

            <div className="flex flex-col gap-2 px-1">
                {folders.length === 0 && (
                    <div className="text-sm text-gray-500 px-3">No folders</div>
                )}
                {folders.map((f) => {
                    const isActive = currentFolderId === f.name;
                    return (
                        <button
                            key={f.name}
                            onClick={() => onSelectFolder(f.name)}
                            className={`flex items-center justify-between text-left px-3 py-2 rounded-md w-full transition
                ${isActive ? "bg-gray-200 text-black" : "bg-transparent text-black hover:bg-gray-100"}`}
                            aria-current={isActive ? "true" : undefined}
                        >
                            <span className="truncate">{f.name}</span>
                            <span className={`text-sm ${isActive ? "text-black/80" : "text-gray-500"}`}>
                                {(f.researcherIds || []).length}
                            </span>
                        </button>
                    );
                })}
            </div>
        </aside>
    );
}

export default React.memo(FolderSidebar);