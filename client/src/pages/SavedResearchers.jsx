import React, { useState } from 'react';
import { FaBookmark, FaRegBookmark, FaDownload } from 'react-icons/fa';
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

    const isSaved = (name) => savedResearchers.some(r => r.name === name);

    const toggleSave = (researcher) => {
        if (isSaved(researcher.name)) {
            // Unsave
            setSavedResearchers(prev => prev.filter(r => r.name !== researcher.name));
        } else {
            // Save
            setSavedResearchers(prev => [...prev, researcher]);
        }
    };

    const ExportButton = ({ onClick }) => {
        return (
            <button
                onClick={onClick}
                className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 shadow transition-all"
            >
                <FaDownload className="text-white" />
                Export All
            </button>
        );
    };

    return (
        <>
            <Header />
            <div className='w-full h-full mx-auto py-10 bg-gray-100'>
                <div className='w-3/5 mx-auto'>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold">Saved Researchers</h2>
                        <ExportButton onClick={() => console.log('Export clicked!')} />
                    </div>


                    {savedResearchers.map((person, index) => (
                        <div
                            key={index}
                            className='relative w-full h-max mb-6 flex items-center justify-between border border-[#D9D9D9] pb-8 px-6 pt-6 bg-white rounded-sm'
                        >
                            {/* Bookmark Icon Top-Right */}
                            <button
                                onClick={() => toggleSave(person)}
                                className='absolute top-0 right-6' // adjust based on your layout
                            >
                                {isSaved(person.name) ? (
                                    <FaBookmark className='text-yellow-400 text-2xl' />
                                ) : (
                                    <FaRegBookmark className='text-gray-400 text-xl' />
                                )}
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
                    ))}
                </div>
            </div>
            <Footer />
        </>
    );
}
