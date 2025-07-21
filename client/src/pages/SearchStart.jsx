import React, { useState } from 'react';
import { Search } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useNavigate } from 'react-router-dom';

export default function SearchStart() {
    const suggestions = [
        'Psychology',
        'Machine Learning',
        'Finance',
        'Human Resources',
        'Artificial Intelligence',
        'Education',
        'Marketing',
    ];

    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    function handleKeyDown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            setLoading(true);
            setTimeout(() => {
                setLoading(false);
                navigate('/search-interface');
            }, 2000);
        }
    }

    function handleSuggestionClick(field) {
        setSearchTerm(field);
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            navigate('/search-interface');
        }, 2000);
    }

    return (
        <>
            <Header />
            <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-4">
                <div className="max-w-2xl w-full space-y-8">
                    <p className="text-gray-800 text-2xl font-medium">
                        Search for academic talents by field of study
                    </p>

                    <div className="relative">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <Search className="w-6 h-6 text-gray-500" />
                        </div>
                        <input
                            type="text"
                            placeholder="Enter a field or topic you want to look for"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full pl-12 pr-4 py-4 text-base border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <p className="text-gray-600 text-base mb-4 text-center">Some suggestions for you:</p>
                        <div className="flex flex-wrap gap-3 justify-center">
                            {suggestions.map((field, idx) => (
                                <button
                                    key={idx}
                                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-base rounded-full transition"
                                    onClick={() => handleSuggestionClick(field)}
                                >
                                    {field}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            {loading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
                    <div className="bg-white px-10 py-8 rounded-lg shadow-lg flex flex-col items-center">
                        <svg className="animate-spin h-8 w-8 text-blue-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                        </svg>
                        <span className="text-lg text-gray-700">Loading, please wait...</span>
                    </div>
                </div>
            )}
            <Footer />
        </>
    );
}
