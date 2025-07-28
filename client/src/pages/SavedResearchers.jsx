import React, { useState } from 'react';
import { FaBookmark, FaRegBookmark, FaDownload, FaUserSlash } from 'react-icons/fa'; // fallback empty icon
import Dot from '../assets/dot.png';
import letterH from '../assets/letter-h.png';
import scholarHat from '../assets/scholar-hat.png';
import infoIcon from '../assets/info.png';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function SavedResearchers() {
    const initialSavedList = [
        { name: 'Jason Carroll', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 },
        { name: 'James Kim', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 },
        { name: 'Medison Pham', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 },
        { name: 'Linh Cao', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 }
    ];

    const [savedResearchers, setSavedResearchers] = useState(initialSavedList);
    const [toastMessage, setToastMessage] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [targetResearcher, setTargetResearcher] = useState(null);

    const confirmUnsave = (researcher) => {
        setTargetResearcher(researcher);
        setShowModal(true);
    };

    const unsaveResearcher = () => {
        if (targetResearcher) {
            setSavedResearchers(prev => prev.filter(r => r.name !== targetResearcher.name));
            setToastMessage(`${targetResearcher.name} has been removed`);
            setTimeout(() => setToastMessage(''), 3000);
        }
        setShowModal(false);
    };

    const ExportButton = ({ onClick }) => (
        <button
            onClick={onClick}
            className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 shadow transition-all"
        >
            <FaDownload className="text-white" />
            Export All
        </button>
    );

    return (
        <>
            <Header />
            <div className='w-full h-full mx-auto py-10 bg-gray-100'>
                <div className='w-3/5 mx-auto'>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold">Saved Researchers</h2>
                        <ExportButton onClick={() => console.log('Export clicked!')} />
                    </div>

                    {savedResearchers.length === 0 ? (
                        <div className="text-center mt-20 text-gray-500 flex flex-col items-center gap-4">
                            <FaUserSlash className="text-5xl text-gray-300" />
                            <p className="text-lg">No Saved Researchers</p>
                        </div>
                    ) : (
                        savedResearchers.map((person, index) => (
                            <div
                                key={index}
                                className='relative w-full h-max mb-6 flex items-center justify-between border border-[#D9D9D9] pb-8 px-6 pt-6 bg-white rounded-sm'
                            >
                                {/* Bookmark Icon Top-Right */}
                                <button
                                    onClick={() => confirmUnsave(person)}
                                    className='absolute top-0 right-6'
                                >
                                    <FaBookmark className='text-yellow-400 text-2xl' />
                                </button>

                                {/* Main Content */}
                                <div>
                                    <div className='flex gap-3 items-end mb-1'>
                                        <p className='font-bold text-xl'>{person.name}</p>
                                        <img src={Dot} alt='Dot' className='w-2 h-2 self-center' />
                                        <p className='text-[#6A6A6A] text-md'>{person.institution}</p>
                                    </div>

                                    <div className='flex-col justify-center'>
                                        <img src={letterH} alt='Letter H' className='w-4 h-4 inline-block mr-3 opacity-70' />
                                        <span className='text-sm text-[#6A6A6A]'>h-index: {person.hIndex}</span>
                                        <br />
                                        <img src={scholarHat} alt='Scholar Hat' className='w-4 h-4 inline-block mr-3' />
                                        <span className='text-sm text-[#6A6A6A]'>i10-index: {person.i10Index}</span>
                                    </div>

                                    <div className='w-max py-1 px-8 rounded-md font-semibold bg-[#4D8BC5] text-white text-sm mt-3'>
                                        {person.field}
                                    </div>
                                </div>

                                {/* Right Panel */}
                                <div className='w-max h-full flex flex-col items-center justify-between border-l-1 border-[#E5E5E5] px-12'>
                                    <div className='h-20 w-20 rounded-full border border-[#9F9F9F] flex flex-col items-center justify-center mb-4'>
                                        <div className='flex relative group'>
                                            <p className='text-xs text-[#6A6A6A]'>Score</p>
                                            <img src={infoIcon} alt='Info' className='w-3 h-3 mb-1 cursor-pointer' />
                                            <div className='absolute left-6 top-0 z-10 bg-white border border-gray-300 p-2 rounded shadow-md text-xs text-gray-700 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200'>
                                                Score = h-index + i10-index weight
                                            </div>
                                        </div>
                                        <p className='text-2xl font-semibold'>{person.score}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
            <Footer />

            {/* Toast */}
            {toastMessage && (
                <div className="fixed bottom-6 right-6 bg-black text-white px-4 py-2 rounded shadow-lg z-50">
                    {toastMessage}
                </div>
            )}

            {/* Confirmation Modal */}
            {showModal && (
                <div
                    className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
                    role="dialog"
                    aria-modal="true"
                >
                    {/* Backdrop click closes modal (optional) */}
                    <div
                        className="absolute inset-0"
                        onClick={() => setShowModal(false)}
                    />

                    {/* Modal content */}
                    <div className="relative bg-white p-6 rounded-2xl shadow-2xl z-60 w-[320px] max-w-full">
                        <p className="text-xl font-semibold text-gray-800 mb-6">
                            Remove this researcher?
                        </p>
                        <div className="flex justify-center gap-4">
                            <button
                                onClick={unsaveResearcher}
                                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition"
                            >
                                Yes
                            </button>
                            <button
                                onClick={() => setShowModal(false)}
                                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md transition"
                            >
                                No
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </>
    );
}
