"use client";

import { useState } from "react";
import PublicNavigation from "@/components/public-navigation";
import Hero from "@/components/landing/hero";
import CredibilityStrip from "@/components/landing/credibility-strip";
import ProblemSection from "@/components/landing/problem-section";
import SolutionSection from "@/components/landing/solution-section";
import HowItWorks from "@/components/landing/how-it-works";
import ForCompanies from "@/components/landing/for-companies";
import ForProviders from "@/components/landing/for-providers";
import NetworkSection from "@/components/landing/network-section";
import FacilityDirectory from "@/components/landing/facility-directory";
import RoiCalculator from "@/components/landing/roi-calculator";
import AboutSection from "@/components/landing/about-section";
import FAQSection from "@/components/landing/faq-section";
import EarlyAccessCTA from "@/components/landing/early-access-cta";
import Footer from "@/components/landing/footer";
import LeadForms from "@/components/landing/lead-forms";

export default function Home() {
  const [isLeadFormOpen, setIsLeadFormOpen] = useState(false);
  const [leadFormType, setLeadFormType] = useState<'employer' | 'provider'>('employer');

  const openLeadForm = (type: 'employer' | 'provider') => {
    setLeadFormType(type);
    setIsLeadFormOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#0B1F33] selection:bg-[#28D17C]/20 selection:text-[#0B1F33]">
      <PublicNavigation onOpenLeadForm={openLeadForm} />
      
      <main id="main-content">
        <Hero onOpenLeadForm={openLeadForm} />
        <CredibilityStrip />
        <ProblemSection />
        <SolutionSection />
        <HowItWorks />
        <RoiCalculator onOpenLeadForm={openLeadForm} />
        <FacilityDirectory />
        <ForCompanies onOpenLeadForm={openLeadForm} />
        <ForProviders onOpenLeadForm={openLeadForm} />
        <NetworkSection />
        <AboutSection />
        <FAQSection onOpenLeadForm={openLeadForm} />
        <EarlyAccessCTA onOpenLeadForm={openLeadForm} />
      </main>
      
      <Footer onOpenLeadForm={openLeadForm} />
      
      <LeadForms 
        isOpen={isLeadFormOpen} 
        onClose={() => setIsLeadFormOpen(false)}
        defaultType={leadFormType}
      />
    </div>
  );
}
