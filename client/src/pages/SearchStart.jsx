import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import * as Select from '@radix-ui/react-select';
import { ChevronDown, Check, ArrowRight } from 'lucide-react';
import '../App.css';

export default function SearchStart() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchField, setSearchField] = useState('expertise');
  const [iconBounce, setIconBounce] = useState(false);

  const suggestions = [
    'Psychology',
    'Machine Learning',
    'Finance',
    'Human Resources',
    'Artificial Intelligence',
    'Education',
    'Marketing',
  ];

  const options = [
    { label: 'Institution', value: 'institution' },
    { label: 'Expertise', value: 'expertise' },
    { label: 'Institution Country', value: 'country' },
    { label: 'Name', value: 'name' },
  ];

  const categories = {
    institution: ["Name", "Email", "Department", "Institution"],
    expertise: ["Title", "Journal", "Year", "DOI"],
    country: ["Project Title", "Funding Agency", "Grant Number"],
    name: ["First Name", "Last Name", "Full Name"],
  };

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const suggestionRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        suggestionRef.current &&
        !suggestionRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
        setHighlightIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close when category changes
  useEffect(() => {
    setShowSuggestions(false);
    setHighlightIndex(-1);
    setSearchTerm("");
  }, [searchField]);

  const placeholders = {
    institution: 'Enter an institution',
    expertise: 'Enter a research expertise',
    country: 'Enter a country',
    name: 'Enter a name',
  };

  const getPlaceholder = () => placeholders[searchField] || 'Enter your search query';

  const executeSearch = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate('/search-interface');
    }, 2000);
  };

  const filteredOptions =
    categories[searchField]?.filter((o) =>
      o.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

  const handleKeyDown = (e) => {
    if (!showSuggestions && filteredOptions.length > 0) {
      setShowSuggestions(true);
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < filteredOptions.length) {
        setSearchTerm(filteredOptions[highlightIndex]);
      } else {
        setSearchTerm(searchTerm.trim()); // free text accepted
      }
      setShowSuggestions(false);
      setHighlightIndex(-1);
      executeSearch();
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setHighlightIndex(-1);
    }
  };

  return (
    <>
      <Header />
      <div className="w-full flex justify-end px-4 mt-4">
        <button
          onClick={() => executeSearch()}
          className="flex items-center gap-2 text-sm bg-transparent font-semibold transition group cursor-pointer"
          onMouseEnter={() => setIconBounce(true)}
          onMouseLeave={() => setIconBounce(false)}
          style={{ boxShadow: 'none' }}
        >
          <span className="group-hover:underline group-hover:text-blue-400 text-blue-600 transition">
            Advanced Search
          </span>
          <span
            className={`rounded-full bg-blue-100 p-2 transition ${iconBounce ? 'bounce-right' : ''} cursor-pointer`}
          >
            <ArrowRight className="w-5 h-5 text-blue-600" />
          </span>
        </button>
      </div>
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <p
          className="text-gray-800 text-4xl font-medium text-center mb-10 w-full xl:whitespace-nowrap lg:whitespace-normal"
          style={{ fontFamily: "'Nata Sans', sans-serif" }}
        >
          Search for academic talents by a criteria of your choice
        </p>
        <div className="flex flex-row w-full">
          <div className='basis-3/7'></div>

          {/* Search input and select */}
          <div className="flex w-full max-w-4xl mx-auto rounded-xl">
            {/* Dropdown */}
            <Select.Root value={searchField} onValueChange={setSearchField}>
              <Select.Trigger
                className="inline-flex items-center justify-between px-3 py-2 text-gray-800 text-base bg-blue-100 border border-blue-200 border-r-0 rounded-l-xl shadow-lg focus:outline-none hover:bg-blue-100 transition-colors min-w-[140px]"
                aria-label="Search field"
              >
                <Select.Value />
                <Select.Icon className="ml-1">
                  <ChevronDown className="w-4 h-4 text-blue-500 group-hover:text-blue-700 transition-colors" />
                </Select.Icon>
              </Select.Trigger>

              <Select.Portal>
                <Select.Content
                  side="bottom"
                  align="end"
                  sideOffset={4}
                  position="popper"
                  className="z-50"
                >
                  <Select.Viewport className="bg-white rounded-md shadow-xl p-1 min-w-[100%]">
                    <Select.Group>
                      <Select.Label className="px-3 py-2 text-sm text-gray-500">
                        What are you looking for?
                      </Select.Label>
                      <Select.Separator className="h-px bg-gray-200 my-1" />
                      {options.map((option) => (
                        <Select.Item
                          key={option.value}
                          value={option.value}
                          className="flex items-center px-3 py-2 text-base text-gray-800 rounded-md hover:bg-blue-50 focus:outline-none focus:bg-blue-100"
                        >
                          <Select.ItemText>{option.label}</Select.ItemText>
                          <Select.ItemIndicator className="ml-auto">
                            <Check className="w-4 h-4 text-blue-600" />
                          </Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Group>
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>

            {/* Search input */}
            <div className="relative flex-grow" ref={suggestionRef}>
              <input
                type="text"
                placeholder={getPlaceholder()}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (e.target.value.trim() !== "") {
                    setShowSuggestions(true);
                  } else {
                    setShowSuggestions(false);
                  }
                }}
                onKeyDown={handleKeyDown}
                className="w-full p-4 py-4 text-base text-black bg-white border border-blue-200 rounded-r-xl shadow-lg focus:outline-none"
              />

              {/* Dropdown chevron */}
              <button
                type="button"
                onClick={() => {
                  if (filteredOptions.length > 0) {
                    setShowSuggestions((prev) => !prev);
                  }
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              {/* Suggestions dropdown */}
              {showSuggestions && (
                <ul className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto z-50">
                  {filteredOptions.length > 0 ? (
                    filteredOptions.map((option, index) => (
                      <li
                        key={option}
                        className={`px-4 py-2 text-base text-gray-800 cursor-pointer ${
                          index === highlightIndex ? "bg-blue-100" : "hover:bg-blue-50"
                        }`}
                        onClick={() => {
                          setSearchTerm(option);
                          setShowSuggestions(false);
                          setHighlightIndex(-1);
                        }}
                        onMouseEnter={() => setHighlightIndex(index)}
                      >
                        {option}
                      </li>
                    ))
                  ) : (
                    <li className="px-4 py-2 text-sm text-gray-500 italic">
                      No matches found — press Enter to search
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>

          <div className='basis-3/7'></div>
        </div>

        {/* Quick suggestions */}
        <div className="max-w-2xl w-full mt-40">
          <div className="text-center">
            <p className="text-gray-600 text-base mb-4">
              First time here? Select an expertise domain below to start.
            </p>
            <div className="flex flex-wrap gap-3 justify-center mb-6">
              {suggestions.map((field) => (
                <button
                  key={field}
                  onClick={() => {
                    setSearchTerm(field);
                    executeSearch();
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-base rounded-full transition"
                >
                  {field}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="bg-white px-10 py-8 rounded-lg shadow-lg flex flex-col items-center">
            <svg
              className="animate-spin h-8 w-8 text-blue-600 mb-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              ></path>
            </svg>
            <span className="text-lg text-gray-700">Loading, please wait...</span>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}
