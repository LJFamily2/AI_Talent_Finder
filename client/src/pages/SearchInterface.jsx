import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import searchIcon from '../assets/search.png';
import menuIcon from '../assets/menu.png';
import { Switch } from "@/components/ui/switch"
import Bulb from '../assets/lightbulb.png';
import Dot from '../assets/dot.png';
import letterH from '../assets/letter-h.png';
import scholarHat from '../assets/scholar-hat.png';
import infoIcon from '../assets/info.png';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import Footer from '@/components/Footer';

function SearchInterface() {
    const [showCountryModal, setShowCountryModal] = useState(false);
    const [countrySearch, setCountrySearch] = useState("");
    const [selectedCountries, setSelectedCountries] = useState([]);
    const [showFieldModal, setShowFieldModal] = useState(false);
    const [fieldSearch, setFieldSearch] = useState("");
    const [selectedFields, setSelectedFields] = useState([]);
    // Add state for expertise input and focus
    const [expertiseInput, setExpertiseInput] = useState("");
    const [expertiseInputFocused, setExpertiseInputFocused] = useState(false);
    const [peopleList, setPeopleList] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetch('/api/researchers?page=1&limit=10')
          .then(res => res.json())
        .then(data => {
            console.log('API response:', data);
            setPeopleList(data.peopleList || []);
    });
      }, []);

const COUNTRY_LIST = [
  'United States of America', 'China', 'Brazil', 'India', 'Germany',
  'United Kingdom of Great Britain and Northern Ireland', 'Indonesia', 'Japan', 'France', 'Russian Federation', 'Spain',
  // ... add more countries as needed
];
const FIELD_LIST = [
  'Aviation', 'Psychology', 'Mechanical Engineering', 'Food Nutrition', 'Software Testing',
  'Data Science', 'Civil Engineering', 'Business Administration', 'Physics', 'Mathematics',
  // ... add more fields as needed
];

// let peopleList = [
//     { name: 'Jason Carroll', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 },
//     { name: 'James Kim', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 },
//     { name: 'Medison Pham', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 },
//     { name: 'Linh Cao', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 },
//     { name: 'Cuong Nguyen', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 },
//     { name: 'Kim Cheoul', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 },
//     { name: 'Minh Tran', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 },
//     { name: 'Cuong Nguyen', institution: 'RMIT University', hIndex: 12, i10Index: 8, field: 'Aviation', score: 89 }]

  function CountryModal({ open, onClose, countries, selected, onSelect, search, onSearch }) {
    const modalRef = useRef(null);
    useEffect(() => {
      function handleClickOutside(event) {
        if (modalRef.current && !modalRef.current.contains(event.target)) {
          onClose();
        }
      }
      if (open) document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose, open]);
    const filtered = countries.filter(c => c.toLowerCase().includes(search.toLowerCase()));
    return open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
            <div ref={modalRef} className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] p-6 pr-10 pt-8 relative flex flex-col">
                <button className="absolute top-1 right-4 text-2xl text-gray-400 hover:text-gray-600" onClick={onClose} aria-label="Close">&times;</button>
                <input
                    type="text"
                    placeholder="Search institution countries"
                    className="w-full border border-gray-200 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring"
                    value={search}
                    onChange={e => onSearch(e.target.value)}
                />  
                <div className="text-gray-500 text-sm mb-2">All countries ({countries.length})</div>
                <div className="border-b mb-2"></div>
                <div className="overflow-y-auto flex-1 pr-2" style={{ maxHeight: '50vh' }}>
                    {filtered.map((country, idx) => (
                        <label key={country} className="flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer hover:bg-gray-100">
                            <input
                                type="checkbox"
                                checked={selected.includes(country)}
                                onChange={() => onSelect(country)}
                                className="w-5 h-5 accent-[#E60028]"
                            />
                            <span>{country}</span>
                        </label>
                    ))}
                    {filtered.length === 0 && <div className="text-gray-400 text-center py-8">No countries found</div>}
                </div>
            </div>
        </div>
    ) : null;
  }

  function FieldModal({ open, onClose, fields, selected, onSelect, search, onSearch }) {
    const modalRef = useRef(null);
    useEffect(() => {
      function handleClickOutside(event) {
        if (modalRef.current && !modalRef.current.contains(event.target)) {
          onClose();
        }
      }
      if (open) document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose, open]);
    const filtered = fields.filter(f => f.toLowerCase().includes(search.toLowerCase()));
    return open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
            <div ref={modalRef} className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] p-6 pr-10 pt-8 relative flex flex-col">
                <button className="absolute top-1 right-4 text-2xl text-gray-400 hover:text-gray-600" onClick={onClose} aria-label="Close">&times;</button>
                <input
                    type="text"
                    placeholder="Search fields"
                    className="w-full border border-gray-200 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring"
                    value={search}
                    onChange={e => onSearch(e.target.value)}
                />
                <div className="text-gray-500 text-sm mb-2">All fields ({fields.length})</div>
                <div className="border-b mb-2"></div>
                <div className="overflow-y-auto flex-1 pr-2" style={{ maxHeight: '50vh' }}>
                    {filtered.map((field, idx) => (
                        <label key={field} className="flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer hover:bg-gray-100">
                            <input
                                type="checkbox"
                                checked={selected.includes(field)}
                                onChange={() => onSelect(field)}
                                className="w-5 h-5 accent-[#E60028]"
                            />
                            <span>{field}</span>
                        </label>
                    ))}
                    {filtered.length === 0 && <div className="text-gray-400 text-center py-8">No fields found</div>}
                </div>
            </div>
        </div>
    ) : null;
  }

  return (
    <div>
        <Header />
        <div className='w-screen h-max bg-[#F3F4F6] flex p-10'>
            {/* Left side: filter */}
            <div className='w-fit min-w-90 h-full flex justify-center'>
                <div className='w-full bg-white py-8 rounded-2xl shadow-md h-full border border-[#D9D9D9]'>
                    {/* Subsection: Research-based metrics */}
                    <div className='px-6'>
                        <h4 className='text-lg mb-5 font-semibold'>Research-based metrics</h4>
                    <form action="/processing.php">
                        <div className='flex items-center justify-between '>
                            <label htmlFor="hIndex" className='whitespace-nowrap'>h-index</label>
                            <div className='flex w-3/4 justify-end items-center gap-5'>
                                <select name="comparison" className='border border-gray-300 bg-white rounded-lg py-1 px-2 text-gray-500'>
                                    <option value="equals" >equals</option>
                                    <option value="less-than">less than</option>
                                    <option value="larger-than">larger than</option>
                                </select>
                                <div className='w-2/5 border-b-1 border-[#6A6A6A] flex items-center py-1'>
                                    <input type='number' id="hIndex" className='w-30 focus:outline-0 text-end px-3' min={0}/>
                                </div>
                            </div>
                        </div>

                        {/* Space between elements */}
                        <div className='h-2' /> 
                    
                        <div className='flex items-center justify-between'>
                            <label htmlFor="i10Index" className='whitespace-nowrap'>i10-index</label>
                            <div className='flex w-3/4 justify-end items-center gap-5'>
                                <select name="comparison" className='border border-gray-300 bg-white rounded-lg py-1 px-2 text-gray-500'>
                                    <option value="equals" >equals</option>
                                    <option value="less-than">less than</option>
                                    <option value="larger-than">larger than</option>
                                </select>
                                <div className='w-2/5 border-b-1 border-[#6A6A6A] flex items-center py-1'>
                                    <input type='number' id="i10Index" className='w-30 focus:outline-0 text-end px-3' min={0}/>
                                </div>
                            </div>
                        </div>

                        <div className='flex gap-2 mt-6'>
                            <button type="reset" className='w-1/2 bg-white py-1 rounded-lg border border-[#9F9F9F] cursor-pointer hover:bg-gray-200 hover:border-gray-300'>Clear</button>
                            <button type="submit" className='w-1/2 bg-[#E60028] text-white py-1 rounded-lg cursor-pointer hover:bg-[#B4001F]'>Apply</button>
                        </div>
                    </form>
                    </div>
                    

                    <hr className='mt-12 mb-6 border-[#F3F4F6] shadow-sm' />

                    {/* Subsection: Field */}
                    <div className='px-6'>
                        <div className='flex items-center justify-between'>
                        <h4 className='text-lg mb-5 font-semibold mt-6'>Expertise field</h4>
                            <button
                                className='text-blue-600 text-md font-normal hover:underline focus:outline-none mb-5'
                                style={{ visibility: selectedFields.length > 0 ? 'visible' : 'hidden' }}
                                onClick={() => setSelectedFields([])}
                            >
                                Clear filter
                            </button>
                        </div>
                        <div className='flex items-center gap-3'>
                            <img
                                src={menuIcon}
                                alt='Menu'
                                className='w-4 h-5 cursor-pointer'
                                onClick={() => setShowFieldModal(true)}
                            />
                            <div className='w-full relative'>
                                <div className='border border-gray-300 bg-white rounded-lg flex justify-between items-center py-2 px-4'>
                                    <input
                                        type='text'
                                        placeholder='e.g. Food nutrition'
                                        className='focus:outline-0 w-full'
                                        value={expertiseInput}
                                        onChange={e => setExpertiseInput(e.target.value)}
                                        onFocus={() => setExpertiseInputFocused(true)}
                                        onBlur={() => setTimeout(() => setExpertiseInputFocused(false), 150)}
                                    />
                                </div>
                                {/* Dropdown for suggestions */}
                                {expertiseInputFocused && expertiseInput.trim() && (
                                    <div className='absolute left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20'>
                                        {FIELD_LIST.filter(f => f.toLowerCase().includes(expertiseInput.toLowerCase()) && !selectedFields.includes(f)).slice(0,4).map(f => (
                                            <div
                                                key={f}
                                                className='px-4 py-2 cursor-pointer hover:bg-gray-100 text-gray-800'
                                                onMouseDown={() => {
                                                    setSelectedFields([...selectedFields, f]);
                                                    setExpertiseInput("");
                                                }}
                                            >
                                                {f}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className='flex flex-col gap-3 mt-4'>
                            {selectedFields.map(field => (
                                <div key={field} className='flex items-center bg-gray-300 text-[#6A6A6A] pl-3 pr-6 py-2 rounded-lg w-max text-md font-normal gap-2'>
                                    <button
                                        className='text-2xl text-gray-500 hover:text-gray-700 focus:outline-none mr-2'
                                        onClick={() => setSelectedFields(selectedFields.filter(f => f !== field))}
                                    >
                                        ×
                                    </button>
                                    {field}
                                </div>
                            ))}
                        </div>
                    </div>
                    

                    {/* Space between elements */}

                    <hr className='mt-12 mb-6 border-[#F3F4F6] shadow-sm' />

                    {/* Subsection: Institution country */}
                    <div className='px-6'>
                        <h4 className='text-lg mb-5 font-semibold'>Institution country</h4>
                    <div className='flex flex-col gap-2'>
                        <div>
                            <input type='checkbox' id='insCountryIsVietNam' className='mr-4' />
                            <label htmlFor='insCountryIsVietNam'>Vietnam</label>
                        </div>
                        <div>
                            <input type='checkbox' id='insCountryIsUSA' className='mr-4' />
                            <label htmlFor='insCountryIsUSA'>United States of America</label>
                        </div>
                        <div>
                            <input type='checkbox' id='insCountryIsGermany' className='mr-4' />
                            <label htmlFor='insCountryIsGermany'>Germany</label>
                        </div>
                        <div>
                            <input type='checkbox' id='insCountryIsIndia' className='mr-4' />
                            <label htmlFor='insCountryIsIndia'>India</label>
                        </div>
                        <div>
                            <input type='checkbox' id='insCountryIsFrance' className='mr-4' />
                            <label htmlFor='insCountryIsFrance'>France</label>
                        </div>
                        <button
                            className='w-min self-end cursor-pointer text-gray-500'
                            onClick={() => setShowCountryModal(true)}
                        >More...</button>
                    </div>
                    </div>

                    <hr className='mt-12 mb-6 border-[#F3F4F6] shadow-sm' />


                    {/* Other links */}
                    <div className='px-6'>
                        <h4 className='text-lg mb-5 font-semibold'>Other links</h4>
                        <div className='flex justify-between items-center mb-2'>
                            <label htmlFor='hasScopusID'>Candidate has Scopus ID</label>
                            <Switch id="hasScopusID"/>
                        </div>
                        <div className='flex justify-between items-center'> 
                            <label htmlFor='hasOrcidID'>Candidate has ORCID ID</label>
                            <Switch id="hasOrcidID"/>
                        </div>
                    </div>
                </div>
            </div>

            

            {/* Right side: search results */}
            <div className='w-3/5 h-full mx-auto'>
                <div className='w-full'>
                    {/* Spacer */}
                    <div className='h-10'></div>
                    
                    {/* People List */}
                    {peopleList.map((person, index) => (
                    <div className='w-full h-max mb-6 flex items-center justify-between border-1 border-[#D9D9D9] pb-8 px-6 pt-6 bg-white rounded-sm' key={index}>
                        <div>
                            <div className='flex items-start justify-between gap-4'>
                                <div>
                                    <p className='font-bold text-xl'>{person.name}</p>
                                    <div className='flex items-center flex-wrap'>
                                        {person.institution
                                            ? person.institution.split(',').map((inst, idx, arr) => (
                                                <React.Fragment key={idx}>
                                                <p className='text-[#000000] text-md whitespace-nowrap'>{inst.trim()}</p>
                                                {idx < arr.length - 1 && (
                                                    <img src={Dot} alt='Dot' className='w-2 h-2 self-center mx-2' />
                                                )}
                                                </React.Fragment>
                                            ))
                                            : <p className='text-[#6A6A6A] text-md'>No institution</p>
                                        }
                                    </div>

                                    <div className='flex-col justify-center mt-3'>
                                        <span className='text-md text-[#6A6A6A]'>h-index: {person.hIndex}</span>
                                        <br />
                                        <span className='text-md text-[#6A6A6A]'>i10-index: {person.i10Index}</span>
                                    </div>
                                </div>
                            <button className='bg-[#d2e4f4] text-[#346089] font-semibold py-2 px-6 rounded-md mt-2 text-md cursor-pointer' onClick={() => navigate(`/researcher-profile/${person.id}`)}>View profile</button>
                        </div>

                            <div className="flex flex-wrap gap-2 mt-5">
                                {person.field
                                    ? person.field.split(',').map((field, idx) => (
                                        <div
                                        key={idx}
                                        className="inline-block rounded-full bg-white text-[#3C72A5] text-sm font-semibold px-4 py-1 border border-[#d2e4f4]"
                                        >
                                        {field.trim()}
                                        </div>
                                    ))
                                    : null}
                                </div>
                        </div>
                    </div>
                    ))}
                    

                    <Pagination>
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious href="#" />
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationLink href="#" isActive>1</PaginationLink>
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationLink href="#">
                                    2
                                    </PaginationLink>
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationLink href="#">3</PaginationLink>
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationEllipsis />
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationNext href="#" />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                </div>
            </div>
            
        </div>

        <CountryModal
  open={showCountryModal}
  onClose={() => setShowCountryModal(false)}
  countries={COUNTRY_LIST}
  selected={selectedCountries}
  onSelect={country => {
    setSelectedCountries(sel => sel.includes(country) ? sel.filter(c => c !== country) : [...sel, country]);
    setShowCountryModal(false);
  }}
  search={countrySearch}
  onSearch={setCountrySearch}
/>
        <FieldModal
  open={showFieldModal}
  onClose={() => setShowFieldModal(false)}
  fields={FIELD_LIST}
  selected={selectedFields}
  onSelect={field => {
    setSelectedFields(sel => sel.includes(field) ? sel.filter(f => f !== field) : [...sel, field]);
    setShowFieldModal(false);
  }}
  search={fieldSearch}
  onSearch={setFieldSearch}
/>
        <Footer />
    </div>
  );
}
export default SearchInterface;
