import React from 'react';
import logo from '../assets/rmit-logo-white.svg';

function Header() {
  return (

    
    <header className="bg-[#000054] h-18">
        <nav className="mx-auto flex max-w-7xl" aria-label="Global">
            <div className="flex items-center justify-between w-full overflow-hidden">
                {/* Logo and website name */}
                <div className="flex items-center">
                    <div className='bg-[#E60028] h-21 absolute top-0 py-3 px-4 flex items-center justify-center mr-6'>
                        <a href="/">
                            <img className="h-8 w-auto" src={logo} alt=""/>
                        </a>
                    </div>
                    
                    {/* Space divider - decoration purpose only */}
                    <div className="w-37 h-18"></div>

                    <p className='text-lg text-white font-bold'>Talent Finder</p>
                </div>

                {/* Navigation links */}
                <div className="flex items-center w-max h-18 justify-end text-lg">
                    <div className='flex items-center justify-center hover:bg-[#000032] px-8 h-full'>
                        <a href="/verify-cv">
                            <p className='text-white font-medium hover:underline'>CV Verification</p>
                        </a>
                    </div>

                    <div className='flex items-center justify-center hover:bg-[#000032] px-8 h-full'>
                        <a href="/search-tool">
                            <p className='text-white font-medium hover:underline'>Search Tool</p>
                        </a>
                    </div>
                </div>
            </div>
        </nav>
    </header>

    

  );
}   

export default Header;
