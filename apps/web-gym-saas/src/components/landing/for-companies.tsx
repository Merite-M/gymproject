import { ArrowRight, Users, MapPin, BarChart3, Handshake } from "lucide-react";

interface ForCompaniesProps {
  onOpenLeadForm?: (type: 'employer' | 'provider') => void;
}

export default function ForCompanies({ onOpenLeadForm }: ForCompaniesProps) {
  const benefits = [
    {
      icon: Users,
      title: "More choice",
      description: "Employees aren't restricted to a single gym location—they can choose providers that match their schedule and workout style."
    },
    {
      icon: MapPin,
      title: "Better accessibility",
      description: "Employees choose participating providers that fit their daily commutes, residential neighborhoods, and routine patterns."
    },
    {
      icon: BarChart3,
      title: "Usage visibility",
      description: "Understand participation and benefit utilization with transparent reporting instead of paying flat fees for unused memberships."
    },
    {
      icon: Handshake,
      title: "One relationship",
      description: "PolyFit manages the provider network and contracts instead of your HR team coordinating multiple gyms individually."
    }
  ];

  return (
    <section id="for-companies" className="py-24 bg-white text-[#0B1F33] border-t border-gray-200/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#28D17C] mb-2">
            For Employers & HR Leaders
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0B1F33] mb-4">
            Make your employee fitness benefit actually useful.
          </h2>
          <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
            Give employees more choice without creating more administrative complexity for your organization.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 mb-12">
          {benefits.map((benefit, index) => (
            <div
              key={index}
              className="bg-[#F7F9FC] border border-gray-200/80 rounded-[14px] p-8 hover:border-[#28D17C]/50 transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-[10px] bg-white border border-gray-200/60 flex items-center justify-center mb-6 shadow-sm">
                <benefit.icon className="w-6 h-6 text-[#28D17C]" />
              </div>
              <h3 className="text-xl font-bold text-[#0B1F33] mb-2">{benefit.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{benefit.description}</p>
            </div>
          ))}
        </div>

        <div>
          <button 
            onClick={() => onOpenLeadForm?.('employer')}
            aria-label="Talk to PolyFit - Open employer inquiry form"
            className="inline-flex items-center gap-2 bg-[#0B1F33] hover:bg-[#0B1F33]/90 text-white px-8 py-4 rounded-[10px] text-base font-semibold transition-all duration-150 shadow-md hover:shadow-lg"
          >
            <span>Talk to PolyFit</span>
            <ArrowRight className="w-5 h-5 text-[#28D17C]" />
          </button>
        </div>
      </div>
    </section>
  );
}