import React, { useState } from 'react';
import { FaBookmark, FaRegBookmark, FaDownload, FaUserSlash } from 'react-icons/fa';
import letterH from '../assets/letter-h.png';
import scholarHat from '../assets/scholar-hat.png';
import infoIcon from '../assets/info.png';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Snackbar, Alert } from '@mui/material';

export default function SavedResearchers() {
    const initialSavedList = [
        { id: '1', name: 'Jason Carroll', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 },
        { id: '2', name: 'James Kim', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 },
        { id: '3', name: 'Medison Pham', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 },
        { id: '4', name: 'Linh Cao', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 },
        { id: '5', name: 'Cuong Nguyen', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 },
        { id: '6', name: 'Kim Cheoul', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 },
        { id: '7', name: 'Minh Tran', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 },
        { id: '8', name: 'Cuong Nguyen', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 }];

    const [savedResearchers, setSavedResearchers] = useState(initialSavedList);
    const [showModal, setShowModal] = useState(false);
    const [targetResearcher, setTargetResearcher] = useState(null);

    const [selectMode, setSelectMode] = useState(false);
    const [selectedResearchers, setSelectedResearchers] = useState([]);

    const [toast, setToast] = useState({
        open: false,
        message: '',
        severity: 'success',
    });

    function showToast(message, severity = 'success') {
        setToast({ open: true, message, severity });
    }

    const confirmUnsave = (researcher) => {
        setTargetResearcher(researcher);
        setShowModal(true);
    };

    const unsaveResearcher = () => {
        if (targetResearcher) {
            setSavedResearchers(prev => prev.filter(r => r.name !== targetResearcher.name));
            showToast(`${targetResearcher.name} has been removed`, 'error');
        }
        setShowModal(false);
    };

    const toggleSelectMode = () => {
        setSelectMode(prev => !prev);
        setSelectedResearchers([]); // clear selection when toggling
    };

    const toggleSelectResearcher = (id) => {
        setSelectedResearchers(prev =>
            prev.includes(id)
                ? prev.filter(n => n !== id)
                : [...prev, id]
        );
    };

    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <div className='w-full flex-grow mx-auto py-10 bg-gray-100'>
                <div className='w-4/5 mx-auto'>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold">Saved Researchers</h2>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={toggleSelectMode}
                                className="rounded-xl bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium px-4 py-2 transition"
                            >
                                {selectMode ? 'Cancel' : 'Select'}
                            </button>

                            <button
                                onClick={() => {
                                    const data = selectMode ? savedResearchers.filter(r => selectedResearchers.includes(r.id)) : savedResearchers;
                                    console.log('Exporting:', data);
                                    showToast('Export Successfully!');
                                }}
                                className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 shadow transition-all"
                            >
                                <FaDownload className="text-white" />
                                {selectMode ? 'Export Selected' : 'Export All'}
                            </button>
                        </div>

                    </div>

                    {savedResearchers.length === 0 ? (
                        <div className="text-center mt-20 text-gray-500 flex flex-col items-center gap-4">
                            <FaUserSlash className="text-5xl text-gray-300" />
                            <p className="text-lg">No Saved Researchers</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {savedResearchers.map((person, index) => (
                                <div
                                    key={index}
                                    className='relative flex flex-col justify-between border border-[#D9D9D9] bg-white rounded-md p-4 shadow-sm hover:shadow-md transition-all'
                                >

                                    <button
                                        onClick={() => confirmUnsave(person)}
                                        className='absolute top-0 right-5'
                                    >
                                        <FaBookmark className='text-yellow-400 text-2xl' />
                                    </button>

                                    <div>
                                        <div className="mb-2">
                                            <div className="flex items-center gap-2">
                                                {selectMode && (
                                                    <div
                                                        className="w-5 h-5 rounded-full border-2 border-gray-400 bg-white flex items-center justify-center cursor-pointer"
                                                        onClick={() => toggleSelectResearcher(person.id)}
                                                    >
                                                        {selectedResearchers.includes(person.id) && (
                                                            <div className="w-3 h-3 bg-blue-500 rounded-full" />
                                                        )}
                                                    </div>
                                                )}
                                                <p className="font-bold text-md">{person.name}</p>
                                            </div>
                                            <p className="text-[#6A6A6A] text-sm">{person.institution}</p>
                                        </div>



                                        <div className='mb-2'>
                                            <div className='text-xs text-[#6A6A6A] flex items-center gap-1'>
                                                <img src={letterH} alt='H' className='w-3 h-3' /> h-index: {person.hIndex}
                                            </div>
                                            <div className='text-xs text-[#6A6A6A] flex items-center gap-1'>
                                                <img src={scholarHat} alt='Scholar' className='w-3 h-3' /> i10-index: {person.i10Index}
                                            </div>
                                        </div>

                                        <div className='text-xs bg-[#4D8BC5] text-white px-3 py-1 rounded-md w-fit'>
                                            {person.field}
                                        </div>
                                    </div>

                                    <div className='mt-4 flex flex-col items-center border-t pt-2'>
                                        <div className='flex items-center gap-1 text-xs text-gray-500 relative group'>
                                            Score <img src={infoIcon} alt='Info' className='w-3 h-3 cursor-pointer' />
                                            <div className='absolute left-6 bottom-full mb-1 z-10 bg-white border border-gray-300 p-2 rounded shadow-md text-xs text-gray-700 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200'>
                                                Score = h-index + i10-index weight
                                            </div>
                                        </div>
                                        <p className='text-xl font-semibold'>{person.score}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <Footer />

            {/* Toast */}
            <Snackbar
                open={toast.open}
                autoHideDuration={3000}
                onClose={() => setToast({ ...toast, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setToast({ ...toast, open: false })} severity={toast.severity} sx={{ width: '100%' }}>
                    {toast.message}
                </Alert>
            </Snackbar>

            {/* Confirmation Modal */}
            {
                showModal && (
                    <div
                        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
                        role="dialog"
                        aria-modal="true"
                    >
                        <div
                            className="absolute inset-0"
                            onClick={() => setShowModal(false)}
                        />

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
                )
            }
        </div >
    );
}
