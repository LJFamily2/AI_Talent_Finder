import React from 'react';
import Header from '../components/Header';
import heroIcon from '../assets/hero-icon-search-tool.png'; // Adjust the path as necessary

function SearchInterface() {
  return (
    <div>
        <Header />
        {/* Hero section */}
        <div className="w-screen h-110 bg-[#9F9F9F] flex items-center justify-center">
            <div className='max-w-2/3 w-3/5 h-full flex items-center justify-between'>
                <div>
                    <p className="text-white text-5xl">Find the perfect<br></br> candidate in no time</p>
                    <button className="mt-10 px-10 py-3 bg-[#FFF2D3] font-semibold rounded-full hover:bg-[#FAC800] hover:shadow-lg transition duration-300">
                        Search for Candidates
                    </button>
                </div>
                <img src={heroIcon} className="h-1/2" />
            </div>
        </div>

        {/* Search criteria section */}
        <div className='w-screen h-20 bg-[#E5E5E5] outline-1 flex items-center justify-around pl-10 pr-5'>
            <span className='text-lg'>Try search by Field:</span>
            <div className='flex items-center justify-between xl:w-2/3 lg:w-2/3 h-full'>
                <div className='flex-1 flex items-center justify-center hover:bg-[#D9D9D9] px-6 h-full'>
                    <a href='#' className='text-xl font-semibold hover:underline'>Literature</a>
                </div>
                <div className='flex-1 flex items-center justify-center hover:bg-[#D9D9D9] px-6 h-full'>
                    <a href='#' className='text-xl font-semibold hover:underline'>Economics</a>
                </div>
                <div className='flex-1 flex items-center justify-center hover:bg-[#D9D9D9] px-6 h-full'>
                    <a href='#' className='text-xl font-semibold hover:underline'>Microbiology</a>
                </div>
                <div className='flex-2 flex items-center justify-center hover:bg-[#D9D9D9] px-4 h-full'>
                    <a href='#' className='text-xl font-semibold hover:underline'>Electrical Engineering</a>
                </div>
            </div>
        </div>
    </div>
  );
}
export default SearchInterface;
