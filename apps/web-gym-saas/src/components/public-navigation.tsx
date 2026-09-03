"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

interface PublicNavigationProps {
  onOpenLeadForm?: (type: 'employer' | 'provider') => void;
}

export default function PublicNavigation({ onOpenLeadForm }: PublicNavigationProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = [
    { name: "How it Works", href: "#how-it-works" },
    { name: "For Companies", href: "#for-companies" },
    { name: "For Providers", href: "#for-providers" },
    { name: "About", href: "#about" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B1F33]/90 backdrop-blur-md border-b border-white/10" aria-label="Main Navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <a href="/" className="flex items-center space-x-3 group">
              <div className="w-9 h-9 bg-[#28D17C] rounded-[10px] flex items-center justify-center shadow-sm">
                <span className="text-[#0B1F33] font-bold text-xl leading-none">P</span>
              </div>
              <span className="text-2xl font-bold tracking-tight text-white">PolyFit</span>
            </a>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                {link.name}
              </a>
            ))}

            <button 
              onClick={() => onOpenLeadForm?.('employer')}
              aria-label="Talk to us - Open employer inquiry modal"
              className="bg-[#28D17C] hover:bg-[#28D17C]/90 text-[#0B1F33] px-5 py-2.5 rounded-[10px] text-sm font-semibold transition-all duration-150 shadow-sm hover:shadow"
            >
              Talk to us
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-[10px] text-gray-300 hover:text-white hover:bg-white/10 focus:outline-none min-h-[44px] min-w-[44px]"
              aria-expanded={isMenuOpen}
              aria-label="Toggle mobile menu"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-[#0B1F33] border-t border-white/10 px-4 pt-3 pb-6 space-y-3">
          <div className="space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="block px-3 py-2.5 rounded-[10px] text-base font-medium text-gray-200 hover:text-white hover:bg-white/5 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                {link.name}
              </a>
            ))}
          </div>
          
          <div className="pt-3 border-t border-white/10">
            <button 
              onClick={() => {
                setIsMenuOpen(false);
                onOpenLeadForm?.('employer');
              }}
              aria-label="Talk to us - Open employer inquiry modal"
              className="w-full bg-[#28D17C] hover:bg-[#28D17C]/90 text-[#0B1F33] px-5 py-3 rounded-[10px] text-sm font-semibold transition-colors min-h-[44px]"
            >
              Talk to us
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}