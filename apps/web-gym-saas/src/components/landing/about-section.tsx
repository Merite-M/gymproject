import { Target, Compass } from "lucide-react";

export default function AboutSection() {
  return (
    <section id="about" className="py-24 bg-[#F7F9FC] text-[#0B1F33] border-t border-gray-200/60">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#28D17C] mb-2">
          About PolyFit
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0B1F33] mb-6">
          We're building a better way to use employee wellness benefits.
        </h2>
        <p className="text-lg text-gray-700 leading-relaxed mb-6 font-normal">
          PolyFit was created around a simple observation: employees don't all live, work, or exercise in the same place.
        </p>
        <p className="text-base text-gray-600 leading-relaxed mb-12 max-w-2xl mx-auto">
          We believe corporate fitness benefits should give people freedom and choice while giving organizations full visibility, control, and measurable ROI.
        </p>

        {/* Mission Box */}
        <div className="bg-white border border-[#28D17C]/30 rounded-[14px] p-8 sm:p-10 shadow-sm text-left max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-[8px] bg-[#28D17C]/15 flex items-center justify-center">
              <Target className="w-5 h-5 text-[#28D17C]" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#28D17C]">
              Our Mission
            </span>
          </div>
          <p className="text-xl font-bold text-[#0B1F33] leading-snug">
            Make quality fitness and wellness more accessible through connected local networks.
          </p>
        </div>
      </div>
    </section>
  );
}