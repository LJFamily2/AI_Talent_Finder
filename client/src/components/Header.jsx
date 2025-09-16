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
    <header className="bg-[#000054] h-18">
        <nav className="mx-auto flex max-w-7xl" aria-label="Global">
            <div className="flex items-center justify-between w-full overflow-hidden">
                {/* Logo and website name */}
                <div className="flex items-center">
                    <div className='bg-[#E60028] h-21 absolute top-0 py-3 px-4 flex items-center justify-center mr-6'>
                        <a href="/landing-page">
                            <img className="h-8 w-auto" src={logo} alt=""/>
                        </a>
                    </div>
                    {/* Space divider - decoration purpose only */}
                    <div className="w-37 h-18"></div>
                    <a href="/landing-page">
                        <p className='text-lg text-white font-bold'>Talent Finder</p>
                    </a>
                </div>
                {/* Navigation links */}
                <div className="flex items-center w-max h-18 justify-end text-lg relative z-50">
                    <div className={`flex items-center justify-center px-8 h-full ${path === '/verify-cv' ? 'bg-white' : 'hover:bg-[#000032]'}`}>
                        <a href="/verify-cv">
                            <p className={`font-medium hover:underline ${path === '/verify-cv' ? 'text-[#000054] font-semibold underline' : 'text-white'}`}>CV Verification</p>
                        </a>
                    </div>
                    <div className={`flex items-center justify-center px-8 h-full ${path === '/search-tool' ? 'bg-white' : 'hover:bg-[#000032]'}`}>
                        <a href="/search-tool">
                            <p className={`font-medium hover:underline ${path === '/search-tool' ? 'text-[#000054] font-semibold underline' : 'text-white'}`}>Search Tool</p>
                        </a>
                    </div>
                    <div className={`flex items-center justify-center px-8 h-full ${path === '/saved-researchers' ? 'bg-white' : 'hover:bg-[#000032]'}`}>
                        <a href="/saved-researchers">
                            <p className={`font-medium hover:underline ${path === '/saved-researchers' ? 'text-[#000054] font-semibold underline' : 'text-white'}`}>Saved Profiles</p>
                        </a>
                    </div>
                    {user && (
                    <div className="ml-7">
                      <button
                        className="w-10 h-10 rounded-full bg-white text-[#000054] flex items-center justify-center text-md font-normal shadow-lg hover:bg-gray-200 focus:outline-none"
                        onClick={() => setShowDropdown((v) => !v)}
                        aria-label="User menu"
                      >
                        {userInitial}
                      </button>
                      {showDropdown && (
                        <div className="fixed right-0 mt-4 w-50 bg-white shadow-lg shadow-gray-400 pt-3 border border-gray-200 flex flex-col items-start">
                          <span className="w-full text-black text-lg mx-4">{user?.name || "User"}</span>
                          <span className="w-full mb-1 text-[#6A6A6A] text-sm px-4 wrap-anywhere">{user?.email || "Email address"}</span>
                          <hr className="w-full border-t border-gray-300 mt-2 mx-1" />
                          <div className='w-full flex px-4 py-3 items-center hover:bg-gray-200'>
                            <img src={logOutIcon} alt="Log Out" className="w-3 h-3"/>
                          <button
                            className="bg-transparent text-black  text-md hover:underline font-regular ml-2"
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
