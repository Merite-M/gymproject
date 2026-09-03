import { MapPin, Navigation, Compass } from "lucide-react";

export default function NetworkSection() {
  return (
    <section id="network" className="py-16 sm:py-24 bg-white text-[#0B1F33] border-t border-gray-200/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-10 sm:gap-12 lg:gap-16 items-center">
          {/* Left Text */}
          <div className="lg:col-span-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#28D17C] mb-2">
              Local Density & Geography
            </p>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#0B1F33] mb-3 sm:mb-4">
              Your employees. Their choice.
            </h2>
            <p className="text-base sm:text-lg font-medium text-gray-800 mb-3 sm:mb-4">
              Built around how people actually move.
            </p>
            <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-6">
              PolyFit starts by building dense local networks—connecting organizations with fitness providers in the places where their employees live and work. Rather than claiming thin nationwide coverage from day one, we focus on high-density clusters that deliver real utility.
            </p>

            <div className="space-y-4 border-t border-gray-100 pt-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-[8px] bg-[#28D17C]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4 text-[#28D17C]" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-[#0B1F33]">Musanze (Pilot Area)</h3>
                  <p className="text-xs text-gray-600">
                    Initial launch and validation cluster connecting local commercial employers with fitness facilities.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-[8px] bg-[#3B82F6]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Compass className="w-4 h-4 text-[#3B82F6]" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-[#0B1F33]">Kigali (Expansion Corridor)</h3>
                  <p className="text-xs text-gray-600">
                    Preparing network expansion for corporate headquarters, business districts, and residential hubs.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Map Visual */}
          <div className="lg:col-span-6 w-full overflow-hidden">
            <div className="bg-[#0B1F33] rounded-[14px] p-5 sm:p-8 text-white shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-4 sm:mb-6 pb-4 border-b border-white/10 gap-2">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-[#28D17C] flex-shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                    Network Geography
                  </span>
                </div>
                <span className="text-[10px] sm:text-[11px] font-medium text-[#28D17C] bg-[#28D17C]/10 border border-[#28D17C]/30 px-2 sm:px-2.5 py-0.5 rounded-full flex-shrink-0">
                  Rwanda Focus
                </span>
              </div>

              {/* Simplified Rwanda Map Vector with Nodes */}
              <div className="relative py-2 sm:py-4">
                <svg className="w-full h-48 sm:h-64" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid meet" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Stylized Rwanda boundary outline */}
                  <path
                    d="M 120 40 L 220 25 L 300 60 L 330 110 L 320 180 L 260 220 L 160 225 L 90 190 L 60 135 L 75 75 Z"
                    fill="rgba(255,255,255,0.03)"
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth="1.5"
                  />

                  {/* Connecting dashed corridor: Musanze to Kigali */}
                  <line
                    x1="130"
                    y1="75"
                    x2="210"
                    y2="130"
                    stroke="#28D17C"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    opacity="0.6"
                  />

                  {/* Musanze Pilot Cluster */}
                  <g transform="translate(130, 75)">
                    <circle r="22" fill="#28D17C" opacity="0.15" />
                    <circle r="12" fill="#28D17C" opacity="0.4" />
                    <circle r="5" fill="#28D17C" />
                    <text x="0" y="-14" textAnchor="middle" fill="white" fontSize="11" fontWeight="700">Musanze</text>
                    <text x="0" y="22" textAnchor="middle" fill="#28D17C" fontSize="9" fontWeight="600">Pilot Area</text>
                  </g>

                  {/* Kigali Expansion Cluster */}
                  <g transform="translate(210, 130)">
                    <circle r="16" fill="#3B82F6" opacity="0.15" />
                    <circle r="5" fill="#3B82F6" />
                    <text x="0" y="-12" textAnchor="middle" fill="white" fontSize="11" fontWeight="700">Kigali</text>
                    <text x="0" y="20" textAnchor="middle" fill="#3B82F6" fontSize="9" fontWeight="600">Expansion</text>
                  </g>

                  {/* Flow labels */}
                  <g transform="translate(130, 175)">
                    <rect x="-60" y="-12" width="120" height="24" rx="6" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" />
                    <text x="0" y="4" textAnchor="middle" fill="white" fontSize="10" fontWeight="500">Company → PolyFit → Gyms</text>
                  </g>
                </svg>
              </div>

              <div className="pt-3 sm:pt-4 border-t border-white/10 text-center">
                <p className="text-[10px] sm:text-xs text-gray-400">
                  Starting with dense local clusters before expanding across East Africa.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
