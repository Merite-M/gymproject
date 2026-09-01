"use client";

import { useState, useId } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  Dumbbell,
  BadgeCheck,
  ShieldCheck,
  Calculator,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Network,
  MapPin,
  Activity,
  Zap,
  Send,
  Check,
  X,
  CreditCard,
  Lock,
  Award
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Facility {
  id: string;
  name: string;
  category: "Gyms" | "Swimming Pools" | "Tennis & Squash" | "Sauna & Spa" | "Yoga & Pilates";
  location: string;
  rating: number;
  visitsThisMonth: number;
  imageBg: string;
  badge: string;
  features: string[];
}

const partnerFacilities: Facility[] = [
  {
    id: "waka-kigali",
    name: "WAKA Fitness Kigali",
    category: "Gyms",
    location: "KimiHurura, Kigali",
    rating: 4.9,
    visitsThisMonth: 1420,
    imageBg: "from-emerald-900/40 to-slate-900",
    badge: "Verified Partner",
    features: ["Crossfit Arena", "Olympic Barbell Racks", "Recovery Sauna"]
  },
  {
    id: "cercle-sportif",
    name: "Cercle Sportif de Kigali",
    category: "Tennis & Squash",
    location: "Rugunga, Kigali",
    rating: 4.8,
    visitsThisMonth: 980,
    imageBg: "from-blue-900/40 to-slate-900",
    badge: "Premier Partner",
    features: ["Clay Tennis Courts", "Olympic Pool", "Squash Arena"]
  },
  {
    id: "cali-fitness",
    name: "Cali Fitness Center",
    category: "Gyms",
    location: "Nyarutarama, Kigali",
    rating: 4.7,
    visitsThisMonth: 1150,
    imageBg: "from-emerald-900/40 to-slate-900",
    badge: "Verified Partner",
    features: ["Functional Strength", "Spin Studio", "Smoothie Bar"]
  },
  {
    id: "heaven-wellness",
    name: "Heaven Wellness & Pool",
    category: "Swimming Pools",
    location: "Kiyovu, Kigali",
    rating: 4.9,
    visitsThisMonth: 840,
    imageBg: "from-cyan-900/40 to-slate-900",
    badge: "Resort Network",
    features: ["Heated Infinity Pool", "Organic Spa", "Yoga Pavilion"]
  },
  {
    id: "musanze-sports",
    name: "Musanze Athletic Club",
    category: "Gyms",
    location: "Muhoza, Musanze",
    rating: 4.8,
    visitsThisMonth: 620,
    imageBg: "from-lime-900/40 to-slate-900",
    badge: "Northern Hub",
    features: ["High Altitude Cardio", "Power Racks", "Group Cycling"]
  },
  {
    id: "zenith-yoga",
    name: "Zenith Yoga & Sauna Studio",
    category: "Yoga & Pilates",
    location: "Kibagabaga, Kigali",
    rating: 4.9,
    visitsThisMonth: 510,
    imageBg: "from-indigo-900/40 to-slate-900",
    badge: "Boutique Studio",
    features: ["Hot Vinyasa", "Reformer Pilates", "Eucalyptus Sauna"]
  }
];

export default function PolyFitB2BLandingPage() {
  const [employeeCount, setEmployeeCount] = useState<number>(150);
  const [coverageTier, setCoverageTier] = useState<"standard" | "executive">("standard");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Lead Capture Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    headcount: 150,
    message: ""
  });

  const headcountId = useId();
  const companyNameId = useId();
  const contactNameId = useId();
  const emailId = useId();
  const phoneId = useId();
  const headcountModalId = useId();
  const messageId = useId();

  // ROI Calculations
  // Baseline individual gym membership in Kigali ~ 60,000 RWF / month
  // PolyFit Network bulk corporate pricing ~ 32,000 RWF / month per employee
  const pricePerEmployee = coverageTier === "standard" ? 32000 : 55000;
  const monthlySpendRwf = employeeCount * pricePerEmployee;
  const annualSpendRwf = monthlySpendRwf * 12;
  // Estimated healthcare claim reduction (Rwandan corporate wellness benchmark ~ 22% reduction in sick leaves)
  const healthSavingsRwf = annualSpendRwf * 0.38;
  // Rwandan Corporate Tax Savings (100% Employee Welfare Health Benefit Deductibility @ 30% CIT)
  const taxDeductionRwf = annualSpendRwf * 0.30;
  const netEffectiveCostRwf = Math.max(0, annualSpendRwf - taxDeductionRwf - healthSavingsRwf);

  const filteredFacilities = selectedCategory === "All"
    ? partnerFacilities
    : partnerFacilities.filter(f => f.category === selectedCategory);

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await supabase.from("corporate_inquiries").insert({
        company_name: formData.companyName,
        contact_name: formData.contactName,
        email: formData.email,
        phone: formData.phone,
        employee_count: formData.headcount,
        notes: formData.message,
        status: "new",
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn("Saved lead to local state:", err);
    } finally {
      setLoading(false);
      setFormSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1F33] text-slate-100 font-sans selection:bg-[#28D17C] selection:text-[#0B1F33]">
      {/* Top B2B Navigation Header */}
      <nav className="sticky top-0 z-40 bg-[#0B1F33]/90 backdrop-blur-md border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#28D17C] to-[#3B82F6] flex items-center justify-center font-bold text-[#0B1F33] text-xl shadow-lg shadow-[#28D17C]/20">
              P
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-white flex items-center gap-2">
                PolyFit <span className="text-xs px-2 py-0.5 rounded-full bg-[#28D17C]/20 text-[#28D17C] border border-[#28D17C]/30 font-mono font-medium">B2B Network</span>
              </span>
              <p className="text-[11px] text-slate-400 hidden sm:block">Corporate Wellness Network for East Africa</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#network" className="hover:text-[#28D17C] transition-colors">Provider Network</a>
            <a href="#calculator" className="hover:text-[#28D17C] transition-colors">ROI Calculator</a>
            <a href="#saas-showcase" className="hover:text-[#28D17C] transition-colors">BOH Gym SaaS</a>
            <a href="#benefits" className="hover:text-[#28D17C] transition-colors">Tax & Benefits</a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs sm:text-sm font-semibold text-slate-300 hover:text-white px-3.5 py-2 rounded-lg hover:bg-slate-800/80 transition-all min-h-[44px] flex items-center"
            >
              Sign In
            </Link>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-[#28D17C] text-[#0B1F33] hover:bg-[#B8F36B] transition-all font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md shadow-[#28D17C]/20 hover:scale-[1.02] active:scale-[0.98] min-h-[44px] flex items-center gap-2"
            >
              Schedule HR Demo <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section with Network Nodes Motif */}
      <section className="relative overflow-hidden pt-12 pb-24 px-6 border-b border-slate-800/80 bg-gradient-to-b from-[#0B1F33] via-[#0D253E] to-[#0B1F33]">
        {/* Subtle Network Visual Background Overlay */}
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#3B82F6_1px,transparent_1px)] [background-size:24px_24px]" />

        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 items-center relative z-10">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#28D17C]/10 border border-[#28D17C]/30 text-[#28D17C] text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> One Contract. Unlimited Access Across East Africa.
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] text-white">
              The B2B Corporate Wellness Network for <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#28D17C] via-[#3B82F6] to-[#B8F36B]">East Africa</span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-300 font-normal leading-relaxed max-w-2xl">
              One seamless corporate agreement gives your entire workforce instant access to hundreds of top fitness, swimming, tennis, and wellness facilities across Kigali, Musanze, and Nairobi.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-[#28D17C] text-[#0B1F33] hover:bg-[#B8F36B] transition-all font-bold text-base px-6 py-3.5 rounded-xl shadow-lg shadow-[#28D17C]/25 flex items-center justify-center gap-2 min-h-[48px]"
              >
                Schedule HR Demo <ArrowRight className="w-5 h-5" />
              </button>
              <a
                href="#calculator"
                className="border border-slate-700 bg-slate-800/40 hover:bg-slate-800 text-white font-semibold text-base px-6 py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 min-h-[48px]"
              >
                <Calculator className="w-5 h-5 text-[#3B82F6]" /> Calculate ROI
              </a>
            </div>

            {/* Key Trust Stats */}
            <div className="pt-8 border-t border-slate-800/80 grid grid-cols-3 gap-6">
              <div>
                <p className="text-2xl sm:text-3xl font-extrabold text-[#28D17C]">42+</p>
                <p className="text-xs sm:text-sm text-slate-400">Partner Venues in Kigali</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-extrabold text-[#3B82F6]">8,500+</p>
                <p className="text-xs sm:text-sm text-slate-400">Active Employees Covered</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-extrabold text-[#B8F36B]">100%</p>
                <p className="text-xs sm:text-sm text-slate-400">Rwandan Tax Deductible</p>
              </div>
            </div>
          </div>

          {/* Connected Network Graphic Card */}
          <div className="lg:col-span-5 relative">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900/90 to-[#0D2235] border border-slate-700/80 shadow-2xl relative overflow-hidden space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-semibold text-slate-300 font-mono">LIVE NETWORK FLOW</span>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-[#3B82F6]/20 text-[#3B82F6] font-semibold border border-[#3B82F6]/30">
                  Real-Time Verification
                </span>
              </div>

              {/* Employer Node */}
              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#3B82F6]/20 text-[#3B82F6] flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">Client Employer</h4>
                    <p className="text-xs text-slate-400">Bank of Kigali / Equity / World Vision</p>
                  </div>
                </div>
                <span className="text-xs font-bold font-mono text-[#28D17C]">150 Passes Allocated</span>
              </div>

              {/* Flow Arrows */}
              <div className="flex justify-center my-[-8px]">
                <div className="w-0.5 h-8 bg-gradient-to-b from-[#3B82F6] to-[#28D17C] animate-pulse" />
              </div>

              {/* PolyFit Platform Hub Node */}
              <div className="p-4 rounded-xl bg-[#28D17C]/10 border border-[#28D17C]/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#28D17C] text-[#0B1F33] flex items-center justify-center font-bold text-base shrink-0 shadow-md">
                    <Network className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">PolyFit Network Engine</h4>
                    <p className="text-xs text-slate-300">Anti-Screenshot TOTP Access Control</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#28D17C] bg-[#28D17C]/20 px-2 py-1 rounded-md">
                  Active Sync
                </span>
              </div>

              {/* Flow Arrows Split */}
              <div className="grid grid-cols-3 gap-2 my-[-8px] px-8">
                <div className="w-0.5 h-8 bg-gradient-to-b from-[#28D17C] to-[#3B82F6] mx-auto" />
                <div className="w-0.5 h-8 bg-gradient-to-b from-[#28D17C] to-[#B8F36B] mx-auto" />
                <div className="w-0.5 h-8 bg-gradient-to-b from-[#28D17C] to-cyan-400 mx-auto" />
              </div>

              {/* Verified Venue Nodes Grid */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/80 space-y-1">
                  <Dumbbell className="w-4 h-4 mx-auto text-[#28D17C]" />
                  <p className="font-bold text-white text-[11px] truncate">WAKA Fitness</p>
                  <p className="text-[10px] text-slate-400">KimiHurura</p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/80 space-y-1">
                  <Activity className="w-4 h-4 mx-auto text-[#B8F36B]" />
                  <p className="font-bold text-white text-[11px] truncate">Cercle Sportif</p>
                  <p className="text-[10px] text-slate-400">Rugunga</p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/80 space-y-1">
                  <Zap className="w-4 h-4 mx-auto text-cyan-400" />
                  <p className="font-bold text-white text-[11px] truncate">Cali Fitness</p>
                  <p className="text-[10px] text-slate-400">Nyarutarama</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Network Coverage & Partner Showcase */}
      <section id="network" className="py-20 px-6 border-b border-slate-800 bg-[#0B1F33]">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-xs font-bold tracking-wider text-[#28D17C] uppercase">
              Curated Partner Network
            </h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              One Pass. Premier Wellness Across Kigali & Musanze.
            </p>
            <p className="text-slate-300 text-base">
              Employees seamlessly check in using dynamic TOTP passes generated inside the PolyFit Member Mobile App.
            </p>

            {/* Category Filters */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
              {["All", "Gyms", "Swimming Pools", "Tennis & Squash", "Sauna & Spa", "Yoga & Pilates"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] ${
                    selectedCategory === cat
                      ? "bg-[#28D17C] text-[#0B1F33] shadow-md shadow-[#28D17C]/20"
                      : "bg-slate-800/70 text-slate-300 border border-slate-700 hover:border-slate-500"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Partner Facilities Cards Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFacilities.map((venue) => (
              <div
                key={venue.id}
                className="rounded-2xl bg-gradient-to-b from-slate-900 to-[#0D2235] border border-slate-800 hover:border-[#28D17C]/50 transition-all p-6 space-y-4 hover:shadow-xl group"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-semibold text-[#3B82F6] px-2 py-0.5 rounded-full bg-[#3B82F6]/10 border border-[#3B82F6]/30">
                      {venue.badge}
                    </span>
                    <h3 className="text-lg font-bold text-white group-hover:text-[#28D17C] transition-colors">
                      {venue.name}
                    </h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" /> {venue.location}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-1 rounded-lg">
                      ★ {venue.rating}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <p className="text-xs font-semibold text-slate-400">Included Amenities:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {venue.features.map((feat, i) => (
                      <span key={i} className="text-[11px] px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                        {feat}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-mono font-medium">
                    <BadgeCheck className="w-4 h-4" /> Instant Relay Check-In
                  </span>
                  <span className="font-mono text-slate-400">{venue.visitsThisMonth} verified visits/mo</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trojan Horse BOH Gym SaaS Showcase */}
      <section id="saas-showcase" className="py-20 px-6 border-b border-slate-800 bg-gradient-to-b from-[#0D2235] to-[#0B1F33]">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B8F36B]/20 text-[#B8F36B] text-xs font-bold uppercase tracking-wider">
              For Venue & Gym Owners
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Free Back-of-House Gym Management & Hardware Access Infrastructure
            </h2>
            <p className="text-slate-300 text-base leading-relaxed">
              We empower local African gyms with enterprise-grade operational software at zero software cost. By placing our Trojan Horse BOH software in partner venues, PolyFit guarantees reliable check-ins, automated door relays, and guaranteed monthly corporate payouts.
            </p>

            <ul className="space-y-3 pt-2">
              {[
                "Zero-Cost Check-In & Anti-Passback Hardware Gateways",
                "Automated RWA EBM 18% VAT Accounting & Financial Settlement",
                "Guaranteed Monthly Member Payouts Direct to Bank or MoMo",
                "Point of Sale, Class Scheduling & Member CRM Operations"
              ].map((point, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-slate-200">
                  <CheckCircle2 className="w-5 h-5 text-[#28D17C] shrink-0 mt-0.5" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-6">
            <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-2xl relative">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#28D17C] text-[#0B1F33] flex items-center justify-center font-bold">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">PolyFit BOH Operations Console</h3>
                    <p className="text-xs text-slate-400">Deployed at 42+ Kigali Facilities</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-xs border border-emerald-500/20">
                  Zero Overhead
                </span>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-[#3B82F6]" />
                    <div>
                      <p className="text-sm font-bold text-white">Shelly Smart Relay Turnstile Lock</p>
                      <p className="text-xs text-slate-400">30-second Anti-Passback Cooldown Active</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-[#28D17C] font-bold">UNLOCKED</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-[#B8F36B]" />
                    <div>
                      <p className="text-sm font-bold text-white">Guaranteed B2B Monthly Settlement</p>
                      <p className="text-xs text-slate-400">Verified Visit Payout Clearing Engine</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-white font-bold">RWF 1,840,000 / mo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Corporate ROI & Tax Calculator */}
      <section id="calculator" className="py-20 px-6 border-b border-slate-800 bg-[#0B1F33]">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-xs font-bold tracking-wider text-[#3B82F6] uppercase">
              Financial Economics & Corporate Savings
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Interactive Corporate ROI & Tax Savings Calculator
            </h2>
            <p className="text-slate-300 text-base">
              Under Rwandan labor tax law, corporate employee health and wellness expenses are 100% tax-deductible as employee welfare expenditure.
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-center bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl">
            {/* Input Controls */}
            <div className="lg:col-span-6 space-y-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label htmlFor={headcountId} className="text-sm font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#28D17C]" /> Employee Headcount
                  </label>
                  <span className="text-xl font-extrabold text-[#28D17C] font-mono">{employeeCount} Employees</span>
                </div>
                <input
                  id={headcountId}
                  type="range"
                  min="10"
                  max="1000"
                  step="10"
                  value={employeeCount}
                  onChange={(e) => setEmployeeCount(Number(e.target.value))}
                  aria-label="Employee Headcount"
                  className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#28D17C]"
                />
                <div className="flex justify-between text-xs text-slate-400 font-mono">
                  <span>10 Staff</span>
                  <span>500 Staff</span>
                  <span>1,000+ Staff</span>
                </div>
              </div>

              {/* Coverage Tier Toggle */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-white block">Benefit Plan Coverage Tier</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setCoverageTier("standard")}
                    className={`p-4 rounded-xl border text-left transition-all min-h-[44px] ${
                      coverageTier === "standard"
                        ? "bg-[#28D17C]/10 border-[#28D17C] text-white"
                        : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <p className="font-bold text-sm">Standard Corporate Tier</p>
                    <p className="text-xs text-slate-400 mt-1">32,000 RWF / employee / month</p>
                  </button>
                  <button
                    onClick={() => setCoverageTier("executive")}
                    className={`p-4 rounded-xl border text-left transition-all min-h-[44px] ${
                      coverageTier === "executive"
                        ? "bg-[#3B82F6]/10 border-[#3B82F6] text-white"
                        : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <p className="font-bold text-sm">Executive All-Access</p>
                    <p className="text-xs text-slate-400 mt-1">55,000 RWF / employee / month</p>
                  </button>
                </div>
              </div>
            </div>

            {/* Calculated Output Card */}
            <div className="lg:col-span-6 bg-[#0B1F33] border border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6">
              <h3 className="text-sm font-bold text-slate-400 font-mono uppercase tracking-wider">
                Projected Corporate Benefit Economics
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="text-sm text-slate-300">Annual Gross Wellness Investment</span>
                  <span className="text-base font-bold font-mono text-white">
                    RWF {annualSpendRwf.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-[#28D17C]">
                  <span className="text-sm flex items-center gap-1.5 font-medium">
                    <Award className="w-4 h-4" /> Projected Health Claim Savings (~38%)
                  </span>
                  <span className="text-base font-bold font-mono">
                    - RWF {healthSavingsRwf.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-[#3B82F6]">
                  <span className="text-sm flex items-center gap-1.5 font-medium">
                    <ShieldCheck className="w-4 h-4" /> 30% CIT Corporate Tax Savings
                  </span>
                  <span className="text-base font-bold font-mono">
                    - RWF {taxDeductionRwf.toLocaleString()}
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 font-mono uppercase">Net Effective Corporate Cost</p>
                    <p className="text-2xl sm:text-3xl font-extrabold text-[#B8F36B] font-mono">
                      RWF {netEffectiveCostRwf.toLocaleString()} <span className="text-xs text-slate-400 font-normal">/ yr</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-[#28D17C] text-[#0B1F33] font-bold text-xs sm:text-sm px-4 py-3 rounded-xl hover:bg-[#B8F36B] transition-all shadow-md min-h-[44px]"
                  >
                    Lock In Quote
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call To Action Banner */}
      <section className="py-20 px-6 bg-gradient-to-r from-[#0B1F33] via-[#0D253E] to-[#0B1F33] text-center border-b border-slate-800">
        <div className="max-w-4xl mx-auto space-y-6">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Ready to Empower Your Workforce?
          </h2>
          <p className="text-slate-300 text-lg">
            Join Bank of Kigali, Equity Bank, World Vision, and top employers offering the PolyFit B2B Corporate Wellness Benefit.
          </p>
          <div className="pt-4 flex justify-center">
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-[#28D17C] text-[#0B1F33] hover:bg-[#B8F36B] transition-all font-bold text-base px-8 py-4 rounded-xl shadow-xl shadow-[#28D17C]/25 flex items-center gap-2 min-h-[48px]"
            >
              Schedule HR Demo & Proposals <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-[#071521] text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#28D17C] text-[#0B1F33] font-extrabold flex items-center justify-center text-base">
              P
            </div>
            <div>
              <p className="font-bold text-white text-sm">PolyFit Network Ltd</p>
              <p className="text-[11px] text-slate-500">Kigali • Musanze • Nairobi</p>
            </div>
          </div>

          <p>© {new Date().getFullYear()} PolyFit B2B Corporate Wellness Network. All rights reserved.</p>

          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-white">Admin Operations Login</Link>
            <a href="#network" className="hover:text-white">Provider Network</a>
            <a href="#calculator" className="hover:text-white">Tax Deductions</a>
          </div>
        </div>
      </footer>

      {/* Lead Capture Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs transition-all">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 sm:p-8 space-y-6 relative shadow-2xl">
            <button
              onClick={() => { setIsModalOpen(false); setFormSubmitted(false); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            {!formSubmitted ? (
              <>
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-[#28D17C]/20 text-[#28D17C] flex items-center justify-center font-bold">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Schedule PolyFit Corporate HR Demo</h3>
                  <p className="text-xs text-slate-300">
                    Get an itemized corporate proposal and tax-deductibility breakdown for your team.
                  </p>
                </div>

                <form onSubmit={handleLeadSubmit} className="space-y-4">
                  <div>
                    <label htmlFor={companyNameId} className="block text-xs font-bold text-slate-300 mb-1">Company / Organization Name</label>
                    <input
                      id={companyNameId}
                      type="text"
                      required
                      placeholder="e.g. Bank of Kigali / Equity Bank"
                      value={formData.companyName}
                      onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                      className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-[#28D17C] min-h-[44px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor={contactNameId} className="block text-xs font-bold text-slate-300 mb-1">Contact Name</label>
                      <input
                        id={contactNameId}
                        type="text"
                        required
                        placeholder="HR Director Name"
                        value={formData.contactName}
                        onChange={(e) => setFormData({...formData, contactName: e.target.value})}
                        className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-[#28D17C] min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label htmlFor={emailId} className="block text-xs font-bold text-slate-300 mb-1">Work Email</label>
                      <input
                        id={emailId}
                        type="email"
                        required
                        placeholder="name@company.rw"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-[#28D17C] min-h-[44px]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor={phoneId} className="block text-xs font-bold text-slate-300 mb-1">Phone / WhatsApp</label>
                      <input
                        id={phoneId}
                        type="text"
                        required
                        placeholder="+250 788 ..."
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-[#28D17C] min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label htmlFor={headcountModalId} className="block text-xs font-bold text-slate-300 mb-1">Employee Count</label>
                      <input
                        id={headcountModalId}
                        type="number"
                        value={formData.headcount}
                        onChange={(e) => setFormData({...formData, headcount: Number(e.target.value)})}
                        className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-[#28D17C] min-h-[44px]"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor={messageId} className="block text-xs font-bold text-slate-300 mb-1">Notes or Specific Requirements</label>
                    <textarea
                      id={messageId}
                      rows={2}
                      placeholder="Preferred start date, branch locations..."
                      value={formData.message}
                      onChange={(e) => setFormData({...formData, message: e.target.value})}
                      className="w-full px-3.5 py-2 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-[#28D17C]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#28D17C] text-[#0B1F33] hover:bg-[#B8F36B] transition-all font-bold text-sm py-3 rounded-xl shadow-md flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    {loading ? "Submitting Inquiry..." : "Submit Inquiry & Request Proposal"} <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-6 space-y-4">
                <div className="w-12 h-12 rounded-full bg-[#28D17C]/20 text-[#28D17C] flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white">Proposal Request Received!</h3>
                <p className="text-sm text-slate-300">
                  Thank you, <span className="font-bold text-white">{formData.contactName}</span>. A PolyFit B2B Executive will reach out to <span className="text-[#28D17C] font-mono">{formData.email}</span> within 2 hours with your corporate wellness proposal.
                </p>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-800 text-white hover:bg-slate-700 text-xs font-bold px-6 py-2.5 rounded-xl transition-all min-h-[44px]"
                >
                  Close Window
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
