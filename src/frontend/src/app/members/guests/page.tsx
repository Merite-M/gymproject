"use client";

import { useState, useEffect } from "react";
import { useAuth, useTenantId } from "@/contexts/AuthContext";
import { fetchMemberGuestPasses, issueMemberGuestPass, GuestPass } from "@/lib/api/members";
import {
  Ticket,
  UserPlus,
  QrCode,
  Copy,
  Check,
  MessageSquare,
  Clock,
  CheckCircle2,
  Users
} from "lucide-react";

export default function MemberGuestPassesPage() {
  const { user } = useAuth();
  const tenantId = useTenantId();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passesData, setPassesData] = useState<{
    allowance: number;
    used: number;
    remaining: number;
    passes: GuestPass[];
  } | null>(null);

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [newlyIssuedPass, setNewlyIssuedPass] = useState<GuestPass | null>(null);

  const [copiedPassCode, setCopiedPassCode] = useState<string | null>(null);

  const loadData = async () => {
    if (!user?.id || !tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMemberGuestPasses(user.id, tenantId);
      if (res.success) {
        setPassesData({
          allowance: res.allowance,
          used: res.used,
          remaining: res.remaining,
          passes: res.passes
        });
      }
    } catch (err: any) {
      console.error("Failed to load guest passes:", err);
      setError(err.message || "Failed to load guest pass allotment");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id, tenantId]);

  const handleIssuePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !tenantId) return;
    setSubmitting(true);
    try {
      const res = await issueMemberGuestPass(user.id, {
        tenant_id: tenantId,
        guest_name: guestName || undefined,
        guest_phone: guestPhone || undefined,
        guest_email: guestEmail || undefined
      });
      if (res.success && res.pass) {
        setNewlyIssuedPass(res.pass);
        setIsModalOpen(false);
        setGuestName("");
        setGuestPhone("");
        setGuestEmail("");
        loadData();
      }
    } catch (err: any) {
      alert(err.message || "Failed to issue guest pass");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedPassCode(code);
    setTimeout(() => setCopiedPassCode(null), 2500);
  };

  const handleShareWhatsApp = (pass: GuestPass) => {
    const text = `Hi${pass.guest_name ? ` ${pass.guest_name}` : ""}! Here is your official VIP Guest Pass to workout with me at the gym. Pass Code: ${pass.pass_code}. Redeem at front desk check-in!`;
    const url = `https://wa.me/${pass.guest_phone ? pass.guest_phone.replace(/[^0-9]/g, '') : ''}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading guest pass allotment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/30 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
              <Ticket className="w-3.5 h-3.5" />
              <span>VIP Guest Allotment</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Bring a Workout Buddy</h1>
            <p className="text-sm text-muted-foreground">
              Share your monthly guest pass allowance with friends and family. Your guest gets full facility entry for the day!
            </p>
          </div>

          <div className="flex flex-col items-stretch sm:items-end gap-3">
            <button
              onClick={() => { setNewlyIssuedPass(null); setIsModalOpen(true); }}
              disabled={(passesData?.remaining || 0) <= 0}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:bg-primary/90 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserPlus className="w-4 h-4" />
              <span>Issue Guest Pass</span>
            </button>
            <span className="text-xs text-muted-foreground text-center sm:text-right">
              {(passesData?.remaining || 0) > 0
                ? `${passesData?.remaining} passes remaining this month`
                : "All guest passes used for this period"}
            </span>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Total Monthly Pass Allotment</span>
            <Ticket className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-extrabold">{passesData?.allowance || 0}</p>
          <span className="text-[11px] text-muted-foreground">Passes per billing cycle</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Passes Issued / Used</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-amber-500">{passesData?.used || 0}</p>
          <span className="text-[11px] text-muted-foreground">Claimed by guests</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Remaining Allotment</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-500">{passesData?.remaining || 0}</p>
          <span className="text-[11px] text-muted-foreground">Ready to share</span>
        </div>
      </div>

      {/* Newly Issued Pass Card (Success State) */}
      {newlyIssuedPass && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>Guest Pass Created Successfully!</span>
            </div>
            <button
              onClick={() => setNewlyIssuedPass(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-card p-4 rounded-lg border border-border">
            <div className="space-y-1 text-center md:text-left">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Pass Code</span>
              <p className="text-2xl font-mono font-bold text-primary tracking-wider">{newlyIssuedPass.pass_code}</p>
              {newlyIssuedPass.guest_name && (
                <p className="text-xs text-muted-foreground">Issued for: {newlyIssuedPass.guest_name}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopyCode(newlyIssuedPass.pass_code)}
                className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-xs font-semibold hover:bg-secondary/80 transition"
              >
                {copiedPassCode === newlyIssuedPass.pass_code ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPassCode === newlyIssuedPass.pass_code ? "Copied!" : "Copy Code"}</span>
              </button>
              <button
                onClick={() => handleShareWhatsApp(newlyIssuedPass)}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-500 transition shadow"
              >
                <MessageSquare className="w-3.5 h-3.5 fill-white stroke-none" />
                <span>Send WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Passes List */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="text-lg font-bold">Your Active & Redeemed Guest Passes</h3>
            <p className="text-xs text-muted-foreground">Manage digital invitations issued to your workout partners.</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">
            {passesData?.passes.length || 0} Passes
          </span>
        </div>

        {passesData?.passes && passesData.passes.length > 0 ? (
          <div className="divide-y divide-border">
            {passesData.passes.map((pass) => (
              <div key={pass.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-foreground">{pass.pass_code}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        pass.status === 'active' ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' :
                        pass.status === 'redeemed' ? 'bg-blue-500/15 text-blue-500 border border-blue-500/30' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {pass.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {pass.guest_name ? `Guest: ${pass.guest_name}` : "Unassigned Guest Pass"}
                      {pass.guest_phone ? ` (${pass.guest_phone})` : ""}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Created: {new Date(pass.created_at).toLocaleDateString()} • Expires: {new Date(pass.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:justify-end">
                  {pass.status === 'active' && (
                    <>
                      <button
                        onClick={() => handleCopyCode(pass.pass_code)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-xs font-medium hover:bg-secondary/80 transition"
                      >
                        {copiedPassCode === pass.pass_code ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedPassCode === pass.pass_code ? "Copied" : "Copy Code"}</span>
                      </button>
                      <button
                        onClick={() => handleShareWhatsApp(pass)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-500 transition"
                      >
                        <MessageSquare className="w-3.5 h-3.5 fill-white stroke-none" />
                        <span>WhatsApp</span>
                      </button>
                    </>
                  )}
                  {pass.status === 'redeemed' && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                      Redeemed on {new Date(pass.redeemed_at!).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <Users className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No guest passes issued yet</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Click &quot;Issue Guest Pass&quot; above to invite a workout buddy to join you at the club.
            </p>
          </div>
        )}
      </div>

      {/* Issue Pass Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Ticket className="w-5 h-5 text-primary" />
                Issue VIP Guest Pass
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleIssuePass} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Guest Full Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Guest Mobile Phone (For SMS/WhatsApp)</label>
                <input
                  type="tel"
                  placeholder="e.g. +250 788 123 456"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Guest Email (Optional)</label>
                <input
                  type="email"
                  placeholder="e.g. guest@example.com"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:bg-primary/90 transition shadow disabled:opacity-50"
                >
                  {submitting ? "Generating..." : "Generate Pass"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
