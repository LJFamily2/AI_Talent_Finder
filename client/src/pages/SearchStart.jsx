import React, { useState } from 'react';
import { Search } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

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
                                    onClick={() => setSearchTerm(field)}
                                >
                                    {field}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </>
    );
}
