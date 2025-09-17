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
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  useEffect(() => {
    let title = "Talent Finder";
    if (path === "/verify-cv") title = "CV Verification";
    else if (path === "/verify-cv/results") title = "CV Verification Results";
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
      if (menuRef.current && !menuRef.current.contains(e.target)) {
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
    } catch {}
  }, []);

  const handleLoginClick = () => {
    try {
      const target = window.location.pathname + window.location.search + window.location.hash;
      sessionStorage.setItem("postLoginRedirect", target);
    } catch {}
    window.location.href = "/login";
  };

  const handleLogoutClick = async () => {
    try {
      await logout();
      setShowDropdown(false);
      setToastMsg('Successfully logged out');
      setToastOpen(true);
    } catch {}
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
    <header className="bg-[#000054] h-auto md:h-18">
        <nav className="mx-auto flex flex-col md:flex-row max-w-7xl w-full px-4 md:px-0" aria-label="Global">
            <div className="flex flex-col md:flex-row items-center justify-between w-full overflow-hidden">
                {/* Logo and website name */}
                <div className="flex items-center justify-between w-full md:w-auto mb-2 md:mb-0">
                    <div className="flex items-center">
                        <div className='bg-[#E60028] h-16 md:h-21 py-2 md:py-3 px-3 md:px-4 flex items-center justify-center mr-2 md:mr-4'>
                            <a href="/landing-page">
                                <img className="h-7 md:h-8 w-auto" src={logo} alt=""/>
                            </a>
                        </div>
                        <a href="/landing-page" className="ml-2">
                            <p className='text-base md:text-lg text-white font-bold'>Talent Finder</p>
                        </a>
                    </div>
                    {/* Mobile menu toggle button */}
                    <button
                        className="md:hidden flex flex-col items-center justify-center w-8 h-8 space-y-1 focus:outline-none"
                        onClick={() => setShowMobileMenu(!showMobileMenu)}
                        aria-label="Toggle mobile menu"
                    >
                        <span className={`block w-6 h-0.5 bg-white transition-transform duration-200 ${showMobileMenu ? 'rotate-45 translate-y-2' : ''}`}></span>
                        <span className={`block w-6 h-0.5 bg-white transition-opacity duration-200 ${showMobileMenu ? 'opacity-0' : ''}`}></span>
                        <span className={`block w-6 h-0.5 bg-white transition-transform duration-200 ${showMobileMenu ? '-rotate-45 -translate-y-2' : ''}`}></span>
                    </button>
                </div>
                {/* Navigation links */}
                <div className={`flex-col md:flex-row items-center w-full md:w-max h-auto md:h-18 justify-end text-base md:text-lg relative z-50 ${showMobileMenu ? 'flex' : 'hidden md:flex'}`}>
                    <div className={`flex items-center justify-center px-4 md:px-8 h-12 md:h-full w-full md:w-auto ${path === '/verify-cv' ? 'bg-white' : 'hover:bg-[#000032]'}`}> 
                        <a href="/verify-cv" className="w-full md:w-auto text-center">
                            <p className={`font-medium hover:underline ${path === '/verify-cv' ? 'text-[#000054] font-semibold underline' : 'text-white'}`}>CV Verification</p>
                        </a>
                    </div>
                    <div className={`flex items-center justify-center px-4 md:px-8 h-12 md:h-full w-full md:w-auto ${path.startsWith('/search') ? 'bg-white' : 'hover:bg-[#000032]'}`}> 
                        <a href="/search" className="w-full md:w-auto text-center">
                            <p className={`font-medium hover:underline ${path.startsWith('/search') ? 'text-[#000054] font-semibold underline' : 'text-white'}`}>Search Tool</p>
                        </a>
                    </div>
                    {loading && hadSession ? (
                      // Reserve space to avoid flicker when restoring session
                      <div
                        className={`flex items-center justify-center px-4 md:px-8 h-12 md:h-full w-full md:w-auto ${path === '/saved-researchers' ? 'bg-white' : ''}`}
                        aria-hidden
                      >
                        <span className={`${path === '/saved-researchers' ? 'text-[#000054]' : 'text-white'} opacity-0`}>Saved Profiles</span>
                      </div>
                    ) : user ? (
                      <div
                        className={`flex items-center justify-center px-4 md:px-8 h-12 md:h-full w-full md:w-auto ${path === '/saved-researchers' ? 'bg-white' : 'hover:bg-[#000032]'}`}
                        title="View your saved profiles"
                      >
                          <a href="/saved-researchers" aria-label="Saved Profiles" className="w-full md:w-auto text-center">
                              <p className={`font-medium hover:underline ${path === '/saved-researchers' ? 'text-[#000054] font-semibold underline' : 'text-white'}`}>Saved Profiles</p>
                          </a>
                      </div>
                    ) : (
                      <div
                        className={`flex items-center justify-center px-4 md:px-8 h-12 md:h-full w-full md:w-auto ${path === '/login' ? 'bg-white' : 'hover:bg-[#000032]'}`}
                        title="Log in to access Saved Profiles"
                      >
                          <button
                            onClick={handleLoginClick}
                            className={`font-medium hover:underline py-2 w-full md:w-auto ${path === '/login' ? 'text-[#000054] font-semibold underline' : 'text-white'}`}
                            aria-label="Login"
                          >
                            Login
                          </button>
                      </div>
                    )}
                    <div className="ml-0 md:ml-7 relative mt-4 md:mt-0 w-full md:w-auto flex justify-center md:justify-end" ref={menuRef}>
                      <button
                        className={`w-9 md:w-10 h-9 md:h-10 rounded-full bg-white text-[#000054] flex items-center justify-center text-md font-normal shadow-lg focus:outline-none ${user ? 'hover:bg-gray-200' : 'invisible pointer-events-none'}`}
                        onClick={() => user && setShowDropdown((v) => !v)}
                        aria-label="User menu"
                      >
                        {userInitial}
                      </button>
                      {user && showDropdown && (
                        <div className="absolute right-2 md:right-0 top-full mt-2 w-44 md:w-50 bg-white shadow-lg shadow-gray-400 pt-3 border border-gray-200 flex flex-col items-start z-50">
                          <span className="w-full text-black text-base md:text-lg mx-4">{user?.name || "User"}</span>
                          <span className="w-full mb-1 text-[#6A6A6A] text-xs md:text-sm px-4 wrap-anywhere">{user?.email || "Email address"}</span>
                          <hr className="w-full border-t border-gray-300 mt-2 mx-1" />
                          <div className='w-full flex px-4 py-3 items-center hover:bg-gray-200'>
                            <img src={logOutIcon} alt="Log Out" className="w-3 h-3"/>
                            <button
                              className="bg-transparent text-blacktext-sm md:text-md hover:underline font-regular ml-2"
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
