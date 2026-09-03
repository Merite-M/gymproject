import { CheckCircle2 } from "lucide-react";

export default function SolutionSection() {
  return (
    <section className="py-24 bg-white text-[#0B1F33] border-t border-gray-200/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Text */}
          <div className="lg:col-span-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#28D17C] mb-2">
              The PolyFit Solution
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0B1F33] mb-6">
              One benefit. Multiple places to move.
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-8">
              Instead of limiting employees to one fitness provider, PolyFit creates a connected network where eligible employees can access participating providers according to their company's plan.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3.5">
                <CheckCircle2 className="w-5 h-5 text-[#28D17C] mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-600">
                  <strong className="text-[#0B1F33] font-semibold">One corporate agreement:</strong> Your HR team coordinates a single wellness plan with unified monthly billing.
                </p>
              </div>

              <div className="flex items-start gap-3.5">
                <CheckCircle2 className="w-5 h-5 text-[#28D17C] mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-600">
                  <strong className="text-[#0B1F33] font-semibold">Multi-facility access:</strong> Employees check in at partner gyms, fitness studios, and facilities that fit their schedule.
                </p>
              </div>

              <div className="flex items-start gap-3.5">
                <CheckCircle2 className="w-5 h-5 text-[#28D17C] mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-600">
                  <strong className="text-[#0B1F33] font-semibold">Automated reconciliation:</strong> Verified digital check-ins ensure gyms get paid accurately and employers receive clear analytics.
                </p>
              </div>
            </div>
          </div>

          {/* Right Visual Architecture */}
          <div className="lg:col-span-6">
            <div className="bg-[#0B1F33] rounded-[14px] p-8 sm:p-10 text-white shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 text-center mb-6">
                Connected Benefit Flow
              </p>

              <div className="flex flex-col items-center">
                {/* Employer */}
                <div className="w-48 py-3 rounded-[10px] bg-white/10 border border-white/20 text-center shadow-sm">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">1. Employer</span>
                  <p className="text-[11px] text-gray-300">Sets benefit budget & roster</p>
                </div>

                {/* Down Arrow */}
                <div className="w-0.5 h-8 bg-[#28D17C]"></div>
                <div className="w-2 h-2 rounded-full bg-[#28D17C] -mt-1"></div>

                {/* PolyFit Hub */}
                <div className="w-56 py-3.5 rounded-[12px] bg-[#28D17C] text-[#0B1F33] text-center font-bold shadow-lg shadow-[#28D17C]/20 border border-white/40 my-1">
                  <span className="text-sm font-extrabold uppercase tracking-wide">PolyFit Network</span>
                  <p className="text-[10px] font-semibold text-[#0B1F33]/80">Benefit routing & verification</p>
                </div>

                {/* Branching Lines */}
                <svg className="w-64 h-8" viewBox="0 0 256 32" fill="none">
                  <path d="M 128 0 L 128 12 C 128 20, 32 16, 32 32" stroke="#28D17C" strokeWidth="2" />
                  <path d="M 128 0 L 128 32" stroke="#28D17C" strokeWidth="2" />
                  <path d="M 128 0 L 128 12 C 128 20, 224 16, 224 32" stroke="#28D17C" strokeWidth="2" />
                </svg>

                {/* Gyms Row */}
                <div className="grid grid-cols-3 gap-3 w-full mt-2">
                  <div className="py-2.5 px-2 rounded-[8px] bg-white/5 border border-white/10 text-center">
                    <span className="text-xs font-semibold text-white block truncate">Gym A</span>
                    <span className="text-[10px] text-gray-400">Musanze</span>
                  </div>
                  <div className="py-2.5 px-2 rounded-[8px] bg-white/5 border border-white/10 text-center">
                    <span className="text-xs font-semibold text-white block truncate">Gym B</span>
                    <span className="text-[10px] text-gray-400">Kigali</span>
                  </div>
                  <div className="py-2.5 px-2 rounded-[8px] bg-white/5 border border-white/10 text-center">
                    <span className="text-xs font-semibold text-white block truncate">Studio C</span>
                    <span className="text-[10px] text-gray-400">Classes</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 text-center">
                <p className="text-xs text-gray-300">
                  Employees have choice • Facilities receive customers • Employers retain visibility
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}