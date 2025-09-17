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
  const menuRef = useRef(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  useEffect(() => {
    let title = "Talent Finder";
    if (path === "/verify-cv") title = "CV Verification";
    else if (path === "/verify-cv/results") title = "CV Verification Results";
    else if (path === "/search-tool") title = "Search Tool";
    else if (path === "/saved-researchers") title = "Saved Profiles";
    else if (path === "/login") title = "Login";
    else if (path === "/landing-page") title = "Talent Finder";
    document.title = title;
  }, [path]);

  // Close user menu on route change
  useEffect(() => {
    setShowDropdown(false);
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
    <header className="bg-[#000054] h-18">
        <nav className="mx-auto flex max-w-7xl" aria-label="Global">
            <div className="flex items-center justify-between w-full overflow-visible">
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
                    {loading && hadSession ? (
                      // Reserve space to avoid flicker when restoring session
                      <div
                        className={`flex items-center justify-center px-8 h-full ${path === '/saved-researchers' ? 'bg-white' : ''}`}
                        aria-hidden
                      >
                        <span className={`${path === '/saved-researchers' ? 'text-[#000054]' : 'text-white'} opacity-0`}>Saved Profiles</span>
                      </div>
                    ) : user ? (
                      <div
                        className={`flex items-center justify-center px-8 h-full ${path === '/saved-researchers' ? 'bg-white' : 'hover:bg-[#000032]'}`}
                        title="View your saved profiles"
                      >
                          <a href="/saved-researchers" aria-label="Saved Profiles">
                              <p className={`font-medium hover:underline ${path === '/saved-researchers' ? 'text-[#000054] font-semibold underline' : 'text-white'}`}>Saved Profiles</p>
                          </a>
                      </div>
                    ) : (
                      <div
                        className={`flex items-center justify-center px-8 h-full ${path === '/login' ? 'bg-white' : 'hover:bg-[#000032]'}`}
                        title="Log in to access Saved Profiles"
                      >
                          <button
                            onClick={handleLoginClick}
                            className={`font-medium hover:underline ${path === '/login' ? 'text-[#000054] font-semibold underline' : 'text-white'}`}
                            aria-label="Login"
                          >
                            Login
                          </button>
                      </div>
                    )}
                    <div className="ml-7 relative" ref={menuRef}>
                      <button
                        className={`w-10 h-10 rounded-full bg-white text-[#000054] flex items-center justify-center text-md font-normal shadow-lg focus:outline-none ${user ? 'hover:bg-gray-200' : 'invisible pointer-events-none'}`}
                        onClick={() => user && setShowDropdown((v) => !v)}
                        aria-label="User menu"
                      >
                        {userInitial}
                      </button>
                      {user && showDropdown && (
                        <div className="absolute right-0 top-full mt-2 w-50 bg-white shadow-lg shadow-gray-400 pt-3 border border-gray-200 flex flex-col items-start z-50">
                          <span className="w-full text-black text-lg mx-4">{user?.name || "User"}</span>
                          <span className="w-full mb-1 text-[#6A6A6A] text-sm px-4 wrap-anywhere">{user?.email || "Email address"}</span>
                          <hr className="w-full border-t border-gray-300 mt-2 mx-1" />
                          <div className='w-full flex px-4 py-3 items-center hover:bg-gray-200'>
                            <img src={logOutIcon} alt="Log Out" className="w-3 h-3"/>
                            <button
                              className="bg-transparent text-black text-md hover:underline font-regular ml-2"
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
