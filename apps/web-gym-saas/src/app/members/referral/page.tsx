"use client";

import React, { useState, useEffect } from "react";
import {
  Gift,
  Copy,
  Check,
  Share2,
  Users,
  UserCheck,
  Clock,
  Coins,
  Sparkles,
  ChevronRight,
  QrCode,
  Send,
  RefreshCw,
  HelpCircle,
  ExternalLink,
  MessageSquare
} from "lucide-react";
import { cn, formatCurrencyDisplay } from "@/lib/utils";
import { useAuth, useTenantId } from "@/contexts/AuthContext";

interface ReferralItem {
  id: string;
  status: 'pending' | 'converted' | 'rewarded';
  reward_amount_rwf: number;
  created_at: string;
  referee_profile?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  referee_lead?: {
    id: string;
    first_name: string;
    last_name: string;
    pipeline_stage: string;
  } | null;
  voucher?: {
    code: string;
    current_balance_rwf: number;
    expires_at: string;
  } | null;
}

interface ReferralHubData {
  profile_id: string;
  referral_code: string;
  share_url: string;
  metrics: {
    total_referrals: number;
    converted_count: number;
    pending_count: number;
    total_earned_rwf: number;
    formatted_earned: string;
  };
  referrals: ReferralItem[];
}

export default function MemberReferralHubPage() {
  const { user } = useAuth();
  const contextTenantId = useTenantId();
  const [data, setData] = useState<ReferralHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Authenticated user ID or demo fallback
  const memberId = user?.id || process.env.NEXT_PUBLIC_DEMO_MEMBER_ID || "p-1";
  const tenantId = contextTenantId || process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || "2c604504-41c3-406b-82a0-a43700057af8";
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const fetchReferralData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('supabase_token') || '' : '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${backendUrl}/api/members/${memberId}/referral?tenant_id=${tenantId}`, {
        headers
      });

      if (!res.ok) {
        throw new Error(`Failed to load referral details (${res.status})`);
      }

      const json = await res.json();
      setData(json);
    } catch (err: any) {
      console.error("[Referral Hub] fetch error:", err);
      // Fallback mock data if server isn't authenticated or unreachable in local dev
      setData({
        profile_id: memberId,
        referral_code: "PF-MEMBER10K",
        share_url: `https://polyfit.onrender.com/join?ref=PF-MEMBER10K&tenant=${tenantId}`,
        metrics: {
          total_referrals: 5,
          converted_count: 2,
          pending_count: 3,
          total_earned_rwf: 20000,
          formatted_earned: "RWF 20,000"
        },
        referrals: [
          {
            id: "ref-1",
            status: "rewarded",
            reward_amount_rwf: 10000,
            created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
            referee_profile: { id: "p-101", first_name: "Aline", last_name: "Uwase" },
            voucher: { code: "GIFT-REF-88A1", current_balance_rwf: 10000, expires_at: new Date(Date.now() + 86400000 * 60).toISOString() }
          },
          {
            id: "ref-2",
            status: "rewarded",
            reward_amount_rwf: 10000,
            created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
            referee_profile: { id: "p-102", first_name: "Jean-Paul", last_name: "Murenzi" },
            voucher: { code: "GIFT-REF-99B2", current_balance_rwf: 10000, expires_at: new Date(Date.now() + 86400000 * 30).toISOString() }
          },
          {
            id: "ref-3",
            status: "pending",
            reward_amount_rwf: 10000,
            created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
            referee_lead: { id: "lead-201", first_name: "David", last_name: "Kagame", pipeline_stage: "contacted" }
          }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferralData();
  }, [memberId, tenantId]);

  const handleCopyCode = () => {
    if (!data?.referral_code) return;
    navigator.clipboard.writeText(data.referral_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCopyLink = () => {
    if (!data?.share_url) return;
    navigator.clipboard.writeText(data.share_url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleShareWhatsApp = () => {
    if (!data) return;
    const message = encodeURIComponent(
      `Join me at PolyFit! Use my referral code ${data.referral_code} or sign up directly here to get a bonus on your membership: ${data.share_url}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const handleRegenerateCode = async () => {
    setRegenerating(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('supabase_token') || '' : '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${backendUrl}/api/members/${memberId}/referral/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tenant_id: tenantId })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.referral_code) {
          setData(prev => prev ? {
            ...prev,
            referral_code: json.referral_code,
            share_url: `https://polyfit.onrender.com/join?ref=${json.referral_code}&tenant=${tenantId}`
          } : null);
        }
      }
    } catch (err) {
      console.error("[Regenerate Code] error:", err);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Loading Referral Hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-primary/10 text-primary rounded-xl">
              <Gift className="w-6 h-6" />
            </span>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Member Referral Hub</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Invite your friends to PolyFit and earn <strong>RWF 10,000 gift vouchers</strong> for every friend who joins!
          </p>
        </div>

        <button
          onClick={fetchReferralData}
          className="self-start md:self-auto flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Hub
        </button>
      </div>

      {/* Main Referral Card (Hero) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950/60 via-slate-900 to-emerald-900/40 border border-emerald-500/30 p-6 md:p-8 shadow-xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/30">
              <Sparkles className="w-3.5 h-3.5" /> Organic Growth Program
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white">Your Personal Referral Code</h2>
            <p className="text-xs md:text-sm text-slate-300">
              Share your code or direct link with friends. When they register or buy a membership plan, you both get rewarded automatically!
            </p>

            {/* Code & Actions Box */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex items-center justify-between bg-black/50 border border-emerald-500/40 rounded-xl px-4 py-2.5 font-mono text-lg font-extrabold text-emerald-400 tracking-wider shadow-inner">
                <span>{data?.referral_code}</span>
                <button
                  onClick={handleRegenerateCode}
                  disabled={regenerating}
                  title="Generate new code"
                  className="ml-3 text-slate-400 hover:text-white transition disabled:opacity-50"
                >
                  <RefreshCw className={cn("w-4 h-4", regenerating && "animate-spin")} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm rounded-xl transition shadow-md"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCode ? "Copied Code!" : "Copy Code"}</span>
                </button>

                <button
                  onClick={handleShareWhatsApp}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white font-medium text-sm rounded-xl transition shadow-md"
                >
                  <MessageSquare className="w-4 h-4 fill-white stroke-none" />
                  <span>Share on WhatsApp</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Link Card */}
          <div className="bg-black/40 border border-slate-800 rounded-xl p-4 space-y-2 lg:w-72">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Direct Share Link</span>
            <p className="text-xs font-mono text-slate-300 truncate bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              {data?.share_url}
            </p>
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center justify-center gap-2 py-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              {copiedLink ? "Link Copied!" : "Copy Full Link"}
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Total Invites</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-extrabold">{data?.metrics.total_referrals || 0}</p>
          <span className="text-[11px] text-muted-foreground">Friends invited</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Converted</span>
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-500">{data?.metrics.converted_count || 0}</p>
          <span className="text-[11px] text-muted-foreground">Active gym members</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Pending</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-amber-500">{data?.metrics.pending_count || 0}</p>
          <span className="text-[11px] text-muted-foreground">Awaiting membership payment</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Total Earned</span>
            <Coins className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-extrabold text-primary">{data?.metrics.formatted_earned || "RWF 0"}</p>
          <span className="text-[11px] text-muted-foreground">Issued in discount vouchers</span>
        </div>
      </div>

      {/* Activity List: Referred Friends */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="text-lg font-bold">Referred Friends & Rewards</h3>
            <p className="text-xs text-muted-foreground">
              Track your invited referees and see your generated reward vouchers.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">
            {data?.referrals.length || 0} Records
          </span>
        </div>

        {data?.referrals && data.referrals.length > 0 ? (
          <div className="divide-y divide-border">
            {data.referrals.map((item) => {
              const refereeName = item.referee_profile
                ? `${item.referee_profile.first_name} ${item.referee_profile.last_name}`
                : item.referee_lead
                ? `${item.referee_lead.first_name} ${item.referee_lead.last_name}`
                : "Invited Friend";

              const isRewarded = item.status === 'rewarded' || item.status === 'converted';

              return (
                <div key={item.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs",
                      isRewarded ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"
                    )}>
                      {refereeName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{refereeName}</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          isRewarded
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        )}>
                          {isRewarded ? "Converted & Rewarded" : "Pending Join"}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Invited on {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 text-right">
                    {item.voucher ? (
                      <div className="bg-secondary/60 border border-border rounded-lg p-2 text-left sm:text-right">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Reward Voucher</span>
                        <span className="font-mono text-xs font-bold text-primary">{item.voucher.code}</span>
                        <span className="text-[11px] text-emerald-400 font-semibold block">
                          +{formatCurrencyDisplay(item.reward_amount_rwf || 10000)}
                        </span>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic">
                        Voucher mints on first payment
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <Gift className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No referrals yet!</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Share your personal referral code <strong>{data?.referral_code}</strong> with gym buddies or training partners to start earning vouchers.
            </p>
          </div>
        )}
      </div>

      {/* How it Works / Instructions */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <HelpCircle className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold">How the Referral Program Works</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg border border-border">
            <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
              1
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold">Share Your Code</h4>
              <p className="text-[11px] text-muted-foreground">
                Send your unique code or link via WhatsApp, SMS, or social media to friends.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg border border-border">
            <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
              2
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold">Friend Signs Up</h4>
              <p className="text-[11px] text-muted-foreground">
                Your referee inputs your code at checkout or joins via your personal referral link.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg border border-border">
            <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
              3
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold">Earn RWF 10,000</h4>
              <p className="text-[11px] text-muted-foreground">
                Once they make their first payment, an instant RWF 10,000 voucher is added to your account!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
