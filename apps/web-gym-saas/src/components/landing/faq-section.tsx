"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface FAQSectionProps {
  onOpenLeadForm?: (type: 'employer' | 'provider') => void;
}

export default function FAQSection({ onOpenLeadForm }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "What is PolyFit?",
      answer: "PolyFit is a corporate fitness network connecting organizations, employees, and participating fitness providers through a single corporate benefit."
    },
    {
      question: "Who can use PolyFit?",
      answer: "Employees whose organizations participate in a PolyFit plan can access participating providers according to their company's plan."
    },
    {
      question: "Can employees choose different gyms?",
      answer: "That's the core idea. PolyFit enables eligible employees to access multiple participating providers rather than being limited to a single facility, subject to their employer's plan."
    },
    {
      question: "How do gyms get paid?",
      answer: "PolyFit is developing a verified usage and settlement system that enables transparent reconciliation and prompt disbursements between participating providers and organizations."
    },
    {
      question: "Is PolyFit available across Rwanda?",
      answer: "PolyFit is initially building dense local provider networks starting in Musanze and Kigali before expanding to additional regions."
    },
    {
      question: "How can my company join?",
      answer: "Contact our team to discuss your organization's employee wellness objectives, headcount, and preferred local facilities."
    }
  ];

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-16 sm:py-24 bg-white text-[#0B1F33] border-t border-gray-200/60">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#28D17C] mb-2">
            Common Questions
          </p>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#0B1F33]">
            Frequently Asked Questions
          </h2>
          <p className="text-sm sm:text-lg text-gray-600 mt-3 sm:mt-4">
            Everything you need to know about the PolyFit corporate network.
          </p>
        </div>

        <div className="space-y-3 sm:space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-[#F7F9FC] border border-gray-200/80 rounded-[14px] overflow-hidden transition-all duration-150"
            >
              <button
                id={`faq-btn-${index}`}
                onClick={() => toggleFAQ(index)}
                aria-controls={`faq-answer-${index}`}
                aria-expanded={openIndex === index}
                className="w-full px-5 sm:px-6 py-4 sm:py-5 text-left flex items-center justify-between hover:bg-gray-100/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#28D17C]"
              >
                <span className="font-semibold text-[#0B1F33] text-sm sm:text-base pr-4">
                  {faq.question}
                </span>
                {openIndex === index ? (
                  <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                )}
              </button>

              {openIndex === index && (
                <div
                  id={`faq-answer-${index}`}
                  role="region"
                  aria-labelledby={`faq-btn-${index}`}
                  className="px-5 sm:px-6 pb-4 sm:pb-5 pt-0"
                >
                  <p className="text-gray-600 text-xs sm:text-sm leading-relaxed border-t border-gray-200/40 pt-3">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 sm:mt-12 text-center">
          <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
            Still have questions about corporate partnerships or joining as a gym?
          </p>
          <button
            onClick={() => onOpenLeadForm?.('employer')}
            aria-label="Contact PolyFit team"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#0B1F33] hover:text-[#28D17C] underline underline-offset-4 transition-colors"
          >
            Talk to our team →
          </button>
        </div>
      </div>
    </section>
  );
}
