import React, { useEffect, useState } from 'react';
import logo from '../assets/rmit-logo-white.svg';
import { useAuth } from '../context/AuthContext';
import logOutIcon from '../assets/log-out.png';

function Header() {
  const path = window.location.pathname;
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    let title = "Talent Finder";
    if (path === "/verify-cv") title = "CV Verification";
    else if (path === "/search-tool") title = "Search Tool";
    else if (path === "/saved-researchers") title = "Saved Profiles";
    else if (path === "/landing-page") title = "Talent Finder";
    document.title = title;
  }, [path]);

// Get first name of user (fallback to 'User')
const userInitial = user?.name ? user.name.split(' ')[0] : "User";

  return (
    <header className="bg-[#000054] h-auto md:h-18">
        <nav className="mx-auto flex flex-col md:flex-row max-w-7xl w-full px-4 md:px-0" aria-label="Global">
            <div className="flex flex-col md:flex-row items-center justify-between w-full overflow-hidden">
                {/* Logo and website name */}
                <div className="flex items-center w-full md:w-auto mb-2 md:mb-0">
                    <div className='bg-[#E60028] h-16 md:h-21 py-2 md:py-3 px-3 md:px-4 flex items-center justify-center mr-2 md:mr-4'>
                        <a href="/landing-page">
                            <img className="h-7 md:h-8 w-auto" src={logo} alt=""/>
                        </a>
                    </div>
                    <a href="/landing-page" className="ml-2">
                        <p className='text-base md:text-lg text-white font-bold'>Talent Finder</p>
                    </a>
                </div>
                {/* Navigation links */}
                <div className="flex flex-col md:flex-row items-center w-full md:w-max h-auto md:h-18 justify-end text-base md:text-lg relative z-50">
                    <div className={`flex items-center justify-center px-4 md:px-8 h-12 md:h-full ${path === '/verify-cv' ? 'bg-white' : 'hover:bg-[#000032]'}`}> 
                        <a href="/verify-cv">
                            <p className={`font-medium hover:underline ${path === '/verify-cv' ? 'text-[#000054] font-semibold underline' : 'text-white'}`}>CV Verification</p>
                        </a>
                    </div>
                    <div className={`flex items-center justify-center px-4 md:px-8 h-12 md:h-full ${path === '/search-tool' ? 'bg-white' : 'hover:bg-[#000032]'}`}> 
                        <a href="/search-tool">
                            <p className={`font-medium hover:underline ${path === '/search-tool' ? 'text-[#000054] font-semibold underline' : 'text-white'}`}>Search Tool</p>
                        </a>
                    </div>
                    <div className={`flex items-center justify-center px-4 md:px-8 h-12 md:h-full ${path === '/saved-researchers' ? 'bg-white' : 'hover:bg-[#000032]'}`}> 
                        <a href="/saved-researchers">
                            <p className={`font-medium hover:underline ${path === '/saved-researchers' ? 'text-[#000054] font-semibold underline' : 'text-white'}`}>Saved Profiles</p>
                        </a>
                    </div>
                    {user && (
                    <div className="ml-0 md:ml-7 mt-2 md:mt-0">
                      <button
                        className="w-9 md:w-10 h-9 md:h-10 rounded-full bg-white text-[#000054] flex items-center justify-center text-md font-normal shadow-lg hover:bg-gray-200 focus:outline-none"
                        onClick={() => setShowDropdown((v) => !v)}
                        aria-label="User menu"
                      >
                        {userInitial}
                      </button>
                      {showDropdown && (
                        <div className="fixed right-2 md:right-0 mt-4 w-44 md:w-50 bg-white shadow-lg shadow-gray-400 pt-3 border border-gray-200 flex flex-col items-start">
                          <span className="w-full text-black text-base md:text-lg mx-4">{user?.name || "User"}</span>
                          <span className="w-full mb-1 text-[#6A6A6A] text-xs md:text-sm px-4 wrap-anywhere">{user?.email || "Email address"}</span>
                          <hr className="w-full border-t border-gray-300 mt-2 mx-1" />
                          <div className='w-full flex px-4 py-3 items-center hover:bg-gray-200'>
                            <img src={logOutIcon} alt="Log Out" className="w-3 h-3"/>
                          <button
                            className="bg-transparent text-black text-sm md:text-md hover:underline font-regular ml-2"
                            onClick={logout}
                          >
                            Sign out
                          </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
            </div>
        </nav>
    </header>
  );
}   

export default Header;
