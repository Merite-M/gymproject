import { Building2, KeyRound, MapPin, ShieldCheck } from "lucide-react";

export default function HowItWorks() {
  const steps = [
    {
      number: "01",
      icon: Building2,
      title: "Company joins",
      description: "The employer chooses a PolyFit corporate fitness plan that fits their team size and budget."
    },
    {
      number: "02",
      icon: KeyRound,
      title: "Employees get access",
      description: "Eligible employees receive digital passes through PolyFit to access partner facilities."
    },
    {
      number: "03",
      icon: MapPin,
      title: "Employees choose",
      description: "Employees find participating fitness providers that fit their location, schedule, and preferences."
    },
    {
      number: "04",
      icon: ShieldCheck,
      title: "PolyFit verifies",
      description: "Visits are verified and usage is recorded so providers and employers have transparent reporting."
    }
  ];

  return (
    <section id="how-it-works" className="py-24 bg-[#F7F9FC] text-[#0B1F33]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#28D17C] mb-2">
            Simple Process
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0B1F33]">
            How PolyFit works
          </h2>
          <p className="text-base sm:text-lg text-gray-600 mt-4 leading-relaxed">
            Four simple steps to connect organizations, employees, and local fitness providers.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => (
            <div
              key={index}
              className="bg-white border border-gray-200/80 rounded-[14px] p-6 sm:p-7 shadow-sm hover:border-[#28D17C]/50 transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-10 h-10 rounded-[10px] bg-[#28D17C]/15 flex items-center justify-center">
                    <step.icon className="w-5 h-5 text-[#28D17C]" />
                  </div>
                  <span className="text-xs font-bold text-gray-400 font-mono">
                    {step.number}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[#0B1F33] mb-2">{step.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}