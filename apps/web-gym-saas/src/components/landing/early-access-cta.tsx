import { Building2, Dumbbell, ArrowRight } from "lucide-react";

interface EarlyAccessCTAProps {
  onOpenLeadForm?: (type: 'employer' | 'provider') => void;
}

export default function EarlyAccessCTA({ onOpenLeadForm }: EarlyAccessCTAProps) {
  return (
    <section className="py-24 bg-[#0B1F33] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#28D17C] mb-2">
            Early Access & Pilot Network
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-6">
            We're building the next generation of corporate fitness in Rwanda.
          </h2>
          <p className="text-base sm:text-lg text-gray-300 leading-relaxed">
            PolyFit is currently working with forward-thinking organizations and leading fitness providers to launch its initial corporate fitness networks.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Path 1: Employer */}
          <div className="bg-white/5 border border-white/10 rounded-[14px] p-8 sm:p-10 flex flex-col justify-between hover:border-[#28D17C]/50 transition-all duration-200">
            <div>
              <div className="w-12 h-12 rounded-[10px] bg-[#28D17C]/20 flex items-center justify-center mb-6">
                <Building2 className="w-6 h-6 text-[#28D17C]" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                I'm an employer
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed mb-8">
                Explore how PolyFit can transform your employee wellness program with flexible, network-based fitness benefits and full usage visibility.
              </p>
            </div>
            <button 
              onClick={() => onOpenLeadForm?.('employer')}
              aria-label="Explore PolyFit - Open employer inquiry form"
              className="w-full bg-[#28D17C] hover:bg-[#28D17C]/90 text-[#0B1F33] px-6 py-4 rounded-[10px] text-base font-semibold transition-all duration-150 flex items-center justify-center gap-2 min-h-[48px] shadow-md hover:shadow-lg"
            >
              <span>Explore PolyFit</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          {/* Path 2: Provider */}
          <div className="bg-white/5 border border-white/10 rounded-[14px] p-8 sm:p-10 flex flex-col justify-between hover:border-[#28D17C]/50 transition-all duration-200">
            <div>
              <div className="w-12 h-12 rounded-[10px] bg-[#3B82F6]/20 flex items-center justify-center mb-6">
                <Dumbbell className="w-6 h-6 text-[#3B82F6]" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                I'm a fitness provider
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed mb-8">
                Join the PolyFit network to reach corporate employees, fill off-peak capacity, and grow your facility with verified visit tracking.
              </p>
            </div>
            <button 
              onClick={() => onOpenLeadForm?.('provider')}
              aria-label="Join the network - Open provider registration form"
              className="w-full border border-white/30 hover:bg-white/10 text-white px-6 py-4 rounded-[10px] text-base font-semibold transition-all duration-150 flex items-center justify-center gap-2 min-h-[48px]"
            >
              <span>Join the network</span>
              <ArrowRight className="w-5 h-5 text-gray-300" />
            </button>
          </div>
        </div>

        <div className="mt-14 text-center">
          <p className="text-xs text-gray-400">
            Currently accepting corporate pilot partners and fitness facilities in Musanze and Kigali.
          </p>
        </div>
      </div>
    </section>
  );
}