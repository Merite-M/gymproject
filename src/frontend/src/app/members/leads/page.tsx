"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  GitBranch,
  Gift,
  Code2,
  Plus,
  Search,
  Filter,
  Calendar,
  Phone,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  ArrowRight,
  Copy,
  Check,
  Flame,
  Award,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Tag,
  AlertCircle
} from "lucide-react";
import { cn, formatCurrencyDisplay } from "@/lib/utils";

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone: string;
  pipeline_stage: 'inquiry' | 'tour_scheduled' | 'trial_active' | 'trial_expired' | 'closed_won' | 'closed_lost';
  stage_entered_at: string;
  days_in_stage: number;
  source: string;
  tour_date?: string | null;
  trial_start_date?: string | null;
  trial_end_date?: string | null;
  assigned_staff?: { id: string; first_name: string; last_name: string } | null;
  referred_by?: { id: string; first_name: string; last_name: string; referral_code?: string } | null;
  referral_code_used?: string | null;
  notes?: string | null;
}

interface ReferralRecord {
  id: string;
  referrer: { id: string; first_name: string; last_name: string; phone?: string; referral_code?: string };
  referee_lead?: { id: string; first_name: string; last_name: string; pipeline_stage?: string } | null;
  referee_profile?: { id: string; first_name: string; last_name: string } | null;
  referral_code: string;
  status: 'pending' | 'converted' | 'rewarded' | 'expired';
  reward_amount_rwf: number;
  reward_voucher?: { id: string; code: string; current_balance_rwf: number; expires_at: string } | null;
  created_at: string;
}

export default function LeadsPipelinePage() {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'referrals' | 'widgets'>('pipeline');
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Modals state
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [selectedLeadForTransition, setSelectedLeadForTransition] = useState<Lead | null>(null);
  const [targetStage, setTargetStage] = useState<string>('tour_scheduled');
  const [transitionTourDate, setTransitionTourDate] = useState("");
  const [transitionTrialDays, setTransitionTrialDays] = useState(7);
  const [transitionLostReason, setTransitionLostReason] = useState("");
  const [transitionNotes, setTransitionNotes] = useState("");

  // New Lead form state
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newStage, setNewStage] = useState("inquiry");
  const [newSource, setNewSource] = useState("web_widget");
  const [newRefCode, setNewRefCode] = useState("");
  const [newTourDate, setNewTourDate] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Widget preview settings
  const [widgetMode, setWidgetMode] = useState<'schedule' | 'join'>('schedule');
  const [widgetColor, setWidgetColor] = useState('#2563eb');
  const [widgetTenantId, setWidgetTenantId] = useState("00000000-0000-0000-0000-000000000000");

  // Simulated Mock Leads for offline/interactive rich UI demonstration
  const [leads, setLeads] = useState<Lead[]>([
    {
      id: "lead-1",
      first_name: "Jean-Paul",
      last_name: "Habimana",
      phone: "+250 788 111 222",
      email: "jeanpaul@kigalitech.rw",
      pipeline_stage: "inquiry",
      stage_entered_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      days_in_stage: 1,
      source: "web_widget",
      referred_by: { id: "p-1", first_name: "Alice", last_name: "Johnson", referral_code: "GP-ALI920" },
      referral_code_used: "GP-ALI920",
      notes: "Interested in HIIT classes and evening weights"
    },
    {
      id: "lead-2",
      first_name: "Chantal",
      last_name: "Uwase",
      phone: "+250 788 333 444",
      email: "chantal.u@gmail.com",
      pipeline_stage: "tour_scheduled",
      stage_entered_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      days_in_stage: 2,
      source: "referral",
      tour_date: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
      referred_by: { id: "p-2", first_name: "Eric", last_name: "Mugisha", referral_code: "GP-ERI441" },
      referral_code_used: "GP-ERI441",
      notes: "Requested VIP tour with a personal trainer"
    },
    {
      id: "lead-3",
      first_name: "David",
      last_name: "Kwizera",
      phone: "+250 788 555 666",
      email: "david.k@outlook.com",
      pipeline_stage: "trial_active",
      stage_entered_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      days_in_stage: 4,
      source: "web_widget",
      trial_start_date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      trial_end_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: "7-Day VIP Trial active. Attended 2 spinning sessions."
    },
    {
      id: "lead-4",
      first_name: "Grace",
      last_name: "Mukamana",
      phone: "+250 788 777 888",
      email: "grace.muka@yahoo.com",
      pipeline_stage: "trial_expired",
      stage_entered_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      days_in_stage: 1,
      source: "walk_in",
      trial_start_date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      trial_end_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: "Trial ended yesterday. Drip SMS sent with 15% discount."
    },
    {
      id: "lead-5",
      first_name: "Patrick",
      last_name: "Ndayisaba",
      phone: "+250 788 999 000",
      email: "patrick@innovate.rw",
      pipeline_stage: "closed_won",
      stage_entered_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      days_in_stage: 3,
      source: "web_widget",
      referred_by: { id: "p-1", first_name: "Alice", last_name: "Johnson", referral_code: "GP-ALI920" },
      referral_code_used: "GP-ALI920",
      notes: "Converted to Premium Annual Membership. Referral reward voucher REF-8849 issued to Alice Johnson."
    }
  ]);

  // Referrals Mock Data
  const [referrals, setReferrals] = useState<ReferralRecord[]>([
    {
      id: "ref-1",
      referrer: { id: "p-1", first_name: "Alice", last_name: "Johnson", phone: "+250 788 123 456", referral_code: "GP-ALI920" },
      referee_lead: { id: "lead-5", first_name: "Patrick", last_name: "Ndayisaba", pipeline_stage: "closed_won" },
      referral_code: "GP-ALI920",
      status: "rewarded",
      reward_amount_rwf: 10000,
      reward_voucher: { id: "v-1", code: "REF-8849", current_balance_rwf: 10000, expires_at: new Date(Date.now() + 85 * 24 * 60 * 60 * 1000).toISOString() },
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "ref-2",
      referrer: { id: "p-2", first_name: "Eric", last_name: "Mugisha", phone: "+250 788 234 567", referral_code: "GP-ERI441" },
      referee_lead: { id: "lead-2", first_name: "Chantal", last_name: "Uwase", pipeline_stage: "tour_scheduled" },
      referral_code: "GP-ERI441",
      status: "pending",
      reward_amount_rwf: 10000,
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "ref-3",
      referrer: { id: "p-1", first_name: "Alice", last_name: "Johnson", phone: "+250 788 123 456", referral_code: "GP-ALI920" },
      referee_lead: { id: "lead-1", first_name: "Jean-Paul", last_name: "Habimana", pipeline_stage: "inquiry" },
      referral_code: "GP-ALI920",
      status: "pending",
      reward_amount_rwf: 10000,
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    }
  ]);

  // Fetch real backend leads if online
  useEffect(() => {
    async function loadData() {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000000';
        setWidgetTenantId(tenantId);

        const res = await fetch(`${backendUrl}/api/members/leads?tenant_id=${tenantId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.leads && data.leads.length > 0) {
            setLeads(data.leads);
          }
        }

        const refRes = await fetch(`${backendUrl}/api/members/referrals/list?tenant_id=${tenantId}`);
        if (refRes.ok) {
          const refData = await refRes.json();
          if (refData.referrals && refData.referrals.length > 0) {
            setReferrals(refData.referrals);
          }
        }
      } catch (err) {
        console.log("Using local interactive leads store");
      }
    }
    loadData();
  }, []);

  // Filter leads
  const filteredLeads = leads.filter(l => {
    const matchesSearch = searchQuery === "" ||
      `${l.first_name} ${l.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.phone.includes(searchQuery) ||
      (l.email && l.email.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSource = sourceFilter === "all" || l.source === sourceFilter;
    return matchesSearch && matchesSource;
  });

  const stages = [
    { id: 'inquiry', name: 'Inquiry', color: 'border-amber-500/50 bg-amber-500/5', badge: 'bg-amber-500/20 text-amber-600 dark:text-amber-400' },
    { id: 'tour_scheduled', name: 'Tour Scheduled', color: 'border-blue-500/50 bg-blue-500/5', badge: 'bg-blue-500/20 text-blue-600 dark:text-blue-400' },
    { id: 'trial_active', name: 'Trial Active', color: 'border-emerald-500/50 bg-emerald-500/5', badge: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' },
    { id: 'trial_expired', name: 'Trial Expired', color: 'border-purple-500/50 bg-purple-500/5', badge: 'bg-purple-500/20 text-purple-600 dark:text-purple-400' },
    { id: 'closed_won', name: 'Closed Won 🎉', color: 'border-teal-500/50 bg-teal-500/5', badge: 'bg-teal-500/20 text-teal-600 dark:text-teal-400' },
    { id: 'closed_lost', name: 'Closed Lost', color: 'border-rose-500/50 bg-rose-500/5', badge: 'bg-rose-500/20 text-rose-600 dark:text-rose-400' },
  ];

  // Stage transition handler
  const handleTransitionStage = async () => {
    if (!selectedLeadForTransition) return;

    const leadId = selectedLeadForTransition.id;
    const oldStage = selectedLeadForTransition.pipeline_stage;
    const now = new Date().toISOString();

    // Optimistic update
    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        return {
          ...l,
          pipeline_stage: targetStage as any,
          stage_entered_at: now,
          days_in_stage: 0,
          tour_date: targetStage === 'tour_scheduled' && transitionTourDate ? new Date(transitionTourDate).toISOString() : l.tour_date,
          trial_start_date: targetStage === 'trial_active' ? now.split('T')[0] : l.trial_start_date,
          trial_end_date: targetStage === 'trial_active' ? new Date(Date.now() + transitionTrialDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : l.trial_end_date,
          notes: transitionNotes ? `${l.notes || ''} | ${transitionNotes}` : l.notes
        };
      }
      return l;
    }));

    // If converting to closed_won and had referrer, mark referral as rewarded
    if (targetStage === 'closed_won' && selectedLeadForTransition.referred_by) {
      setReferrals(prev => prev.map(r => {
        if (r.referee_lead?.id === leadId) {
          return {
            ...r,
            status: 'rewarded',
            reward_voucher: {
              id: `v-${Date.now()}`,
              code: `REF-${Math.floor(1000 + Math.random() * 9000)}`,
              current_balance_rwf: 10000,
              expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
            }
          };
        }
        return r;
      }));
    }

    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000000';
      await fetch(`${backendUrl}/api/members/leads/${leadId}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          stage: targetStage,
          tour_date: transitionTourDate || undefined,
          trial_days: transitionTrialDays,
          lost_reason: transitionLostReason || undefined,
          notes: transitionNotes || undefined
        })
      });
    } catch (e) {
      console.log("Stage transition recorded locally");
    }

    setSelectedLeadForTransition(null);
    setTransitionTourDate("");
    setTransitionNotes("");
    setTransitionLostReason("");
  };

  // Add lead handler
  const handleAddLead = async () => {
    if (!newFirstName || !newLastName || !newPhone) return;

    const newLeadObj: Lead = {
      id: `lead-${Date.now()}`,
      first_name: newFirstName,
      last_name: newLastName,
      phone: newPhone,
      email: newEmail || null,
      pipeline_stage: newStage as any,
      stage_entered_at: new Date().toISOString(),
      days_in_stage: 0,
      source: newSource,
      tour_date: newTourDate ? new Date(newTourDate).toISOString() : null,
      referral_code_used: newRefCode || null,
      notes: newNotes || null
    };

    setLeads(prev => [newLeadObj, ...prev]);

    if (newRefCode) {
      setReferrals(prev => [
        {
          id: `ref-${Date.now()}`,
          referrer: { id: "p-manual", first_name: "Community", last_name: "Referrer", referral_code: newRefCode.toUpperCase() },
          referee_lead: { id: newLeadObj.id, first_name: newFirstName, last_name: newLastName, pipeline_stage: newStage },
          referral_code: newRefCode.toUpperCase(),
          status: 'pending',
          reward_amount_rwf: 10000,
          created_at: new Date().toISOString()
        },
        ...prev
      ]);
    }

    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000000';
      await fetch(`${backendUrl}/api/members/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          first_name: newFirstName,
          last_name: newLastName,
          phone: newPhone,
          email: newEmail,
          pipeline_stage: newStage,
          source: newSource,
          tour_date: newTourDate || undefined,
          referral_code_used: newRefCode || undefined,
          notes: newNotes || undefined
        })
      });
    } catch (e) {
      console.log("Lead created locally");
    }

    setShowAddLeadModal(false);
    setNewFirstName("");
    setNewLastName("");
    setNewPhone("");
    setNewEmail("");
    setNewRefCode("");
    setNewNotes("");
  };

  // Metrics
  const totalLeads = leads.length;
  const activeTrials = leads.filter(l => l.pipeline_stage === 'trial_active').length;
  const closedWonCount = leads.filter(l => l.pipeline_stage === 'closed_won').length;
  const totalRewardedVouchers = referrals.filter(r => r.status === 'rewarded').length;
  const totalVouchersValueRWF = referrals.filter(r => r.status === 'rewarded').reduce((s, r) => s + r.reward_amount_rwf, 0);
  const conversionRate = totalLeads > 0 ? ((closedWonCount / totalLeads) * 100).toFixed(1) : "0";

  // Widget Embed Snippets
  const scriptSnippet = `<!-- GymPartner Embeddable ${widgetMode === 'schedule' ? 'Tour Booking' : 'Member Join'} Widget -->
<div id="gympartner-widget" data-tenant-id="${widgetTenantId}" data-mode="${widgetMode}"></div>
<script src="https://gym-backend-core.onrender.com/api/public/widget.js" async></script>`;

  const reactSnippet = `// React / Next.js Component Embed
import { useEffect } from "react";

export function GymPartnerEmbed() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://gym-backend-core.onrender.com/api/public/widget.js";
    script.setAttribute("data-tenant-id", "${widgetTenantId}");
    script.setAttribute("data-mode", "${widgetMode}");
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return <div id="gympartner-widget" className="my-6 max-w-md mx-auto" />;
}`;

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider mb-1">
              <span>Sales & Marketing Engine</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Sparkles className="w-3.5 h-3.5" /> AI Drip Active
              </span>
            </div>
            <h1 className="text-2xl font-bold font-headline tracking-tight text-foreground flex items-center gap-2">
              Lead Pipeline & Referral Automation
            </h1>
          </div>

          {/* Quick Actions & Navigation Tabs */}
          <div className="flex items-center gap-3">
            <div className="flex bg-muted p-1 rounded-lg border border-border">
              <button
                onClick={() => setActiveTab('pipeline')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 min-h-[36px]",
                  activeTab === 'pipeline' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <GitBranch className="w-4 h-4" /> Pipeline Stages
              </button>
              <button
                onClick={() => setActiveTab('referrals')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 min-h-[36px]",
                  activeTab === 'referrals' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Gift className="w-4 h-4" /> Referral Engine ({referrals.length})
              </button>
              <button
                onClick={() => setActiveTab('widgets')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 min-h-[36px]",
                  activeTab === 'widgets' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Code2 className="w-4 h-4" /> Web Widgets
              </button>
            </div>

            <button
              onClick={() => setShowAddLeadModal(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-lg text-xs flex items-center gap-2 shadow-sm transition min-h-[44px]"
            >
              <Plus className="w-4 h-4" /> Add Sales Lead
            </button>
          </div>
        </div>

        {/* High-level KPI summary bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mt-4 pt-3 border-t border-border/50 text-xs">
          <div className="bg-card p-3 rounded-lg border border-border">
            <span className="text-muted-foreground block text-[11px]">Total Pipeline Leads</span>
            <span className="text-lg font-bold text-foreground">{totalLeads}</span>
          </div>
          <div className="bg-card p-3 rounded-lg border border-border">
            <span className="text-muted-foreground block text-[11px]">Active 7-Day Trials</span>
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{activeTrials} active</span>
          </div>
          <div className="bg-card p-3 rounded-lg border border-border">
            <span className="text-muted-foreground block text-[11px]">Closed Won (Conversions)</span>
            <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{closedWonCount} ({conversionRate}%)</span>
          </div>
          <div className="bg-card p-3 rounded-lg border border-border">
            <span className="text-muted-foreground block text-[11px]">Referral Bonuses Issued</span>
            <span className="text-lg font-bold text-purple-600 dark:text-purple-400">{totalRewardedVouchers} vouchers</span>
          </div>
          <div className="bg-card p-3 rounded-lg border border-border col-span-2 sm:col-span-1">
            <span className="text-muted-foreground block text-[11px]">Referral Value Distributed</span>
            <span className="text-lg font-bold text-foreground">{formatCurrencyDisplay(totalVouchersValueRWF)}</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="px-6 py-6 max-w-[1600px] mx-auto">
        {/* ======================================================== */}
        {/* TAB 1: KANBAN PIPELINE STAGES BOARD                      */}
        {/* ======================================================== */}
        {activeTab === 'pipeline' && (
          <div className="space-y-6">
            {/* Filters Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-3 rounded-xl border border-border">
              <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search leads by name, phone, or email..."
                    className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="bg-background border border-border rounded-lg px-2.5 py-2 text-xs outline-none"
                  >
                    <option value="all">All Sources</option>
                    <option value="web_widget">Web Widget</option>
                    <option value="referral">Member Referral</option>
                    <option value="walk_in">Walk-in Desk</option>
                    <option value="social_media">Social Media</option>
                  </select>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Showing <strong className="text-foreground">{filteredLeads.length}</strong> sales leads
              </div>
            </div>

            {/* Kanban Columns Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-start overflow-x-auto pb-4">
              {stages.map((stage) => {
                const stageLeads = filteredLeads.filter(l => l.pipeline_stage === stage.id);

                return (
                  <div
                    key={stage.id}
                    className={cn(
                      "rounded-xl border flex flex-col min-h-[540px] bg-card shadow-sm transition-all",
                      stage.color
                    )}
                  >
                    {/* Stage Header */}
                    <div className="p-3 border-b border-border/60 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-foreground font-headline">{stage.name}</span>
                        <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-bold", stage.badge)}>
                          {stageLeads.length}
                        </span>
                      </div>
                    </div>

                    {/* Cards Container */}
                    <div className="p-2.5 space-y-2.5 flex-1 overflow-y-auto max-h-[700px]">
                      {stageLeads.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground/60 text-xs italic">
                          No leads in stage
                        </div>
                      ) : (
                        stageLeads.map((lead) => (
                          <div
                            key={lead.id}
                            className="bg-background border border-border/80 hover:border-primary/50 hover:shadow-md p-3 rounded-lg text-xs space-y-2 transition-all group"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div>
                                <h4 className="font-bold text-foreground text-sm leading-tight">
                                  {lead.first_name} {lead.last_name}
                                </h4>
                                <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mt-0.5">
                                  <Phone className="w-3 h-3 text-primary" />
                                  <span>{lead.phone}</span>
                                </div>
                              </div>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" /> {lead.days_in_stage}d
                              </span>
                            </div>

                            {lead.email && (
                              <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                                <Mail className="w-3 h-3" />
                                <span className="truncate">{lead.email}</span>
                              </div>
                            )}

                            {/* Referral attribution tag */}
                            {lead.referral_code_used && (
                              <div className="flex items-center gap-1 text-[11px] bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded font-medium">
                                <Gift className="w-3 h-3" />
                                <span>Ref: <strong>{lead.referral_code_used}</strong></span>
                              </div>
                            )}

                            {/* Tour or Trial info tags */}
                            {lead.tour_date && (
                              <div className="flex items-center gap-1 text-[11px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded font-medium">
                                <Calendar className="w-3 h-3" />
                                <span>Tour: {new Date(lead.tour_date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            )}

                            {lead.trial_end_date && (
                              <div className="flex items-center gap-1 text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded font-medium">
                                <Flame className="w-3 h-3" />
                                <span>Trial ends: {lead.trial_end_date}</span>
                              </div>
                            )}

                            {lead.notes && (
                              <p className="text-[11px] text-muted-foreground bg-muted/50 p-1.5 rounded line-clamp-2">
                                {lead.notes}
                              </p>
                            )}

                            {/* Advance Stage Trigger Action Buttons */}
                            <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-1">
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                                {lead.source}
                              </span>
                              <button
                                onClick={() => {
                                  setSelectedLeadForTransition(lead);
                                  // Default next sensible stage
                                  if (stage.id === 'inquiry') setTargetStage('tour_scheduled');
                                  else if (stage.id === 'tour_scheduled') setTargetStage('trial_active');
                                  else if (stage.id === 'trial_active') setTargetStage('closed_won');
                                  else if (stage.id === 'trial_expired') setTargetStage('closed_won');
                                  else setTargetStage('closed_won');
                                }}
                                className="px-2 py-1 bg-muted hover:bg-primary hover:text-primary-foreground rounded text-[11px] font-semibold transition flex items-center gap-1 min-h-[28px]"
                              >
                                <span>Move Stage</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: MEMBER REFERRAL ENGINE & REWARDS HUB              */}
        {/* ======================================================== */}
        {activeTab === 'referrals' && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
                <div>
                  <h2 className="text-xl font-bold font-headline flex items-center gap-2">
                    <Gift className="w-5 h-5 text-primary" /> Member Referral Engine & Voucher Fulfillment
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Every active member gets an automated unique referral code. When a referee signs up or wins conversion, a RWF 10,000 gift voucher is automatically minted.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-semibold">
                    Standard Reward: <strong>RWF 10,000 Voucher</strong> / Conversion
                  </div>
                </div>
              </div>

              {/* Referrals Directory Table */}
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-muted-foreground font-semibold">
                      <th className="py-3 px-4">Referrer (Member)</th>
                      <th className="py-3 px-4">Referral Code</th>
                      <th className="py-3 px-4">Referee (Lead / Member)</th>
                      <th className="py-3 px-4">Attribution Status</th>
                      <th className="py-3 px-4">Reward Amount</th>
                      <th className="py-3 px-4">Gift Voucher Code</th>
                      <th className="py-3 px-4">Date Tracked</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {referrals.map((ref) => (
                      <tr key={ref.id} className="hover:bg-muted/30 transition">
                        <td className="py-3.5 px-4 font-semibold text-foreground">
                          {ref.referrer.first_name} {ref.referrer.last_name}
                          {ref.referrer.phone && (
                            <span className="block text-[11px] text-muted-foreground font-normal">
                              {ref.referrer.phone}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-primary">
                          {ref.referral_code}
                        </td>
                        <td className="py-3.5 px-4 text-foreground">
                          {ref.referee_lead ? `${ref.referee_lead.first_name} ${ref.referee_lead.last_name}` :
                           ref.referee_profile ? `${ref.referee_profile.first_name} ${ref.referee_profile.last_name}` : 'Prospective Lead'}
                          {ref.referee_lead?.pipeline_stage && (
                            <span className="block text-[10px] text-muted-foreground uppercase font-medium">
                              Stage: {ref.referee_lead.pipeline_stage.replace('_', ' ')}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {ref.status === 'rewarded' ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center gap-1 w-fit">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Rewarded
                            </span>
                          ) : ref.status === 'converted' ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center gap-1 w-fit">
                              <Award className="w-3.5 h-3.5" /> Converted (Fulfilling)
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center gap-1 w-fit">
                              <Clock className="w-3.5 h-3.5" /> Pending Referee Conversion
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-foreground">
                          {formatCurrencyDisplay(ref.reward_amount_rwf)}
                        </td>
                        <td className="py-3.5 px-4">
                          {ref.reward_voucher ? (
                            <span className="font-mono bg-muted px-2 py-1 rounded border border-border text-foreground font-semibold flex items-center gap-1.5 w-fit">
                              <Tag className="w-3 h-3 text-purple-500" />
                              {ref.reward_voucher.code}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic text-[11px]">Unissued</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground text-[11px]">
                          {new Date(ref.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: EMBEDDABLE PUBLIC WEB WIDGETS STUDIO             */}
        {/* ======================================================== */}
        {activeTab === 'widgets' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Configuration & Code Generator (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-xl font-bold font-headline flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-primary" /> Embeddable Web Registration & Booking Widgets
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Embed unauthenticated booking and signup widgets on gym websites (WordPress, Squarespace, Webflow, custom HTML). Prospective members and referrals are fed straight into your lead pipeline.
                </p>

                {/* Mode Selector */}
                <div className="mt-6 space-y-4">
                  <label className="block text-xs font-semibold text-foreground">Widget Action Mode</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setWidgetMode('schedule')}
                      className={cn(
                        "p-4 rounded-xl border text-left transition",
                        widgetMode === 'schedule'
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border bg-background hover:border-border/80"
                      )}
                    >
                      <span className="font-bold text-sm block text-foreground">Book VIP Tour / Pass</span>
                      <span className="text-[11px] text-muted-foreground">Prospective lead schedules a gym tour or trial class</span>
                    </button>

                    <button
                      onClick={() => setWidgetMode('join')}
                      className={cn(
                        "p-4 rounded-xl border text-left transition",
                        widgetMode === 'join'
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border bg-background hover:border-border/80"
                      )}
                    >
                      <span className="font-bold text-sm block text-foreground">Online Membership Sign-up</span>
                      <span className="text-[11px] text-muted-foreground">Select membership plan, apply promo & referral vouchers</span>
                    </button>
                  </div>
                </div>

                {/* Color Customizer */}
                <div className="mt-6 flex items-center gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">Brand Accent Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={widgetColor}
                        onChange={(e) => setWidgetColor(e.target.value)}
                        className="w-8 h-8 rounded border border-border cursor-pointer p-0.5"
                      />
                      <span className="font-mono text-xs text-muted-foreground uppercase">{widgetColor}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">Tenant Project ID</label>
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded border border-border text-foreground block">
                      {widgetTenantId}
                    </span>
                  </div>
                </div>
              </div>

              {/* Code Snippets Box */}
              <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Copy className="w-4 h-4 text-primary" /> Standalone HTML Script Snippet
                  </h3>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(scriptSnippet);
                      setCopiedSnippet(true);
                      setTimeout(() => setCopiedSnippet(false), 2000);
                    }}
                    className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-semibold rounded text-xs flex items-center gap-1.5 min-h-[32px] transition"
                  >
                    {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedSnippet ? "Copied to Clipboard!" : "Copy HTML Code"}
                  </button>
                </div>
                <pre className="p-4 bg-muted/80 rounded-lg text-xs font-mono overflow-x-auto text-foreground border border-border">
                  {scriptSnippet}
                </pre>

                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-sm text-foreground">React / Next.js Component Snippet</h3>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(reactSnippet);
                        setCopiedCode(true);
                        setTimeout(() => setCopiedCode(false), 2000);
                      }}
                      className="text-xs text-primary hover:underline font-semibold"
                    >
                      {copiedCode ? "Copied!" : "Copy React Code"}
                    </button>
                  </div>
                  <pre className="p-4 bg-muted/80 rounded-lg text-xs font-mono overflow-x-auto text-foreground border border-border">
                    {reactSnippet}
                  </pre>
                </div>
              </div>
            </div>

            {/* Right: Live Interactive Widget Simulator (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" /> Live Interactive Simulator
                </h3>
                <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded font-mono">
                  Preview Mode
                </span>
              </div>

              {/* Simulated Widget Card */}
              <div className="p-6 bg-surface rounded-2xl border border-border shadow-xl space-y-5 bg-card">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div>
                    <h3 className="text-base font-bold text-foreground">GymPartner Kigali</h3>
                    <p className="text-[11px] text-muted-foreground">Operations & Fitness Center</p>
                  </div>
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
                    style={{ backgroundColor: widgetColor }}
                  >
                    {widgetMode === 'schedule' ? 'VIP Tour Pass' : 'Online Registration'}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground mb-1">First Name</label>
                      <input
                        type="text"
                        placeholder="John"
                        className="w-full p-2.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Last Name</label>
                      <input
                        type="text"
                        placeholder="Doe"
                        className="w-full p-2.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">WhatsApp Phone Number</label>
                    <input
                      type="tel"
                      placeholder="+250 788 123 456"
                      className="w-full p-2.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Email (Optional)</label>
                    <input
                      type="email"
                      placeholder="john@example.com"
                      className="w-full p-2.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary"
                    />
                  </div>

                  {widgetMode === 'schedule' ? (
                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Preferred Tour Date</label>
                      <input
                        type="datetime-local"
                        className="w-full p-2.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Membership Plan</label>
                      <select className="w-full p-2.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary">
                        <option value="standard">Standard (RWF 30,000 / mo)</option>
                        <option value="premium">Premium All-Access (RWF 50,000 / mo)</option>
                        <option value="vip">VIP Executive (RWF 80,000 / mo)</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Friend Referral Code (Optional)</label>
                    <div className="relative">
                      <Tag className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="e.g. GP-ALI920"
                        className="w-full pl-9 pr-3 p-2.5 bg-background border border-border rounded-lg text-xs uppercase font-mono outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <button
                    style={{ backgroundColor: widgetColor }}
                    className="w-full text-white font-bold py-3 px-4 rounded-xl text-sm transition shadow-md hover:opacity-90 min-h-[44px] mt-2"
                  >
                    {widgetMode === 'schedule' ? 'Book Free VIP Pass' : 'Complete Registration'}
                  </button>

                  <p className="text-[10px] text-center text-muted-foreground pt-1">
                    Powered by GymPartner Operations Cloud • SSL Secure
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* MODAL: ADVANCE PIPELINE STAGE                            */}
      {/* ======================================================== */}
      {selectedLeadForTransition && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-base font-headline text-foreground flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-primary" /> Advance Lead Stage: {selectedLeadForTransition.first_name} {selectedLeadForTransition.last_name}
              </h3>
              <button
                onClick={() => setSelectedLeadForTransition(null)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">Target Pipeline Stage</label>
                <select
                  value={targetStage}
                  onChange={(e) => setTargetStage(e.target.value)}
                  className="w-full p-2.5 bg-background border border-border rounded-lg text-xs outline-none"
                >
                  <option value="inquiry">Inquiry (Initial interest)</option>
                  <option value="tour_scheduled">Tour Scheduled (VIP Pass)</option>
                  <option value="trial_active">Trial Active (7-Day Trial)</option>
                  <option value="trial_expired">Trial Expired (Drip Offer)</option>
                  <option value="closed_won">Closed Won 🎉 (Convert to Member + Fulfill Referral)</option>
                  <option value="closed_lost">Closed Lost (Archive)</option>
                </select>
              </div>

              {targetStage === 'tour_scheduled' && (
                <div>
                  <label className="block font-semibold text-foreground mb-1">Scheduled Tour Date & Time</label>
                  <input
                    type="datetime-local"
                    value={transitionTourDate}
                    onChange={(e) => setTransitionTourDate(e.target.value)}
                    className="w-full p-2.5 bg-background border border-border rounded-lg text-xs outline-none"
                  />
                </div>
              )}

              {targetStage === 'trial_active' && (
                <div>
                  <label className="block font-semibold text-foreground mb-1">Trial Duration (Days)</label>
                  <input
                    type="number"
                    value={transitionTrialDays}
                    onChange={(e) => setTransitionTrialDays(parseInt(e.target.value) || 7)}
                    className="w-full p-2.5 bg-background border border-border rounded-lg text-xs outline-none"
                  />
                </div>
              )}

              {targetStage === 'closed_lost' && (
                <div>
                  <label className="block font-semibold text-foreground mb-1">Reason for Lost Lead</label>
                  <input
                    type="text"
                    value={transitionLostReason}
                    onChange={(e) => setTransitionLostReason(e.target.value)}
                    placeholder="e.g. Relocating, price too high, no response"
                    className="w-full p-2.5 bg-background border border-border rounded-lg text-xs outline-none"
                  />
                </div>
              )}

              {targetStage === 'closed_won' && selectedLeadForTransition.referred_by && (
                <div className="bg-purple-500/10 border border-purple-500/30 p-3 rounded-lg text-purple-700 dark:text-purple-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Gift className="w-4 h-4" /> Automatic Referral Voucher Minting
                  </div>
                  <p className="text-[11px]">
                    This lead was referred by <strong>{selectedLeadForTransition.referred_by.first_name} {selectedLeadForTransition.referred_by.last_name}</strong> ({selectedLeadForTransition.referred_by.referral_code}). A RWF 10,000 gift voucher will be generated and dispatched automatically via SMS!
                  </p>
                </div>
              )}

              <div>
                <label className="block font-semibold text-foreground mb-1">Transition Log Notes</label>
                <textarea
                  value={transitionNotes}
                  onChange={(e) => setTransitionNotes(e.target.value)}
                  placeholder="Add notes about conversations, coach assignments, or workout preferences..."
                  rows={2}
                  className="w-full p-2.5 bg-background border border-border rounded-lg text-xs outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button
                onClick={() => setSelectedLeadForTransition(null)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg text-xs min-h-[40px]"
              >
                Cancel
              </button>
              <button
                onClick={handleTransitionStage}
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg text-xs min-h-[40px] shadow-sm transition"
              >
                Apply Stage Transition
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD NEW SALES LEAD                                */}
      {/* ======================================================== */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-base font-headline text-foreground flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" /> Create New Sales Lead
              </h3>
              <button
                onClick={() => setShowAddLeadModal(false)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">First Name *</label>
                  <input
                    type="text"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="Jean"
                    className="w-full p-2.5 bg-background border border-border rounded-lg text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="Kagabo"
                    className="w-full p-2.5 bg-background border border-border rounded-lg text-xs outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+250 788 000 000"
                    className="w-full p-2.5 bg-background border border-border rounded-lg text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1">Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="jean@example.com"
                    className="w-full p-2.5 bg-background border border-border rounded-lg text-xs outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">Pipeline Stage</label>
                  <select
                    value={newStage}
                    onChange={(e) => setNewStage(e.target.value)}
                    className="w-full p-2.5 bg-background border border-border rounded-lg text-xs outline-none"
                  >
                    <option value="inquiry">Inquiry</option>
                    <option value="tour_scheduled">Tour Scheduled</option>
                    <option value="trial_active">Trial Active</option>
                    <option value="closed_won">Closed Won</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1">Lead Source</label>
                  <select
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value)}
                    className="w-full p-2.5 bg-background border border-border rounded-lg text-xs outline-none"
                  >
                    <option value="web_widget">Web Widget</option>
                    <option value="referral">Member Referral</option>
                    <option value="walk_in">Walk-in</option>
                    <option value="social_media">Social Media</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Friend Referral Code (Optional)</label>
                <input
                  type="text"
                  value={newRefCode}
                  onChange={(e) => setNewRefCode(e.target.value.toUpperCase())}
                  placeholder="e.g. GP-ALI920"
                  className="w-full p-2.5 bg-background border border-border rounded-lg text-xs font-mono uppercase outline-none"
                />
              </div>

              {newStage === 'tour_scheduled' && (
                <div>
                  <label className="block font-semibold text-foreground mb-1">Scheduled Tour Date</label>
                  <input
                    type="datetime-local"
                    value={newTourDate}
                    onChange={(e) => setNewTourDate(e.target.value)}
                    className="w-full p-2.5 bg-background border border-border rounded-lg text-xs outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-foreground mb-1">Notes</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Goals, target programs, questions..."
                  rows={2}
                  className="w-full p-2.5 bg-background border border-border rounded-lg text-xs outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button
                onClick={() => setShowAddLeadModal(false)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg text-xs min-h-[40px]"
              >
                Cancel
              </button>
              <button
                onClick={handleAddLead}
                disabled={!newFirstName || !newLastName || !newPhone}
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg text-xs min-h-[40px] shadow-sm transition disabled:opacity-50"
              >
                Save Lead
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
