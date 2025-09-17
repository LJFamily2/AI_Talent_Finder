import React, { useEffect, useState, useRef } from 'react';
import logo from '../assets/rmit-logo-white.svg';
import { useAuth } from '../context/AuthContext';
import logOutIcon from '../assets/log-out.png';
import { Snackbar, Alert } from '@mui/material';

function Header() {
  const path = window.location.pathname;
  const { user, loading, logout } = useAuth();
  const hadSession = (() => { try { return localStorage.getItem('hasSession') === '1'; } catch { return false; } })();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const menuRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  useEffect(() => {
    let title = "Talent Finder";
    if (path === "/publication-check") title = "Publication Check";
    else if (path === "/publication-check/results") title = "Publication Check Results";
    else if (path === "/search") title = "Search";
    else if (path.startsWith("/search/advanced")) title = "Advanced Search";
    else if (path === "/saved-researchers") title = "Saved Profiles";
    else if (path === "/login") title = "Login";
    else if (path === "/landing-page") title = "Talent Finder";
    document.title = title;
  }, [path]);

  // Close user menu on route change
  useEffect(() => {
    setShowDropdown(false);
    setShowMobileMenu(false);
  }, [path]);

  // Close when clicking outside the menu/avatar
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)
      ) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  // Show welcome toast after login if set
  useEffect(() => {
    try {
      const name = sessionStorage.getItem('loginWelcomeName');
      if (name) {
        setToastMsg(`Welcome, ${name}!`);
        setToastOpen(true);
        sessionStorage.removeItem('loginWelcomeName');
      }
    } catch { }
  }, []);

  const handleLoginClick = () => {
    try {
      const target = window.location.pathname + window.location.search + window.location.hash;
      sessionStorage.setItem("postLoginRedirect", target);
    } catch { }
    window.location.href = "/login";
  };

  const handleLogoutClick = async () => {
    try {
      await logout();
      setShowDropdown(false);
      setToastMsg('Successfully logged out');
      setToastOpen(true);
    } catch { }
  };

  // Show only first initial of user's name (fallback to 'U')
  const userInitial = (() => {
    const n = (user?.name || '').trim();
    if (n.length > 0) return n.charAt(0).toUpperCase();
    const e = (user?.email || '').trim();
    if (e.length > 0) return e.charAt(0).toUpperCase();
    return 'U';
  })();

  return (
    <header className="bg-[#000054] h-18 relative overflow-visible">
      <nav className="mx-auto flex flex-col md:flex-row w-full md:max-w-7xl h-full px-0 md:px-0 relative" aria-label="Global">
        <div className="flex flex-col md:flex-row items-center justify-between w-full h-full overflow-visible relative px-4 md:px-0">
          {/* Logo and website name */}
          <div className="flex items-center justify-between w-full md:w-auto mb-0 md:mb-0 h-full md:h-full">
            <div className="flex items-center h-full">
              <div className='bg-[#E60028] h-18 py-2 md:py-3 px-3 md:px-4 flex items-center justify-center mr-2 md:mr-4'>
                <a href="/landing-page">
                  <img className="h-7 md:h-8 w-auto" src={logo} alt="" />
                </a>
              </div>
              <a href="/landing-page" className="ml-2">
                <p className='text-base md:text-lg text-white font-bold'>Talent Finder</p>
              </a>
            </div>
            <div className="flex items-center md:hidden">
              {/* User profile button - Mobile only, positioned next to hamburger */}
              <div className="relative mr-3 z-50" ref={mobileMenuRef}>
                <button
                  className={`w-9 h-9 rounded-full bg-white text-[#000054] flex items-center justify-center text-md font-normal shadow-lg focus:outline-none ${user ? 'hover:bg-gray-200' : 'invisible pointer-events-none'}`}
                  onClick={() => user && setShowDropdown((v) => !v)}
                  aria-label="User menu"
                >
                  {userInitial}
                </button>
                {user && showDropdown && (
                  <div className="absolute right-0 top-full mt-6 w-44 bg-white shadow-lg shadow-gray-400 pt-3 border border-gray-200 flex flex-col items-start z-[9999]">
                    <span className="w-full text-black text-base px-4">{user?.name || "User"}</span>
                    <span className="w-full mb-1 text-[#6A6A6A] text-xs px-4 break-words">{user?.email || "Email address"}</span>
                    <hr className="w-full border-t border-gray-300 mt-2" />
                    <div className='w-full flex px-4 py-3 items-center hover:bg-gray-200 cursor-pointer'>
                      <img src={logOutIcon} alt="Log Out" className="w-3 h-3" />
                      <button
                        className="bg-transparent text-black text-sm hover:underline font-regular ml-2"
                        onClick={handleLogoutClick}
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {/* Mobile menu toggle button */}
              <button
                className="flex flex-col items-center justify-center w-8 h-8 relative focus:outline-none"
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                aria-label="Toggle mobile menu"
              >
                <span className={`block w-6 h-0.5 bg-white transition-all duration-300 ease-in-out absolute ${showMobileMenu ? 'rotate-45' : '-translate-y-1.5'}`}></span>
                <span className={`block w-6 h-0.5 bg-white transition-all duration-300 ease-in-out ${showMobileMenu ? 'opacity-0' : 'opacity-100'}`}></span>
                <span className={`block w-6 h-0.5 bg-white transition-all duration-300 ease-in-out absolute ${showMobileMenu ? '-rotate-45' : 'translate-y-1.5'}`}></span>
              </button>
            </div>
          </div>

          {/* Navigation links */}
          <div className={`md:flex md:flex-row md:items-center md:w-max md:h-full md:justify-end text-base md:text-lg md:relative ${showMobileMenu ? 'flex flex-col absolute top-full left-0 right-0 w-full bg-[#000054] shadow-lg border-t border-gray-600 z-[9998] min-h-max' : 'hidden md:flex'}`}>
                    <div className={`flex items-center justify-center px-0 md:px-8 h-12 md:h-full w-full md:w-auto ${path === '/publication-check' ? 'bg-white' : 'hover:bg-[#000032]'}`}>
                        <a href="/publication-check" className="w-full md:w-auto text-center py-3 md:py-0">
                            <p className={`font-medium hover:underline ${path === '/publication-check' ? 'text-[#000054] font-semibold underline' : 'text-white'}`}>Publication Check</p>
                        </a>
                    </div>
            <div className={`flex items-center justify-center px-0 md:px-8 h-12 md:h-full w-full md:w-auto ${path.startsWith('/search') ? 'bg-white' : 'hover:bg-[#000032]'}`}>
              <a href="/search" className="w-full md:w-auto text-center py-3 md:py-0">
                <p className={`font-medium hover:underline ${path.startsWith('/search') ? 'text-[#000054] font-semibold underline' : 'text-white'}`}>Search Tool</p>
              </a>
            </div>
            {loading && hadSession ? (
              // Reserve space to avoid flicker when restoring session
              <div
                className={`flex items-center justify-center px-0 md:px-8 h-12 md:h-full w-full md:w-auto ${path === '/saved-researchers' ? 'bg-white' : ''}`}
                aria-hidden
              >
                <span className={`${path === '/saved-researchers' ? 'text-[#000054]' : 'text-white'} opacity-0 py-3 md:py-0`}>Saved Profiles</span>
              </div>
            ) : user ? (
              <div
                className={`flex items-center justify-center px-0 md:px-8 h-12 md:h-full w-full md:w-auto ${path === '/saved-researchers' ? 'bg-white' : 'hover:bg-[#000032]'}`}
                title="View your saved profiles"
              >
                <a href="/saved-researchers" aria-label="Saved Profiles" className="w-full md:w-auto text-center py-3 md:py-0">
                  <p className={`font-medium hover:underline ${path === '/saved-researchers' ? 'text-[#000054] font-semibold underline' : 'text-white'}`}>Saved Profiles</p>
                </a>
              </div>
            ) : (
              <div
                className={`flex items-center justify-center px-0 md:px-8 h-12 md:h-full w-full md:w-auto ${path === '/login' ? 'bg-white' : 'hover:bg-[#000032]'}`}
                title="Log in to access Saved Profiles"
              >
                <button
                  onClick={handleLoginClick}
                  className={`font-medium hover:underline py-3 md:py-2 w-full md:w-auto ${path === '/login' ? 'text-[#000054] font-semibold underline' : 'text-white'}`}
                  aria-label="Login"
                >
                  Login
                </button>
              </div>
            )}
            {/* Desktop user profile button */}
            <div className="hidden md:flex ml-0 md:ml-3 mr-5 relative mt-4 md:mt-0 mb-4 md:mb-0 w-full md:w-auto justify-center md:justify-end z-50" ref={menuRef}>
              <button
                className={`w-9 md:w-10 h-9 md:h-10 rounded-full bg-white text-[#000054] flex items-center justify-center text-md font-normal shadow-lg focus:outline-none ${user ? 'hover:bg-gray-200' : 'invisible pointer-events-none'}`}
                onClick={() => user && setShowDropdown((v) => !v)}
                aria-label="User menu"
              >
                {userInitial}
              </button>
              {user && showDropdown && (
                <div className="absolute right-2 md:right-0 top-full mt-2 w-44 md:w-50 bg-white shadow-lg shadow-gray-400 pt-3 border border-gray-200 flex flex-col items-start z-[9999]">
                  <span className="w-full text-black text-base md:text-lg px-4">{user?.name || "User"}</span>
                  <span className="w-full mb-1 text-[#6A6A6A] text-xs md:text-sm px-4 break-words">{user?.email || "Email address"}</span>
                  <hr className="w-full border-t border-gray-300 mt-2" />
                  <div className='w-full flex px-4 py-3 items-center hover:bg-gray-200 cursor-pointer'>
                    <img src={logOutIcon} alt="Log Out" className="w-3 h-3" />
                    <button
                      className="bg-transparent text-black text-sm md:text-md hover:underline font-regular ml-2"
                      onClick={handleLogoutClick}
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
      <Snackbar
        open={toastOpen}
        autoHideDuration={2500}
        onClose={() => setToastOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setToastOpen(false)} sx={{ width: '100%' }}>
          {toastMsg}
        </Alert>
      </Snackbar>
    </header>
  );
}

export default Header;
