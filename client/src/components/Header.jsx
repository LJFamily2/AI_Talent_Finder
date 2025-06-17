import React from 'react';
import logo from '../assets/rmit-logo-white.svg';

function Header() {
  return (

    
    <header className="bg-[#000054] h-18 overflow-visible mb-2">
        <nav className="mx-auto flex max-w-7xl" aria-label="Global">
            <div className="flex items-center gap-x-8">
                <div className='bg-[#E60028] py-6 px-4 flex items-center justify-center'>
                    <a href="#">
                        <img className="h-8 w-auto" src={logo} alt=""/>
                    </a>
                </div>
                <p className='text-xl text-white font-bold mb-3'>Talent Finder</p>
            </div>
        </nav>
    </header>

    

  );
}   

export default Header;
