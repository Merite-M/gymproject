import Link from "next/link";
import { MapPin } from "lucide-react";

interface FooterProps {
  onOpenLeadForm?: (type: 'employer' | 'provider') => void;
}

export default function Footer({ onOpenLeadForm }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#0B1F33] text-white border-t border-white/10" aria-label="Site Footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand Col (2 cols on md) */}
          <div className="col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-[#28D17C] rounded-[8px] flex items-center justify-center">
                <span className="text-[#0B1F33] font-bold text-lg leading-none">P</span>
              </div>
              <span className="text-xl font-bold tracking-tight text-white">PolyFit</span>
            </div>
            <p className="text-sm text-gray-400 max-w-sm mb-4 leading-relaxed">
              Corporate fitness & wellness network connecting employers, employees, and participating fitness providers.
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <MapPin className="w-3.5 h-3.5 text-[#28D17C]" />
              <span>Kigali, Rwanda</span>
            </div>
          </div>

          {/* Solutions */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 mb-4">Platform</h3>
            <ul className="space-y-2.5 text-sm text-gray-400">
              <li>
                <a href="#how-it-works" className="hover:text-white transition-colors">
                  How it Works
                </a>
              </li>
              <li>
                <a href="#for-companies" className="hover:text-white transition-colors">
                  For Companies
                </a>
              </li>
              <li>
                <a href="#for-providers" className="hover:text-white transition-colors">
                  For Providers
                </a>
              </li>
              <li>
                <a href="#network" className="hover:text-white transition-colors">
                  Network & Cities
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 mb-4">Company</h3>
            <ul className="space-y-2.5 text-sm text-gray-400">
              <li>
                <a href="#about" className="hover:text-white transition-colors">
                  About
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">
                  FAQ
                </a>
              </li>
              <li>
                <button 
                  onClick={() => onOpenLeadForm?.('employer')}
                  className="hover:text-white transition-colors text-left"
                >
                  Contact
                </button>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 mb-4">Legal</h3>
            <ul className="space-y-2.5 text-sm text-gray-400">
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-400">
          <p>© {currentYear} PolyFit Ltd. All rights reserved.</p>
          <p>Built for the way modern organizations manage employee wellness in East Africa.</p>
        </div>
      </div>
    </footer>
  );
}