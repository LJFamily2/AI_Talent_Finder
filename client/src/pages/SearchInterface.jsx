import React, { useState, useRef, useEffect } from 'react';
import Header from '../components/Header';
import searchIcon from '../assets/search.png';
import menuIcon from '../assets/menu.png';
import sortIcon from '../assets/sort.png';
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
import documentIcon from '../assets/document.png';
import nameIcon from '../assets/name.png';
import citationIcon from '../assets/citation.png';
import scoreIcon from '../assets/score.png';

function SearchInterface() {
  const [showSortModal, setShowSortModal] = useState(false);
  const [sortOption, setSortOption] = useState('ranking');

  function SortModal({ selected, onSelect, onClose }) {
      const modalRef = useRef(null);
      useEffect(() => {
          function handleClickOutside(event) {
              if (modalRef.current && !modalRef.current.contains(event.target)) {
                  onClose();
              }
          }
          document.addEventListener('mousedown', handleClickOutside);
          return () => document.removeEventListener('mousedown', handleClickOutside);
      }, [onClose]);
      return (
          <div
              ref={modalRef}
              className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 p-6"
          >
              <div className="text-[#6A6A6A] text-md mb-2">Sort by:</div>
              <hr className="mb-4" />
              <div className="flex flex-col gap-4">
                  <label className="flex items-center gap-5 cursor-pointer rounded-lg transition-colors hover:bg-gray-100 px-2 py-2">
                      <img src={scoreIcon} alt="Score" className="w-6 h-6" />
                      <span className="flex-1">Ranking score</span>
                      <input
                          type="radio"
                          name="sort"
                          checked={selected === 'ranking'}
                          onChange={() => onSelect('ranking')}
                          className="sr-only"
                      />
                  </label>
                  <label className="flex items-center gap-5 cursor-pointer rounded-lg transition-colors hover:bg-gray-100 px-2 py-2">
                      <img src={citationIcon} alt="Citations" className="w-6 h-6" />
                      <span className="flex-1">Citations count</span>
                      <input
                          type="radio"
                          name="sort"
                          checked={selected === 'citations'}
                          onChange={() => onSelect('citations')}
                          className="sr-only"
                      />
                  </label>
                  <label className="flex items-center gap-5 cursor-pointer rounded-lg transition-colors hover:bg-gray-100 px-2 py-2">
                      <img src={documentIcon} alt="Publications" className="w-6 h-6" />
                      <span className="flex-1">Publications count</span>
                      <input
                          type="radio"
                          name="sort"
                          checked={selected === 'publications'}
                          onChange={() => onSelect('publications')}
                          className="sr-only"
                      />
                  </label>
                  <label className="flex items-center gap-5 cursor-pointer rounded-lg transition-colors hover:bg-gray-100 px-2 py-2">
                      <img src={nameIcon} alt="Name" className="w-6 h-6" />
                      <span className="flex-1">Name</span>
                      <input
                          type="radio"
                          name="sort"
                          checked={selected === 'name'}
                          onChange={() => onSelect('name')}
                          className="sr-only"
                      />
                  </label>
              </div>
          </div>
      );
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
                                <select name="comparison" className='border border-gray-300 bg-white rounded-lg py-1 px-2'>
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
                                <select name="comparison" className='border border-gray-300 bg-white rounded-lg py-1 px-2 '>
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
                            <button type="reset" className='w-1/2 bg-white py-1 rounded-lg border border-[#9F9F9F] cursor-pointer'>Clear</button>
                            <button type="submit" className='w-1/2 bg-[#E60028] text-white py-1 rounded-lg cursor-pointer'>Apply</button>
                        </div>
                    </form>
                    </div>
                    

                    <hr className='mt-12 mb-6 border-[#F3F4F6] shadow-sm' />

                    {/* Subsection: Field */}
                    <div className='px-6'>
                        <h4 className='text-lg mb-5 font-semibold mt-6'>Expertise field</h4>
                        <div className='flex items-center gap-3'>
                            <img src={menuIcon} alt='Menu' className='w-4 h-4 cursor-pointer' />
                            <div className='w-full border border-gray-300 bg-white rounded-lg flex justify-between items-center py-1 px-4'>
                                <input type='text' placeholder='e.g. Food nutrition' className='focus:outline-0 w-full' />
                                <input type='image' src={searchIcon} alt='Search' className='w-4 h-4 cursor-pointer' />
                            </div>
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
                        <button className='w-min self-end cursor-pointer text-gray-500'>More...</button>
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
            <div className='w-2/3 h-full mx-auto'>
                <div className='w-full'>
                    {/* Search bar */}
                    <div className='flex items-center justify-between border border-[#D9D9D9] bg-white rounded-lg py-2 px-8 mb-6 w-full mx-auto shadow-md'>
                        <input type='image' src={searchIcon} alt='Search' className='w-4 h-4 cursor-pointer' />
                        <input type='text' placeholder='Search for academics by name' className='focus:outline-0 w-full ml-6 py-2' />
                    </div>

                    {/* Spacer */}
                    <div className='h-10'></div>

                    {/* Search results */}
                    <div className='flex items-center justify-between mb-8'>
                        <div className='flex items-end gap-2'>
                            <img src={Bulb} alt='Lightbulb' className='w-8 h-8' />
                            <p className='text-xl text-[#000054] italic'>Found <b>199</b> matching results</p>
                        </div>
                        {/* Sort Modal Trigger and Modal */}
                        <div className="relative">
                            <img
                                src={sortIcon}
                                alt="Sort"
                                className="w-8 h-8 cursor-pointer"
                                onClick={() => setShowSortModal(true)}
                            />
                            {showSortModal && (
                                <SortModal
                                    selected={sortOption}
                                    onSelect={setSortOption}
                                    onClose={() => setShowSortModal(false)}
                                />
                            )}
                        </div>
                        
                    </div>
                    
                    
                    <div className='bg-white w-full h-max py-4 pl-6 rounded-lg mb-5 flex items-center justify-between border border-[#D9D9D9]'>
                        <div>
                            <div className='flex gap-3 items-end mb-1'>
                                <p className='font-bold text-xl'>Jason Carroll</p>
                                <img src={Dot} alt='Dot' className='w-2 h-2 self-center' />
                                <p className='text-[#6A6A6A] text-md'>RMIT University</p>
                            </div>

                            <div className='flex-col justify-center'>
                                <img src={letterH} alt='Letter H' className='w-4 h-4 inline-block mr-3 opacity-70'/>
                                <span className='text-sm text-[#6A6A6A]'>h-index: 12</span>
                                <br />
                                <img src={scholarHat} alt='Scholar Hat' className='w-4 h-4 inline-block mr-3' />
                                <span className='text-sm text-[#6A6A6A]'>i10-index: 8</span>
                            </div>

                            <div className='w-max py-1 px-8 rounded-full font-semibold bg-[#4D8BC5] text-white text-sm mt-3'>Aviation</div>
                        </div>
                        
                        <div className='w-1/3 h-full flex items-start justify-center border-l-1 border-[#E5E5E5]'>
                            <div className='h-20 w-20 rounded-full border border-[#9F9F9F] flex flex-col items-center justify-center'>
                                <div className='flex relative group'>
                                    <p className='text-xs text-[#6A6A6A]'>Score</p>
                                    <img src={infoIcon} alt='Info' className='w-3 h-3 mb-1 cursor-pointer' aria-describedby="scoreTooltip"/>
                                    <div role='tooltip' id='scoreTooltip' className='absolute left-6 top-0 z-10 bg-white border border-gray-300 p-2 rounded shadow-md text-xs text-gray-700 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200'
>
                                        The score is calculated based on the h-index and i10-index, reflecting the academic's research impact.
                                    </div>
                                </div>
                                
                                <p className='text-2xl font-semibold'>89</p>
                            </div>
                        </div>
                    </div>

                    <div className='bg-white w-full h-max py-4 pl-6 rounded-lg mb-5 flex items-center justify-between border border-[#D9D9D9]'>
                        <div>
                            <div className='flex gap-3 items-end mb-1'>
                                <p className='font-bold text-xl'>James Kim</p>
                                <img src={Dot} alt='Dot' className='w-2 h-2 self-center' />
                                <p className='text-[#6A6A6A] text-md'>RMIT University</p>
                            </div>

                            <div className='flex-col justify-center'>
                                <img src={letterH} alt='Letter H' className='w-4 h-4 inline-block mr-3 opacity-70'/>
                                <span className='text-sm text-[#6A6A6A]'>h-index: 12</span>
                                <br />
                                <img src={scholarHat} alt='Scholar Hat' className='w-4 h-4 inline-block mr-3' />
                                <span className='text-sm text-[#6A6A6A]'>i10-index: 8</span>
                            </div>

                            <div className='w-max py-1 px-8 rounded-full font-semibold bg-[#4D8BC5] text-white text-sm mt-3'>Aviation</div>
                        </div>
                        
                        <div className='w-1/3 h-full flex items-start justify-center border-l-1 border-[#E5E5E5]'>
                            <div className='h-20 w-20 rounded-full border border-[#9F9F9F] flex flex-col items-center justify-center'>
                                <div className='flex relative group'>
                                    <p className='text-xs text-[#6A6A6A]'>Score</p>
                                    <img src={infoIcon} alt='Info' className='w-3 h-3 mb-1 cursor-pointer' aria-describedby="scoreTooltip"/>
                                    <div role='tooltip' id='scoreTooltip' className='absolute left-6 top-0 z-10 bg-white border border-gray-300 p-2 rounded shadow-md text-xs text-gray-700 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200'
>
                                        The score is calculated based on the h-index and i10-index, reflecting the academic's research impact.
                                    </div>
                                </div>
                                
                                <p className='text-2xl font-semibold'>89</p>
                            </div>
                        </div>
                    </div>

                    <div className='bg-white w-full h-max py-4 pl-6 rounded-lg mb-5 flex items-center justify-between border border-[#D9D9D9]'>
                        <div>
                            <div className='flex gap-3 items-end mb-1'>
                                <p className='font-bold text-xl text-[#000054]'>Medison Pham</p>
                                <img src={Dot} alt='Dot' className='w-2 h-2 self-center' />
                                <p className='text-[#6A6A6A] text-md'>RMIT University</p>
                            </div>

                            <div className='flex-col justify-center'>
                                <img src={letterH} alt='Letter H' className='w-4 h-4 inline-block mr-3 opacity-70'/>
                                <span className='text-sm text-[#6A6A6A]'>h-index: 12</span>
                                <br />
                                <img src={scholarHat} alt='Scholar Hat' className='w-4 h-4 inline-block mr-3' />
                                <span className='text-sm text-[#6A6A6A]'>i10-index: 8</span>
                            </div>

                            <div className='w-max py-1 px-8 rounded-full font-semibold bg-[#4D8BC5] text-white text-sm mt-3'>Aviation</div>
                        </div>
                        
                        <div className='w-1/3 h-full flex items-start justify-center border-l-1 border-[#E5E5E5]'>
                            <div className='h-20 w-20 rounded-full border border-[#9F9F9F] flex flex-col items-center justify-center'>
                                <div className='flex relative group'>
                                    <p className='text-xs text-[#6A6A6A]'>Score</p>
                                    <img src={infoIcon} alt='Info' className='w-3 h-3 mb-1 cursor-pointer' aria-describedby="scoreTooltip"/>
                                    <div role='tooltip' id='scoreTooltip' className='absolute left-6 top-0 z-10 bg-white border border-gray-300 p-2 rounded shadow-md text-xs text-gray-700 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200'
>
                                        The score is calculated based on the h-index and i10-index, reflecting the academic's research impact.
                                    </div>
                                </div>
                                
                                <p className='text-2xl font-semibold'>89</p>
                            </div>
                        </div>
                    </div>

                    <div className='bg-white w-full h-max py-4 pl-6 rounded-lg mb-5 flex items-center justify-between border border-[#D9D9D9]'>
                        <div>
                            <div className='flex gap-3 items-end mb-1'>
                                <p className='font-bold text-xl'>Linh Cao</p>
                                <img src={Dot} alt='Dot' className='w-2 h-2 self-center' />
                                <p className='text-[#6A6A6A] text-md'>RMIT University</p>
                            </div>

                            <div className='flex-col justify-center'>
                                <img src={letterH} alt='Letter H' className='w-4 h-4 inline-block mr-3 opacity-70'/>
                                <span className='text-sm text-[#6A6A6A]'>h-index: 12</span>
                                <br />
                                <img src={scholarHat} alt='Scholar Hat' className='w-4 h-4 inline-block mr-3' />
                                <span className='text-sm text-[#6A6A6A]'>i10-index: 8</span>
                            </div>

                            <div className='w-max py-1 px-8 rounded-full font-semibold bg-[#4D8BC5] text-white text-sm mt-3'>Aviation</div>
                        </div>
                        
                        <div className='w-1/3 h-full flex items-start justify-center border-l-1 border-[#E5E5E5]'>
                            <div className='h-20 w-20 rounded-full border border-[#9F9F9F] flex flex-col items-center justify-center'>
                                <div className='flex relative group'>
                                    <p className='text-xs text-[#6A6A6A]'>Score</p>
                                    <img src={infoIcon} alt='Info' className='w-3 h-3 mb-1 cursor-pointer' aria-describedby="scoreTooltip"/>
                                    <div role='tooltip' id='scoreTooltip' className='absolute left-6 top-0 z-10 bg-white border border-gray-300 p-2 rounded shadow-md text-xs text-gray-700 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200'
>
                                        The score is calculated based on the h-index and i10-index, reflecting the academic's research impact.
                                    </div>
                                </div>
                                
                                <p className='text-2xl font-semibold'>89</p>
                            </div>
                        </div>
                    </div>

                    <div className='bg-white w-full h-max py-4 pl-6 rounded-lg mb-5 flex items-center justify-between border border-[#D9D9D9]'>
                        <div>
                            <div className='flex gap-3 items-end mb-1'>
                                <p className='font-bold text-xl'>Cuong Nguyen</p>
                                <img src={Dot} alt='Dot' className='w-2 h-2 self-center' />
                                <p className='text-[#6A6A6A] text-md'>RMIT University</p>
                            </div>

                            <div className='flex-col justify-center'>
                                <img src={letterH} alt='Letter H' className='w-4 h-4 inline-block mr-3 opacity-70'/>
                                <span className='text-sm text-[#6A6A6A]'>h-index: 12</span>
                                <br />
                                <img src={scholarHat} alt='Scholar Hat' className='w-4 h-4 inline-block mr-3' />
                                <span className='text-sm text-[#6A6A6A]'>i10-index: 8</span>
                            </div>

                            <div className='w-max py-1 px-8 rounded-full font-semibold bg-[#4D8BC5] text-white text-sm mt-3'>Aviation</div>
                        </div>
                        
                        <div className='w-1/3 h-full flex items-start justify-center border-l-1 border-[#E5E5E5]'>
                            <div className='h-20 w-20 rounded-full border border-[#9F9F9F] flex flex-col items-center justify-center'>
                                <div className='flex relative group'>
                                    <p className='text-xs text-[#6A6A6A]'>Score</p>
                                    <img src={infoIcon} alt='Info' className='w-3 h-3 mb-1 cursor-pointer' aria-describedby="scoreTooltip"/>
                                    <div role='tooltip' id='scoreTooltip' className='absolute left-6 top-0 z-10 bg-white border border-gray-300 p-2 rounded shadow-md text-xs text-gray-700 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200'
>
                                        The score is calculated based on the h-index and i10-index, reflecting the academic's research impact.
                                    </div>
                                </div>
                                
                                <p className='text-2xl font-semibold'>89</p>
                            </div>
                        </div>
                    </div>

                    <div className='bg-white w-full h-max py-4 pl-6 rounded-lg mb-5 flex items-center justify-between border border-[#D9D9D9]'>
                        <div>
                            <div className='flex gap-3 items-end mb-1'>
                                <p className='font-bold text-xl text-[#000054]'>Kim Cheoul</p>
                                <img src={Dot} alt='Dot' className='w-2 h-2 self-center' />
                                <p className='text-[#6A6A6A] text-md'>RMIT University</p>
                            </div>

                            <div className='flex-col justify-center'>
                                <img src={letterH} alt='Letter H' className='w-4 h-4 inline-block mr-3 opacity-70'/>
                                <span className='text-sm text-[#6A6A6A]'>h-index: 12</span>
                                <br />
                                <img src={scholarHat} alt='Scholar Hat' className='w-4 h-4 inline-block mr-3' />
                                <span className='text-sm text-[#6A6A6A]'>i10-index: 8</span>
                            </div>

                            <div className='w-max py-1 px-8 rounded-full font-semibold bg-[#4D8BC5] text-white text-sm mt-3'>Aviation</div>
                        </div>
                        
                        <div className='w-1/3 h-full flex items-start justify-center border-l-1 border-[#E5E5E5]'>
                            <div className='h-20 w-20 rounded-full border border-[#9F9F9F] flex flex-col items-center justify-center'>
                                <div className='flex relative group'>
                                    <p className='text-xs text-[#6A6A6A]'>Score</p>
                                    <img src={infoIcon} alt='Info' className='w-3 h-3 mb-1 cursor-pointer' aria-describedby="scoreTooltip"/>
                                    <div role='tooltip' id='scoreTooltip' className='absolute left-6 top-0 z-10 bg-white border border-gray-300 p-2 rounded shadow-md text-xs text-gray-700 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200'
>
                                        The score is calculated based on the h-index and i10-index, reflecting the academic's research impact.
                                    </div>
                                </div>
                                
                                <p className='text-2xl font-semibold'>89</p>
                            </div>
                        </div>
                    </div>

                    <div className='bg-white w-full h-max py-4 pl-6 rounded-lg mb-5 flex items-center justify-between border border-[#D9D9D9]'>
                        <div>
                            <div className='flex gap-3 items-end mb-1'>
                                <p className='font-bold text-xl text-[#000054]'>Minh Tran</p>
                                <img src={Dot} alt='Dot' className='w-2 h-2 self-center' />
                                <p className='text-[#6A6A6A] text-md'>RMIT University</p>
                            </div>

                            <div className='flex-col justify-center'>
                                <img src={letterH} alt='Letter H' className='w-4 h-4 inline-block mr-3 opacity-70'/>
                                <span className='text-sm text-[#6A6A6A]'>h-index: 12</span>
                                <br />
                                <img src={scholarHat} alt='Scholar Hat' className='w-4 h-4 inline-block mr-3' />
                                <span className='text-sm text-[#6A6A6A]'>i10-index: 8</span>
                            </div>

                            <div className='w-max py-1 px-8 rounded-full font-semibold bg-[#4D8BC5] text-white text-sm mt-3'>Aviation</div>
                        </div>
                        
                        <div className='w-1/3 h-full flex items-start justify-center border-l-1 border-[#E5E5E5]'>
                            <div className='h-20 w-20 rounded-full border border-[#9F9F9F] flex flex-col items-center justify-center'>
                                <div className='flex relative group'>
                                    <p className='text-xs text-[#6A6A6A]'>Score</p>
                                    <img src={infoIcon} alt='Info' className='w-3 h-3 mb-1 cursor-pointer' aria-describedby="scoreTooltip"/>
                                    <div role='tooltip' id='scoreTooltip' className='absolute left-6 top-0 z-10 bg-white border border-gray-300 p-2 rounded shadow-md text-xs text-gray-700 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200'
>
                                        The score is calculated based on the h-index and i10-index, reflecting the academic's research impact.
                                    </div>
                                </div>
                                
                                <p className='text-2xl font-semibold'>89</p>
                            </div>
                        </div>
                    </div>

                    <div className='bg-white w-full h-max py-4 pl-6 rounded-lg mb-5 flex items-center justify-between border border-[#D9D9D9]'>
                        <div>
                            <div className='flex gap-3 items-end mb-1'>
                                <p className='font-bold text-xl'>Cuong Nguyen</p>
                                <img src={Dot} alt='Dot' className='w-2 h-2 self-center' />
                                <p className='text-[#6A6A6A] text-md'>RMIT University</p>
                            </div>

                            <div className='flex-col justify-center'>
                                <img src={letterH} alt='Letter H' className='w-4 h-4 inline-block mr-3 opacity-70'/>
                                <span className='text-sm text-[#6A6A6A]'>h-index: 12</span>
                                <br />
                                <img src={scholarHat} alt='Scholar Hat' className='w-4 h-4 inline-block mr-3' />
                                <span className='text-sm text-[#6A6A6A]'>i10-index: 8</span>
                            </div>

                            <div className='w-max py-1 px-8 rounded-full font-semibold bg-[#4D8BC5] text-white text-sm mt-3'>Aviation</div>
                        </div>
                        
                        <div className='w-1/3 h-full flex items-start justify-center border-l-1 border-[#E5E5E5]'>
                            <div className='h-20 w-20 rounded-full border border-[#9F9F9F] flex flex-col items-center justify-center'>
                                <div className='flex relative group'>
                                    <p className='text-xs text-[#6A6A6A]'>Score</p>
                                    <img src={infoIcon} alt='Info' className='w-3 h-3 mb-1 cursor-pointer' aria-describedby="scoreTooltip"/>
                                    <div role='tooltip' id='scoreTooltip' className='absolute left-6 top-0 z-10 bg-white border border-gray-300 p-2 rounded shadow-md text-xs text-gray-700 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200'
>
                                        The score is calculated based on the h-index and i10-index, reflecting the academic's research impact.
                                    </div>
                                </div>
                                
                                <p className='text-2xl font-semibold'>89</p>
                            </div>
                        </div>
                    </div>

                    <div className='bg-white w-full h-max py-4 pl-6 rounded-lg mb-5 flex items-center justify-between border border-[#D9D9D9]'>
                        <div>
                            <div className='flex gap-3 items-end mb-1'>
                                <p className='font-bold text-xl text-[#000054]'>Kim Cheoul</p>
                                <img src={Dot} alt='Dot' className='w-2 h-2 self-center' />
                                <p className='text-[#6A6A6A] text-md'>RMIT University</p>
                            </div>

                            <div className='flex-col justify-center'>
                                <img src={letterH} alt='Letter H' className='w-4 h-4 inline-block mr-3 opacity-70'/>
                                <span className='text-sm text-[#6A6A6A]'>h-index: 12</span>
                                <br />
                                <img src={scholarHat} alt='Scholar Hat' className='w-4 h-4 inline-block mr-3' />
                                <span className='text-sm text-[#6A6A6A]'>i10-index: 8</span>
                            </div>

                            <div className='w-max py-1 px-8 rounded-full font-semibold bg-[#4D8BC5] text-white text-sm mt-3'>Aviation</div>
                        </div>
                        
                        <div className='w-1/3 h-full flex items-start justify-center border-l-1 border-[#E5E5E5]'>
                            <div className='h-20 w-20 rounded-full border border-[#9F9F9F] flex flex-col items-center justify-center'>
                                <div className='flex relative group'>
                                    <p className='text-xs text-[#6A6A6A]'>Score</p>
                                    <img src={infoIcon} alt='Info' className='w-3 h-3 mb-1 cursor-pointer' aria-describedby="scoreTooltip"/>
                                    <div role='tooltip' id='scoreTooltip' className='absolute left-6 top-0 z-10 bg-white border border-gray-300 p-2 rounded shadow-md text-xs text-gray-700 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200'
>
                                        The score is calculated based on the h-index and i10-index, reflecting the academic's research impact.
                                    </div>
                                </div>
                                
                                <p className='text-2xl font-semibold'>89</p>
                            </div>
                        </div>
                    </div>

                    <div className='bg-white w-full h-max py-4 pl-6 rounded-lg mb-5 flex items-center justify-between border border-[#D9D9D9]'>
                        <div>
                            <div className='flex gap-3 items-end mb-1'>
                                <p className='font-bold text-xl text-[#000054]'>Minh Tran</p>
                                <img src={Dot} alt='Dot' className='w-2 h-2 self-center' />
                                <p className='text-[#6A6A6A] text-md'>RMIT University</p>
                            </div>

                            <div className='flex-col justify-center'>
                                <img src={letterH} alt='Letter H' className='w-4 h-4 inline-block mr-3 opacity-70'/>
                                <span className='text-sm text-[#6A6A6A]'>h-index: 12</span>
                                <br />
                                <img src={scholarHat} alt='Scholar Hat' className='w-4 h-4 inline-block mr-3' />
                                <span className='text-sm text-[#6A6A6A]'>i10-index: 8</span>
                            </div>

                            <div className='w-max py-1 px-8 rounded-full font-semibold bg-[#4D8BC5] text-white text-sm mt-3'>Aviation</div>
                        </div>
                        
                        <div className='w-1/3 h-full flex items-start justify-center border-l-1 border-[#E5E5E5]'>
                            <div className='h-20 w-20 rounded-full border border-[#9F9F9F] flex flex-col items-center justify-center'>
                                <div className='flex relative group'>
                                    <p className='text-xs text-[#6A6A6A]'>Score</p>
                                    <img src={infoIcon} alt='Info' className='w-3 h-3 mb-1 cursor-pointer' aria-describedby="scoreTooltip"/>
                                    <div role='tooltip' id='scoreTooltip' className='absolute left-6 top-0 z-10 bg-white border border-gray-300 p-2 rounded shadow-md text-xs text-gray-700 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200'
>
                                        The score is calculated based on the h-index and i10-index, reflecting the academic's research impact.
                                    </div>
                                </div>
                                
                                <p className='text-2xl font-semibold'>89</p>
                            </div>
                        </div>
                    </div>
                    

                    {/* Max results per page */}
                    <div className='w-full flex justify-between items-center mb-10'>
                        {/* showing results 1-10 of 199 */}
                        <p className='text-sm text-[#6A6A6A]'>Showing results <b>1-10</b> of <b>199</b></p>
                        <div className='flex items-center gap-2'>
                            <label htmlFor='resultsPerPage' className='text-sm text-[#6A6A6A]'>Results per page:</label>
                            <select name="resultsPerPage" id="resultsPerPage" className='border border-gray-300 bg-white rounded-lg py-1 px-2'>
                                <option value="10">10</option>
                                <option value="20">20</option>
                                <option value="50">50</option>
                            </select>
                        </div>
                        
                    </div>
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

        <Footer />
    </div>
  );
}
export default SearchInterface;
