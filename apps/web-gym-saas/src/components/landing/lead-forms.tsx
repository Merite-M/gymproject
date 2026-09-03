"use client";

import { useState, useEffect } from "react";
import { X, Building2, Dumbbell, Mail, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface LeadFormsProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: 'employer' | 'provider';
}

export default function LeadForms({ isOpen, onClose, defaultType = 'employer' }: LeadFormsProps) {
  const [formType, setFormType] = useState<'employer' | 'provider'>(defaultType);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [employerForm, setEmployerForm] = useState({
    name: '',
    organization: '',
    email: '',
    phone: '',
    employees: '',
    message: ''
  });

  const [providerForm, setProviderForm] = useState({
    name: '',
    business: '',
    location: '',
    phone: '',
    email: '',
    locations: '',
    message: ''
  });

  // Sync formType when defaultType changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setFormType(defaultType);
      setSubmitError(null);
      setFieldErrors({});
    }
  }, [defaultType, isOpen]);

  // Handle keyboard Escape to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const validateEmployerForm = () => {
    const errors: Record<string, string> = {};
    if (!employerForm.name.trim() || employerForm.name.trim().length < 2) {
      errors.name = "Please enter your full name";
    }
    if (!employerForm.organization.trim()) {
      errors.organization = "Please enter your organization name";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!employerForm.email.trim() || !emailRegex.test(employerForm.email.trim())) {
      errors.email = "Please enter a valid work email address";
    }
    const digitsOnly = employerForm.phone.replace(/\D/g, "");
    if (!employerForm.phone.trim() || digitsOnly.length < 8) {
      errors.phone = "Please enter a valid phone number (at least 8 digits)";
    }
    if (!employerForm.employees) {
      errors.employees = "Please select your company employee range";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateProviderForm = () => {
    const errors: Record<string, string> = {};
    if (!providerForm.name.trim() || providerForm.name.trim().length < 2) {
      errors.name = "Please enter your full contact name";
    }
    if (!providerForm.business.trim()) {
      errors.business = "Please enter your gym or facility business name";
    }
    if (!providerForm.location.trim()) {
      errors.location = "Please enter your facility location in Rwanda";
    }
    const digitsOnly = providerForm.phone.replace(/\D/g, "");
    if (!providerForm.phone.trim() || digitsOnly.length < 8) {
      errors.phone = "Please enter a valid phone number (at least 8 digits)";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!providerForm.email.trim() || !emailRegex.test(providerForm.email.trim())) {
      errors.email = "Please enter a valid email address";
    }
    if (!providerForm.locations) {
      errors.locations = "Please select the number of active locations";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const isValid = formType === 'employer' ? validateEmployerForm() : validateProviderForm();
    if (!isValid) {
      return;
    }

    setIsSubmitting(true);

    const payload = formType === 'employer'
      ? {
          type: 'employer',
          name: employerForm.name.trim(),
          organization: employerForm.organization.trim(),
          email: employerForm.email.trim(),
          phone: employerForm.phone.trim(),
          employees: employerForm.employees,
          message: employerForm.message.trim()
        }
      : {
          type: 'provider',
          name: providerForm.name.trim(),
          business: providerForm.business.trim(),
          location: providerForm.location.trim(),
          phone: providerForm.phone.trim(),
          email: providerForm.email.trim(),
          locations: providerForm.locations,
          message: providerForm.message.trim()
        };

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    try {
      let submissionSuccess = false;

      // 1. Try submission to primary API backend
      try {
        const response = await fetch(`${backendUrl}/api/public/lead`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          submissionSuccess = true;
        } else {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Server responded with status ${response.status}`);
        }
      } catch (apiErr) {
        console.warn("[LeadForms] Primary API endpoint error, attempting Supabase fallback:", apiErr);

        // 2. Direct Supabase Fallback
        const nameTokens = payload.name.split(/\s+/);
        const { error: sbError } = await supabase.from('leads').insert({
          first_name: nameTokens[0] || 'Lead',
          last_name: nameTokens.slice(1).join(' ') || (formType === 'employer' ? 'Corporate' : 'Provider'),
          email: payload.email,
          phone: payload.phone,
          pipeline_stage: 'inquiry',
          source: 'website_widget',
          notes: payload.message || `Inquiry from ${formType} form`,
          custom_fields: payload
        });

        if (!sbError) {
          submissionSuccess = true;
        } else {
          console.error("[LeadForms] Supabase fallback error:", sbError);
          throw new Error("Unable to submit your inquiry right now. Please try again shortly.");
        }
      }

      if (submissionSuccess) {
        setIsSubmitted(true);
        // Reset forms
        setEmployerForm({ name: '', organization: '', email: '', phone: '', employees: '', message: '' });
        setProviderForm({ name: '', business: '', location: '', phone: '', email: '', locations: '', message: '' });
        
        // Auto close after 3.5 seconds
        setTimeout(() => {
          setIsSubmitted(false);
          onClose();
        }, 3500);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong while submitting your inquiry. Please try again or contact us directly at hello@polyfit.rw.";
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const EmployerForm = () => (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="employer-name" className="block text-sm font-medium text-foreground mb-1.5">
          Full Name <span className="text-destructive">*</span>
        </label>
        <input
          id="employer-name"
          type="text"
          required
          aria-required="true"
          aria-invalid={!!fieldErrors.name}
          aria-describedby={fieldErrors.name ? "employer-name-error" : undefined}
          disabled={isSubmitting}
          value={employerForm.name}
          onChange={(e) => {
            setEmployerForm({ ...employerForm, name: e.target.value });
            if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: '' });
          }}
          className={`w-full px-4 py-3 bg-background border ${
            fieldErrors.name ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-accent'
          } rounded-lg focus:ring-2 focus:border-transparent outline-none transition-all disabled:opacity-50`}
          placeholder="e.g. Jean Claude Munyana"
        />
        {fieldErrors.name && (
          <p id="employer-name-error" className="mt-1 text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {fieldErrors.name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="employer-org" className="block text-sm font-medium text-foreground mb-1.5">
          Organization / Company Name <span className="text-destructive">*</span>
        </label>
        <input
          id="employer-org"
          type="text"
          required
          aria-required="true"
          aria-invalid={!!fieldErrors.organization}
          aria-describedby={fieldErrors.organization ? "employer-org-error" : undefined}
          disabled={isSubmitting}
          value={employerForm.organization}
          onChange={(e) => {
            setEmployerForm({ ...employerForm, organization: e.target.value });
            if (fieldErrors.organization) setFieldErrors({ ...fieldErrors, organization: '' });
          }}
          className={`w-full px-4 py-3 bg-background border ${
            fieldErrors.organization ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-accent'
          } rounded-lg focus:ring-2 focus:border-transparent outline-none transition-all disabled:opacity-50`}
          placeholder="e.g. Bank of Kigali, Irembo, etc."
        />
        {fieldErrors.organization && (
          <p id="employer-org-error" className="mt-1 text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {fieldErrors.organization}
          </p>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="employer-email" className="block text-sm font-medium text-foreground mb-1.5">
            Work Email <span className="text-destructive">*</span>
          </label>
          <input
            id="employer-email"
            type="email"
            required
            aria-required="true"
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? "employer-email-error" : undefined}
            disabled={isSubmitting}
            value={employerForm.email}
            onChange={(e) => {
              setEmployerForm({ ...employerForm, email: e.target.value });
              if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' });
            }}
            className={`w-full px-4 py-3 bg-background border ${
              fieldErrors.email ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-accent'
            } rounded-lg focus:ring-2 focus:border-transparent outline-none transition-all disabled:opacity-50`}
            placeholder="hr@company.com"
          />
          {fieldErrors.email && (
            <p id="employer-email-error" className="mt-1 text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="employer-phone" className="block text-sm font-medium text-foreground mb-1.5">
            Phone Number <span className="text-destructive">*</span>
          </label>
          <input
            id="employer-phone"
            type="tel"
            required
            aria-required="true"
            aria-invalid={!!fieldErrors.phone}
            aria-describedby={fieldErrors.phone ? "employer-phone-error" : undefined}
            disabled={isSubmitting}
            value={employerForm.phone}
            onChange={(e) => {
              setEmployerForm({ ...employerForm, phone: e.target.value });
              if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: '' });
            }}
            className={`w-full px-4 py-3 bg-background border ${
              fieldErrors.phone ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-accent'
            } rounded-lg focus:ring-2 focus:border-transparent outline-none transition-all disabled:opacity-50`}
            placeholder="+250 788 123 456"
          />
          {fieldErrors.phone && (
            <p id="employer-phone-error" className="mt-1 text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {fieldErrors.phone}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="employer-employees" className="block text-sm font-medium text-foreground mb-1.5">
          Number of Employees <span className="text-destructive">*</span>
        </label>
        <select
          id="employer-employees"
          required
          aria-required="true"
          aria-invalid={!!fieldErrors.employees}
          aria-describedby={fieldErrors.employees ? "employer-emp-error" : undefined}
          disabled={isSubmitting}
          value={employerForm.employees}
          onChange={(e) => {
            setEmployerForm({ ...employerForm, employees: e.target.value });
            if (fieldErrors.employees) setFieldErrors({ ...fieldErrors, employees: '' });
          }}
          className={`w-full px-4 py-3 bg-background border ${
            fieldErrors.employees ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-accent'
          } rounded-lg focus:ring-2 focus:border-transparent outline-none transition-all disabled:opacity-50`}
        >
          <option value="">Select workforce range</option>
          <option value="1-50">1 - 50 employees</option>
          <option value="51-200">51 - 200 employees</option>
          <option value="201-500">201 - 500 employees</option>
          <option value="500+">500+ employees</option>
        </select>
        {fieldErrors.employees && (
          <p id="employer-emp-error" className="mt-1 text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {fieldErrors.employees}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="employer-message" className="block text-sm font-medium text-foreground mb-1.5">
          Message & Wellness Objectives (Optional)
        </label>
        <textarea
          id="employer-message"
          rows={3}
          disabled={isSubmitting}
          value={employerForm.message}
          onChange={(e) => setEmployerForm({ ...employerForm, message: e.target.value })}
          className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all resize-none disabled:opacity-50"
          placeholder="Tell us about your locations, existing gym subsidies, or timeline..."
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-accent hover:bg-accent/90 text-white px-6 py-4 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-h-[52px] flex items-center justify-center gap-2 shadow-md hover:shadow-lg focus-visible:ring-2 focus-visible:ring-white"
      >
        {isSubmitting ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Submitting Inquiry...</span>
          </>
        ) : (
          <>
            <span>Request HR Consultation</span>
            <Mail className="w-5 h-5" />
          </>
        )}
      </button>
    </form>
  );

  const ProviderForm = () => (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="provider-name" className="block text-sm font-medium text-foreground mb-1.5">
          Contact Person Name <span className="text-destructive">*</span>
        </label>
        <input
          id="provider-name"
          type="text"
          required
          aria-required="true"
          aria-invalid={!!fieldErrors.name}
          aria-describedby={fieldErrors.name ? "provider-name-error" : undefined}
          disabled={isSubmitting}
          value={providerForm.name}
          onChange={(e) => {
            setProviderForm({ ...providerForm, name: e.target.value });
            if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: '' });
          }}
          className={`w-full px-4 py-3 bg-background border ${
            fieldErrors.name ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-accent'
          } rounded-lg focus:ring-2 focus:border-transparent outline-none transition-all disabled:opacity-50`}
          placeholder="e.g. Patrick Mugabo"
        />
        {fieldErrors.name && (
          <p id="provider-name-error" className="mt-1 text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {fieldErrors.name}
          </p>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="provider-business" className="block text-sm font-medium text-foreground mb-1.5">
            Gym / Studio Business Name <span className="text-destructive">*</span>
          </label>
          <input
            id="provider-business"
            type="text"
            required
            aria-required="true"
            aria-invalid={!!fieldErrors.business}
            aria-describedby={fieldErrors.business ? "provider-biz-error" : undefined}
            disabled={isSubmitting}
            value={providerForm.business}
            onChange={(e) => {
              setProviderForm({ ...providerForm, business: e.target.value });
              if (fieldErrors.business) setFieldErrors({ ...fieldErrors, business: '' });
            }}
            className={`w-full px-4 py-3 bg-background border ${
              fieldErrors.business ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-accent'
            } rounded-lg focus:ring-2 focus:border-transparent outline-none transition-all disabled:opacity-50`}
            placeholder="e.g. Cali Fitness, Kigali"
          />
          {fieldErrors.business && (
            <p id="provider-biz-error" className="mt-1 text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {fieldErrors.business}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="provider-location" className="block text-sm font-medium text-foreground mb-1.5">
            Primary Location / District <span className="text-destructive">*</span>
          </label>
          <input
            id="provider-location"
            type="text"
            required
            aria-required="true"
            aria-invalid={!!fieldErrors.location}
            aria-describedby={fieldErrors.location ? "provider-loc-error" : undefined}
            disabled={isSubmitting}
            value={providerForm.location}
            onChange={(e) => {
              setProviderForm({ ...providerForm, location: e.target.value });
              if (fieldErrors.location) setFieldErrors({ ...fieldErrors, location: '' });
            }}
            className={`w-full px-4 py-3 bg-background border ${
              fieldErrors.location ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-accent'
            } rounded-lg focus:ring-2 focus:border-transparent outline-none transition-all disabled:opacity-50`}
            placeholder="e.g. Musanze or Nyarutarama, Kigali"
          />
          {fieldErrors.location && (
            <p id="provider-loc-error" className="mt-1 text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {fieldErrors.location}
            </p>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="provider-phone" className="block text-sm font-medium text-foreground mb-1.5">
            Phone Number <span className="text-destructive">*</span>
          </label>
          <input
            id="provider-phone"
            type="tel"
            required
            aria-required="true"
            aria-invalid={!!fieldErrors.phone}
            aria-describedby={fieldErrors.phone ? "provider-phone-error" : undefined}
            disabled={isSubmitting}
            value={providerForm.phone}
            onChange={(e) => {
              setProviderForm({ ...providerForm, phone: e.target.value });
              if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: '' });
            }}
            className={`w-full px-4 py-3 bg-background border ${
              fieldErrors.phone ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-accent'
            } rounded-lg focus:ring-2 focus:border-transparent outline-none transition-all disabled:opacity-50`}
            placeholder="+250 7XX XXX XXX"
          />
          {fieldErrors.phone && (
            <p id="provider-phone-error" className="mt-1 text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {fieldErrors.phone}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="provider-email" className="block text-sm font-medium text-foreground mb-1.5">
            Contact Email <span className="text-destructive">*</span>
          </label>
          <input
            id="provider-email"
            type="email"
            required
            aria-required="true"
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? "provider-email-error" : undefined}
            disabled={isSubmitting}
            value={providerForm.email}
            onChange={(e) => {
              setProviderForm({ ...providerForm, email: e.target.value });
              if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' });
            }}
            className={`w-full px-4 py-3 bg-background border ${
              fieldErrors.email ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-accent'
            } rounded-lg focus:ring-2 focus:border-transparent outline-none transition-all disabled:opacity-50`}
            placeholder="management@facility.rw"
          />
          {fieldErrors.email && (
            <p id="provider-email-error" className="mt-1 text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {fieldErrors.email}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="provider-locations" className="block text-sm font-medium text-foreground mb-1.5">
          Number of Branches / Facilities <span className="text-destructive">*</span>
        </label>
        <select
          id="provider-locations"
          required
          aria-required="true"
          aria-invalid={!!fieldErrors.locations}
          aria-describedby={fieldErrors.locations ? "provider-locs-error" : undefined}
          disabled={isSubmitting}
          value={providerForm.locations}
          onChange={(e) => {
            setProviderForm({ ...providerForm, locations: e.target.value });
            if (fieldErrors.locations) setFieldErrors({ ...fieldErrors, locations: '' });
          }}
          className={`w-full px-4 py-3 bg-background border ${
            fieldErrors.locations ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-accent'
          } rounded-lg focus:ring-2 focus:border-transparent outline-none transition-all disabled:opacity-50`}
        >
          <option value="">Select branch count</option>
          <option value="1">1 standalone facility</option>
          <option value="2-5">2 - 5 facilities</option>
          <option value="6-10">6 - 10 facilities</option>
          <option value="10+">10+ regional facilities</option>
        </select>
        {fieldErrors.locations && (
          <p id="provider-locs-error" className="mt-1 text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {fieldErrors.locations}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="provider-message" className="block text-sm font-medium text-foreground mb-1.5">
          Facility Details (Optional)
        </label>
        <textarea
          id="provider-message"
          rows={3}
          disabled={isSubmitting}
          value={providerForm.message}
          onChange={(e) => setProviderForm({ ...providerForm, message: e.target.value })}
          className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-secondary focus:border-transparent outline-none transition-all resize-none disabled:opacity-50"
          placeholder="Tell us about amenities: swimming pool, sauna, group fitness classes, turnstile hardware..."
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-secondary hover:bg-secondary/90 text-white px-6 py-4 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-h-[52px] flex items-center justify-center gap-2 shadow-md hover:shadow-lg focus-visible:ring-2 focus-visible:ring-white"
      >
        {isSubmitting ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Registering Venue...</span>
          </>
        ) : (
          <>
            <span>Join the Provider Network</span>
            <Dumbbell className="w-5 h-5" />
          </>
        )}
      </button>
    </form>
  );

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-200 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-modal-title"
    >
      <div 
        className="bg-background border border-border rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto transform transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-card/40">
          <div className="flex items-center gap-3">
            {formType === 'employer' ? (
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-accent" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                <Dumbbell className="w-5 h-5 text-secondary" />
              </div>
            )}
            <div>
              <h2 id="lead-modal-title" className="text-xl font-bold text-foreground leading-tight">
                {formType === 'employer' ? 'Talk to PolyFit' : 'Join Provider Network'}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formType === 'employer' 
                  ? 'Schedule corporate demo & ROI assessment'
                  : 'Receive corporate wellness members & free BOH software'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Submit Error Banner */}
          {submitError && (
            <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Submission failed</p>
                <p className="text-destructive/90 text-xs mt-1">{submitError}</p>
              </div>
              <button 
                onClick={() => setSubmitError(null)} 
                className="text-destructive hover:opacity-75 p-1"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {isSubmitted ? (
            <div className="text-center py-10 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">
                Inquiry Received!
              </h3>
              <p className="text-muted-foreground max-w-sm mx-auto text-sm leading-relaxed">
                Thank you for connecting with PolyFit. Our East African corporate wellness team will contact you within 1-2 business days.
              </p>
              <div className="mt-6">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-muted hover:bg-muted/80 text-foreground font-medium rounded-lg text-sm transition-colors"
                >
                  Close Window
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Form Type Toggle */}
              <div className="flex gap-2 mb-6 p-1 bg-muted/60 rounded-xl" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={formType === 'employer'}
                  onClick={() => {
                    setFormType('employer');
                    setSubmitError(null);
                    setFieldErrors({});
                  }}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                    formType === 'employer'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-accent" />
                  <span>I am an Employer</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={formType === 'provider'}
                  onClick={() => {
                    setFormType('provider');
                    setSubmitError(null);
                    setFieldErrors({});
                  }}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                    formType === 'provider'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Dumbbell className="w-4 h-4 text-secondary" />
                  <span>Fitness Provider</span>
                </button>
              </div>

              {formType === 'employer' ? <EmployerForm /> : <ProviderForm />}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-card/30">
          <p className="text-xs text-muted-foreground text-center">
            By submitting, you agree to our{" "}
            <a href="/privacy" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
              Privacy Policy
            </a>
            . Your information is protected under Rwandan Law No 058/2021.
          </p>
        </div>
      </div>
    </div>
  );
}