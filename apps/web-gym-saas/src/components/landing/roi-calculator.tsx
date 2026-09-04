"use client";

import { useState } from "react";
import { Calculator, Users, ShieldCheck, ArrowRight, Sparkles, Building2 } from "lucide-react";

interface RoiCalculatorProps {
  onOpenLeadForm?: (type: 'employer' | 'provider') => void;
}

export default function RoiCalculator({ onOpenLeadForm }: RoiCalculatorProps) {
  const [employees, setEmployees] = useState<number>(120);
  const [budgetPerEmployee, setBudgetPerEmployee] = useState<number>(45000); // RWF per month

  // Pure budget projections (No cooked ROI / fake multipliers)
  const monthlyTotalRwf = employees * budgetPerEmployee;
  const annualTotalRwf = monthlyTotalRwf * 12;

  const formatRwf = (num: number) => {
    return new Intl.NumberFormat("en-RW", {
      style: "currency",
      currency: "RWF",
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <section id="roi-calculator" className="py-16 sm:py-24 bg-gradient-to-b from-[#F7F9FC] to-white text-[#0B1F33] border-t border-gray-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 bg-[#28D17C]/10 text-[#059669] px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive Corporate Budget Planning</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#0B1F33]">
            Plan Your Corporate Wellness Allowance
          </h2>
          <p className="text-sm sm:text-lg text-gray-600 mt-3 sm:mt-4 leading-relaxed">
            Estimate your annual corporate fitness investment with clear, transparent pricing based on employee headcount and flexible monthly allowances.
          </p>
        </div>

        {/* Calculator Grid */}
        <div className="grid lg:grid-cols-12 gap-8 items-stretch max-w-6xl mx-auto">
          {/* Controls Card */}
          <div className="lg:col-span-6 bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-[#28D17C]/10 flex items-center justify-center text-[#059669]">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-[#0B1F33]">Budget Inputs</h3>
                  <p className="text-xs text-gray-500">Adjust team headcount and monthly allowance per employee</p>
                </div>
              </div>

              {/* Slider 1: Employee Count */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-semibold text-[#0B1F33] flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    Employee Headcount
                  </label>
                  <span className="text-base font-bold text-[#059669] bg-[#28D17C]/10 px-3 py-1 rounded-lg">
                    {employees} Employees
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="1000"
                  step="5"
                  value={employees}
                  onChange={(e) => setEmployees(Number(e.target.value))}
                  className="w-full h-2.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#059669]"
                />
                <div className="flex justify-between text-[11px] text-gray-400 mt-1.5 font-medium">
                  <span>10 employees</span>
                  <span>500</span>
                  <span>1,000+ employees</span>
                </div>
              </div>

              {/* Slider 2: Monthly Budget per Employee */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-semibold text-[#0B1F33] flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    Monthly Allowance / Employee
                  </label>
                  <span className="text-base font-bold text-[#059669] bg-[#28D17C]/10 px-3 py-1 rounded-lg">
                    {formatRwf(budgetPerEmployee)} / mo
                  </span>
                </div>
                <input
                  type="range"
                  min="20000"
                  max="150000"
                  step="5000"
                  value={budgetPerEmployee}
                  onChange={(e) => setBudgetPerEmployee(Number(e.target.value))}
                  className="w-full h-2.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#059669]"
                />
                <div className="flex justify-between text-[11px] text-gray-400 mt-1.5 font-medium">
                  <span>RWF 20,000</span>
                  <span>RWF 75,000</span>
                  <span>RWF 150,000</span>
                </div>
              </div>
            </div>

            {/* Total Spend Summary Box */}
            <div className="mt-6 bg-[#F7F9FC] border border-gray-200/80 rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Estimated Monthly Investment</p>
                <p className="text-xl font-extrabold text-[#0B1F33]">{formatRwf(monthlyTotalRwf)}</p>
              </div>
              <span className="text-xs font-semibold text-gray-600 bg-white border border-gray-200 px-2.5 py-1 rounded-md">
                Unified Invoicing
              </span>
            </div>
          </div>

          {/* Results Display Card */}
          <div className="lg:col-span-6 bg-[#0B1F33] text-white rounded-2xl p-6 sm:p-8 shadow-xl flex flex-col justify-between relative overflow-hidden">
            {/* Ambient Background Accent */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#28D17C]/10 rounded-full blur-3xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
                <span className="text-xs font-bold uppercase tracking-widest text-[#28D17C]">
                  Investment Summary
                </span>
                <span className="text-xs font-medium bg-white/10 text-gray-200 px-2.5 py-1 rounded-full">
                  12-Month Projection
                </span>
              </div>

              {/* Metric 1 */}
              <div className="mb-6">
                <p className="text-xs font-medium text-gray-400 mb-1">Total Projected Annual Commitment</p>
                <p className="text-3xl sm:text-4xl font-extrabold text-[#28D17C]">
                  {formatRwf(annualTotalRwf)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Covers full network access for all {employees} eligible team members.
                </p>
              </div>

              {/* Key Features Breakdown */}
              <div className="space-y-3 border-t border-white/10 pt-6 mb-6">
                <div className="flex items-start gap-2.5 text-xs text-gray-300">
                  <ShieldCheck className="w-4 h-4 text-[#28D17C] flex-shrink-0 mt-0.5" />
                  <span>Single corporate contract with consolidated monthly billing</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-gray-300">
                  <ShieldCheck className="w-4 h-4 text-[#28D17C] flex-shrink-0 mt-0.5" />
                  <span>Digital check-in tracking across all partner gyms & wellness centers</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-gray-300">
                  <ShieldCheck className="w-4 h-4 text-[#28D17C] flex-shrink-0 mt-0.5" />
                  <span>Flexible allocation & admin reporting for HR teams</span>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={() => onOpenLeadForm?.('employer')}
              aria-label="Talk to us to receive a custom proposal"
              className="w-full bg-[#28D17C] hover:bg-[#28D17C]/90 text-[#0B1F33] py-4 rounded-xl font-bold text-sm transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-[#28D17C]/20"
            >
              <span>Talk to Us for a Custom Proposal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
