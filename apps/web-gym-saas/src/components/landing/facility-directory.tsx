"use client";

import { useState } from "react";
import { Dumbbell, Waves, Trophy, Sparkles, HeartHandshake, MapPin, CheckCircle2 } from "lucide-react";

export default function FacilityDirectory() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeCity, setActiveCity] = useState<string>("all");

  const categories = [
    { id: "all", label: "All Facilities", icon: Dumbbell },
    { id: "gym", label: "Gyms & Fitness", icon: Dumbbell },
    { id: "pool", label: "Swimming Pools", icon: Waves },
    { id: "tennis", label: "Tennis Courts", icon: Trophy },
    { id: "spa", label: "Sauna & Spa", icon: Sparkles },
    { id: "yoga", label: "Yoga & Wellness", icon: HeartHandshake },
  ];

  const cities = [
    { id: "all", label: "All Locations" },
    { id: "kigali", label: "Kigali" },
    { id: "musanze", label: "Musanze" },
    { id: "nairobi", label: "Nairobi (Coming Soon)" },
  ];

  const facilities = [
    {
      name: "WAKA Fitness Kimihurura",
      city: "kigali",
      cityLabel: "Kigali, Kimihurura",
      category: "gym",
      categoryLabel: "Gym & Functional Training",
      image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=600",
      features: ["Strength & Cardio", "Group Classes", "Sauna"],
      verified: true,
    },
    {
      name: "Cercle Sportif de Kigali (CSK)",
      city: "kigali",
      cityLabel: "Kigali, Rugunga",
      category: "tennis",
      categoryLabel: "Tennis & Multi-Sport Complex",
      image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&q=80&w=600",
      features: ["Clay Tennis Courts", "Olympic Pool", "Gym"],
      verified: true,
    },
    {
      name: "Cali Fitness & Pool",
      city: "musanze",
      cityLabel: "Musanze, Town Center",
      category: "gym",
      categoryLabel: "Fitness & Swimming",
      image: "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&q=80&w=600",
      features: ["Free Weights", "Heated Pool", "Personal Trainers"],
      verified: true,
    },
    {
      name: "Heaven Wellness & Spa",
      city: "kigali",
      cityLabel: "Kigali, Kiyovu",
      category: "spa",
      categoryLabel: "Spa, Sauna & Wellness",
      image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&q=80&w=600",
      features: ["Finnish Sauna", "Steam Baths", "Massage Therapy"],
      verified: true,
    },
    {
      name: "Inzu Eco Yoga Lodge",
      city: "musanze",
      cityLabel: "Musanze, Kinigi Corridor",
      category: "yoga",
      categoryLabel: "Yoga & Mindfulness",
      image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=600",
      features: ["Outdoor Deck", "Guided Yoga", "Meditation"],
      verified: true,
    },
    {
      name: "Nyarutarama Tennis & Swim Club",
      city: "kigali",
      cityLabel: "Kigali, Nyarutarama",
      category: "pool",
      categoryLabel: "Swimming & Sports",
      image: "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&q=80&w=600",
      features: ["Lap Swimming", "Floodlit Courts", "Café Lounge"],
      verified: true,
    },
  ];

  const filteredFacilities = facilities.filter((f) => {
    const matchesCat = activeCategory === "all" || f.category === activeCategory;
    const matchesCity = activeCity === "all" || f.city === activeCity;
    return matchesCat && matchesCity;
  });

  return (
    <section id="facility-directory" className="py-16 sm:py-24 bg-white text-[#0B1F33] border-t border-gray-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#059669] mb-2">
            A Network Without Borders
          </p>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#0B1F33]">
            Verified Partner Facilities Across East Africa
          </h2>
          <p className="text-sm sm:text-lg text-gray-600 mt-3 leading-relaxed">
            Your team gets seamless, digital check-in access to top gyms, swimming pools, tennis courts, and spas.
          </p>
        </div>

        {/* Filters Row */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-10 pb-6 border-b border-gray-100">
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2 justify-center md:justify-start">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                    isActive
                      ? "bg-[#0B1F33] text-white shadow-sm"
                      : "bg-[#F7F9FC] text-gray-600 hover:bg-gray-100 border border-gray-200/80"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[#28D17C]" : "text-gray-400"}`} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* City Filter Dropdown / Pills */}
          <div className="flex items-center gap-1.5 bg-[#F7F9FC] border border-gray-200 p-1 rounded-xl">
            {cities.map((city) => {
              const isActive = activeCity === city.id;
              return (
                <button
                  key={city.id}
                  onClick={() => setActiveCity(city.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive ? "bg-white text-[#059669] shadow-sm" : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {city.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Directory Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFacilities.map((facility, index) => (
            <div
              key={index}
              className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-[#059669]/40 transition-all group flex flex-col justify-between"
            >
              <div>
                {/* Image & Badge Header */}
                <div className="relative h-48 w-full overflow-hidden bg-gray-100">
                  <img
                    src={facility.image}
                    alt={facility.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 left-3 bg-[#0B1F33]/90 text-white backdrop-blur-md px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 shadow">
                    <MapPin className="w-3 h-3 text-[#28D17C]" />
                    <span>{facility.cityLabel}</span>
                  </div>
                  {facility.verified && (
                    <div className="absolute top-3 right-3 bg-white/95 text-[#059669] backdrop-blur-md px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 shadow">
                      <CheckCircle2 className="w-3 h-3 text-[#059669]" />
                      <span>PolyFit Verified</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5">
                  <p className="text-xs font-semibold text-[#059669] uppercase tracking-wider mb-1">
                    {facility.categoryLabel}
                  </p>
                  <h3 className="text-lg font-bold text-[#0B1F33] mb-3 group-hover:text-[#059669] transition-colors">
                    {facility.name}
                  </h3>

                  {/* Feature Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {facility.features.map((feat, idx) => (
                      <span
                        key={idx}
                        className="bg-[#F7F9FC] text-gray-600 border border-gray-200/80 px-2.5 py-1 rounded-md text-[11px] font-medium"
                      >
                        {feat}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-5 pb-5 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 font-medium">
                <span>Digital Check-in Active</span>
                <span className="text-[#059669] font-bold">Included in Corporate Tier</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
