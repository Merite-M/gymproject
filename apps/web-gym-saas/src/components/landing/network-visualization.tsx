"use client";

import { Building2, Dumbbell, Waves, Footprints, ShieldCheck } from "lucide-react";

export default function NetworkVisualization() {
  return (
    <div className="relative w-full max-w-lg mx-auto select-none px-1 sm:px-0">
      {/* Container with subtle dark border and glow */}
      <div className="relative rounded-[14px] bg-[#0E2841]/80 border border-white/10 p-4 sm:p-6 lg:p-8 backdrop-blur-sm shadow-2xl overflow-hidden">
        {/* Header pill */}
        <div className="flex items-center justify-between pb-4 sm:pb-6 border-b border-white/10 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#28D17C] animate-pulse flex-shrink-0"></span>
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-gray-300 truncate">
              Connected Fitness Network
            </span>
          </div>
          <span className="text-[10px] sm:text-[11px] font-medium text-[#28D17C] bg-[#28D17C]/10 border border-[#28D17C]/30 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full flex-shrink-0 text-center">
            One Benefit → Many
          </span>
        </div>

        {/* Diagram Area */}
        <div className="relative py-6 sm:py-8">
          {/* SVG Connection Lines */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 420 220"
            preserveAspectRatio="xMidYMid meet"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Line from Company to PolyFit */}
            <path
              d="M 85 110 L 205 110"
              stroke="#28D17C"
              strokeWidth="2"
              strokeDasharray="4 4"
              className="opacity-70"
            />
            {/* Line from PolyFit to Gym (Top Right) */}
            <path
              d="M 215 100 C 260 70, 280 45, 335 45"
              stroke="#28D17C"
              strokeWidth="2"
              className="opacity-60"
            />
            {/* Line from PolyFit to Studio (Center Right) */}
            <path
              d="M 225 110 L 335 110"
              stroke="#28D17C"
              strokeWidth="2"
              className="opacity-60"
            />
            {/* Line from PolyFit to Pool / Wellness (Bottom Right) */}
            <path
              d="M 215 120 C 260 150, 280 175, 335 175"
              stroke="#28D17C"
              strokeWidth="2"
              className="opacity-60"
            />

            {/* Subtle traveling particles */}
            <circle r="3" fill="#B8F36B">
              <animateMotion dur="2.4s" repeatCount="indefinite" path="M 85 110 L 205 110" />
            </circle>
            <circle r="2.5" fill="#28D17C">
              <animateMotion dur="2.8s" repeatCount="indefinite" path="M 215 100 C 260 70, 280 45, 335 45" />
            </circle>
            <circle r="2.5" fill="#28D17C">
              <animateMotion dur="2.2s" repeatCount="indefinite" path="M 225 110 L 335 110" />
            </circle>
            <circle r="2.5" fill="#28D17C">
              <animateMotion dur="3s" repeatCount="indefinite" path="M 215 120 C 260 150, 280 175, 335 175" />
            </circle>
          </svg>

          {/* Diagram Nodes Layout */}
          <div className="relative flex items-center justify-between gap-1.5 sm:gap-4">
            {/* 1. Left Node: Company */}
            <div className="flex flex-col items-center text-center w-20 sm:w-28 flex-shrink-0">
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-[12px] bg-white/10 border border-white/20 flex items-center justify-center shadow-md mb-1.5 sm:mb-2">
                <Building2 className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-white">Company</span>
              <span className="text-[9px] sm:text-[10px] text-gray-400 truncate max-w-full">Single Benefit</span>
            </div>

            {/* 2. Central Hub Node: PolyFit */}
            <div className="flex flex-col items-center text-center flex-shrink-0">
              <div className="relative">
                <div className="w-13 h-13 sm:w-16 sm:h-16 rounded-[14px] bg-[#28D17C] text-[#0B1F33] flex flex-col items-center justify-center shadow-lg shadow-[#28D17C]/20 border border-white/40 p-2">
                  <span className="text-lg sm:text-xl font-extrabold leading-none">P</span>
                  <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wide mt-0.5">Hub</span>
                </div>
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-[#B8F36B] rounded-full flex items-center justify-center">
                  <ShieldCheck className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-[#0B1F33]" />
                </div>
              </div>
              <span className="text-[11px] sm:text-xs font-bold text-[#28D17C] mt-1.5 sm:mt-2">PolyFit</span>
              <span className="text-[9px] sm:text-[10px] text-gray-300">Verified Router</span>
            </div>

            {/* 3. Right Column: Partner Providers */}
            <div className="flex flex-col gap-2 sm:gap-3 w-28 sm:w-36 flex-shrink-0">
              {/* Gym */}
              <div className="flex items-center gap-1.5 sm:gap-2.5 p-1.5 sm:p-2 rounded-[10px] bg-white/5 border border-white/10 hover:border-[#28D17C]/40 transition-colors">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-[8px] bg-[#28D17C]/20 flex items-center justify-center flex-shrink-0">
                  <Dumbbell className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#28D17C]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs font-medium text-white truncate">Fitness Gym</p>
                  <p className="text-[8px] sm:text-[9px] text-gray-400 truncate">Weights & Cardio</p>
                </div>
              </div>

              {/* Studio */}
              <div className="flex items-center gap-1.5 sm:gap-2.5 p-1.5 sm:p-2 rounded-[10px] bg-white/5 border border-white/10 hover:border-[#28D17C]/40 transition-colors">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-[8px] bg-[#3B82F6]/20 flex items-center justify-center flex-shrink-0">
                  <Footprints className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#3B82F6]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs font-medium text-white truncate">Studio</p>
                  <p className="text-[8px] sm:text-[9px] text-gray-400 truncate">Yoga & Classes</p>
                </div>
              </div>

              {/* Pool & Recovery */}
              <div className="flex items-center gap-1.5 sm:gap-2.5 p-1.5 sm:p-2 rounded-[10px] bg-white/5 border border-white/10 hover:border-[#28D17C]/40 transition-colors">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-[8px] bg-[#B8F36B]/20 flex items-center justify-center flex-shrink-0">
                  <Waves className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#B8F36B]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs font-medium text-white truncate">Pool & Spa</p>
                  <p className="text-[8px] sm:text-[9px] text-gray-400 truncate">Swim & Sauna</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="pt-3 sm:pt-4 border-t border-white/10 text-center">
          <p className="text-[10px] sm:text-xs text-gray-300">
            Employees choose where they exercise • Unified invoicing
          </p>
        </div>
      </div>
    </div>
  );
}
