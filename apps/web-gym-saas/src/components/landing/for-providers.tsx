import { Users, CheckCircle2, DollarSign, TrendingUp, ArrowRight } from "lucide-react";

interface ForProvidersProps {
  onOpenLeadForm?: (type: 'employer' | 'provider') => void;
}

export default function ForProviders({ onOpenLeadForm }: ForProvidersProps) {
  const benefits = [
    {
      icon: Users,
      title: "New customers",
      description: "Reach employees from participating organizations who are actively looking for convenient fitness options nearby."
    },
    {
      icon: CheckCircle2,
      title: "Verified visits",
      description: "Know who is using your facility in real-time through PolyFit's digital check-in verification."
    },
    {
      icon: DollarSign,
      title: "Predictable settlement",
      description: "Usage is reconciled automatically and paid on clear, agreed settlement cycles."
    },
    {
      icon: TrendingUp,
      title: "Business insights",
      description: "Understand peak member hours, demographic demand, and facility utilization patterns."
    }
  ];

  return (
    <section id="for-providers" className="py-24 bg-[#F7F9FC] text-[#0B1F33] border-t border-gray-200/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#28D17C] mb-2">
            For Gyms & Fitness Providers
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0B1F33] mb-4">
            More corporate customers. Less friction.
          </h2>
          <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
            PolyFit connects local fitness providers with employees whose organizations already invest in wellness.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 mb-12">
          {benefits.map((benefit, index) => (
            <div
              key={index}
              className="bg-white border border-gray-200/80 rounded-[14px] p-8 hover:border-[#28D17C]/50 transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-[10px] bg-[#28D17C]/10 flex items-center justify-center mb-6">
                <benefit.icon className="w-6 h-6 text-[#28D17C]" />
              </div>
              <h3 className="text-xl font-bold text-[#0B1F33] mb-2">{benefit.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{benefit.description}</p>
            </div>
          ))}
        </div>

        <div>
          <button 
            onClick={() => onOpenLeadForm?.('provider')}
            aria-label="Become a PolyFit Provider - Open provider registration form"
            className="inline-flex items-center gap-2 bg-[#28D17C] hover:bg-[#28D17C]/90 text-[#0B1F33] px-8 py-4 rounded-[10px] text-base font-semibold transition-all duration-150 shadow-md hover:shadow-lg"
          >
            <span>Become a PolyFit Provider</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
}