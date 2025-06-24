import rmitLogo from '../assets/rmit-logo-red.png';

export default function Footer() {
  return (
    <footer className="bg-[#000054] mt-8">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between">
        <div className="flex items-center space-x-3 mb-4 md:mb-0">
          <img src={rmitLogo} alt="RMIT Logo" className="h-8 w-auto" />
          <span className="text-sm text-white">
            Copyright © 2025 RMIT University
          </span>
        </div>
      </div>
    </footer>
  );
}
