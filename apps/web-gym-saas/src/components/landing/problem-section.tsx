import { Users, Building2, Dumbbell, ArrowDown } from "lucide-react";

export default function ProblemSection() {
  return (
    <section className="py-16 sm:py-24 bg-[#F7F9FC] text-[#0B1F33]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#28D17C] mb-2">
            The Status Quo
          </p>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#0B1F33]">
            One gym doesn't work for everyone.
          </h2>
          <p className="text-sm sm:text-lg text-gray-600 mt-3 sm:mt-4 leading-relaxed">
            The traditional approach to corporate fitness benefits creates friction for everyone involved.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mb-8 sm:mb-12">
          {/* Card 1: Employees */}
          <div className="bg-white border border-gray-200/80 rounded-[14px] p-6 sm:p-8 shadow-sm hover:border-[#28D17C]/50 transition-all duration-200">
            <div className="w-12 h-12 rounded-[10px] bg-[#3B82F6]/10 flex items-center justify-center mb-6">
              <Users className="w-6 h-6 text-[#3B82F6]" />
            </div>
            <h3 className="text-xl font-bold text-[#0B1F33] mb-3">Employees</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              Your company's fitness benefit shouldn't depend on where one gym happens to be.
            </p>
            <ul className="space-y-2 text-sm text-gray-600 border-t border-gray-100 pt-4">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0"></span>
                <span>Too far from home or work</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0"></span>
                <span>Wrong location for daily commute</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0"></span>
                <span>Limited choice and flexibility</span>
              </li>
            </ul>
          </div>

          {/* Card 2: Employers */}
          <div className="bg-white border border-gray-200/80 rounded-[14px] p-6 sm:p-8 shadow-sm hover:border-[#28D17C]/50 transition-all duration-200">
            <div className="w-12 h-12 rounded-[10px] bg-[#0B1F33]/10 flex items-center justify-center mb-6">
              <Building2 className="w-6 h-6 text-[#0B1F33]" />
            </div>
            <h3 className="text-xl font-bold text-[#0B1F33] mb-3">Employers</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              Companies invest in employee wellness—but benefits are less valuable when employees can't conveniently use them.
            </p>
            <ul className="space-y-2 text-sm text-gray-600 border-t border-gray-100 pt-4">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0"></span>
                <span>Low benefit participation rates</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0"></span>
                <span>Wasted budget on unused perks</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0"></span>
                <span>No visibility into employee utilization</span>
              </li>
            </ul>
          </div>

          {/* Card 3: Fitness Providers */}
          <div className="bg-white border border-gray-200/80 rounded-[14px] p-6 sm:p-8 shadow-sm hover:border-[#28D17C]/50 transition-all duration-200">
            <div className="w-12 h-12 rounded-[10px] bg-[#28D17C]/15 flex items-center justify-center mb-6">
              <Dumbbell className="w-6 h-6 text-[#28D17C]" />
            </div>
            <h3 className="text-xl font-bold text-[#0B1F33] mb-3">Fitness Providers</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              Local gyms have capacity that could be filled by employees from organizations nearby.
            </p>
            <ul className="space-y-2 text-sm text-gray-600 border-t border-gray-100 pt-4">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0"></span>
                <span>Off-peak unused gym capacity</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0"></span>
                <span>High cost to acquire corporate accounts</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0"></span>
                <span>Complex check-in and billing logistics</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Conclusion / Takeaway */}
        <div className="text-center pt-2 sm:pt-4">
          <div className="inline-flex items-center gap-2.5 sm:gap-3 bg-white border border-[#28D17C]/30 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full shadow-sm max-w-full">
            <ArrowDown className="w-4 h-4 text-[#28D17C] flex-shrink-0" />
            <span className="text-sm sm:text-base font-bold text-[#0B1F33]">
              PolyFit connects all three.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
