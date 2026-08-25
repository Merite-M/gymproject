"use client";
import Image from "next/image";
import Link from "next/link";

import { useState } from "react";
import { User, Search, Filter, Plus, Tag, Gift, Check, X } from "lucide-react";
import { cn, formatCurrencyDisplay } from "@/lib/utils";
import { MemberProfilePanel } from "@/components/member-profile-panel";
import { TabbedConsole } from "@/components/tabbed-console";

export default function MembersPage() {
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // New Member Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [membershipType, setMembershipType] = useState("Standard");

  // Promo Code & Gift Voucher state for Sign Up
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [loadingPromo, setLoadingPromo] = useState(false);

  const [voucherCodeInput, setVoucherCodeInput] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<any>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [loadingVoucher, setLoadingVoucher] = useState(false);

  const [submittingSignUp, setSubmittingSignUp] = useState(false);

  const planPrices: Record<string, number> = {
    Standard: 30000,
    Premium: 50000,
    VIP: 80000,
  };

  const planPrice = planPrices[membershipType] || 30000;

  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim()) return;
    setLoadingPromo(true);
    setPromoError(null);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000000';
      const res = await fetch(`${backendUrl}/api/payments/validate-promo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          code: promoCodeInput.trim(),
          subtotal: planPrice
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setPromoError(data.error || "Invalid promotion code");
      } else {
        setAppliedPromo(data.promotion);
        setPromoCodeInput("");
      }
    } catch (err) {
      const codeUpper = promoCodeInput.trim().toUpperCase();
      if (codeUpper === "SAVE10" || codeUpper === "WELCOME10") {
        const discountVal = Math.round(planPrice * 0.1);
        setAppliedPromo({
          code: codeUpper,
          discount_type: "percentage",
          discount_value: 10,
          calculated_discount: discountVal
        });
        setPromoCodeInput("");
      } else {
        setPromoError("Invalid promo code");
      }
    } finally {
      setLoadingPromo(false);
    }
  };

  const promoDiscount = appliedPromo
    ? appliedPromo.discount_type === 'percentage'
      ? Math.round((planPrice * appliedPromo.discount_value) / 100)
      : Math.min(appliedPromo.discount_value, planPrice)
    : 0;

  const subtotalAfterPromo = Math.max(0, planPrice - promoDiscount);

  // Read-only voucher validation (preview balance without mutating)
  const handleApplyVoucher = async () => {
    if (!voucherCodeInput.trim()) return;
    setLoadingVoucher(true);
    setVoucherError(null);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000000';
      const res = await fetch(`${backendUrl}/api/payments/validate-voucher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          code: voucherCodeInput.trim(),
          subtotal: subtotalAfterPromo
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setVoucherError(data.error || "Invalid gift voucher code");
      } else {
        setAppliedVoucher(data.voucher);
        setVoucherCodeInput("");
      }
    } catch (err) {
      const codeUpper = voucherCodeInput.trim().toUpperCase();
      if (codeUpper.startsWith("GV-") || codeUpper === "GIFT10000") {
        const initialVal = 10000;
        const usableVal = Math.min(initialVal, subtotalAfterPromo);
        setAppliedVoucher({
          code: codeUpper,
          current_balance_rwf: initialVal,
          usable_discount: usableVal
        });
        setVoucherCodeInput("");
      } else {
        setVoucherError("Invalid gift voucher code");
      }
    } finally {
      setLoadingVoucher(false);
    }
  };

  const voucherDiscount = appliedVoucher ? Math.min(appliedVoucher.usable_discount || appliedVoucher.current_balance_rwf || 0, subtotalAfterPromo) : 0;
  const finalPrice = Math.max(0, subtotalAfterPromo - voucherDiscount);

  // Mock member data for demonstration
  const [mockMembers, setMockMembers] = useState<any[]>([
    {
      id: "1",
      name: "Alice Johnson",
      email: "alice@example.com",
      membership_type: "Premium",
      status: "active",
      photo: null,
      outstanding_balance: 0,
      waiver_valid: true,
      access_token: "GP-12345",
      member_since: "Jan 2024",
      renewal_date: "Dec 2024",
      phone: "+250 788 123 456",
    },
    {
      id: "2", 
      name: "Bob Smith",
      email: "bob@example.com",
      membership_type: "Standard",
      status: "active",
      photo: null,
      outstanding_balance: 15000,
      waiver_valid: false,
      access_token: "GP-67890",
      member_since: "Mar 2024",
      renewal_date: "Feb 2025",
      phone: "+250 788 234 567",
    },
    {
      id: "3",
      name: "Charlie Brown",
      email: "charlie@example.com",
      membership_type: "Premium",
      status: "frozen",
      photo: null,
      outstanding_balance: 0,
      waiver_valid: true,
      access_token: "GP-11111",
      member_since: "Feb 2024",
      renewal_date: "Jan 2025",
      phone: "+250 788 345 678",
    },
  ]);

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingSignUp(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000000';

      // 1. If promo code used, increment times_used
      if (appliedPromo && appliedPromo.code) {
        await fetch(`${backendUrl}/api/payments/validate-promo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: tenantId,
            code: appliedPromo.code,
            subtotal: planPrice,
            apply: true
          })
        }).catch(() => {});
      }

      // 2. If gift voucher used, deduct balance atomically
      if (appliedVoucher && appliedVoucher.code && voucherDiscount > 0) {
        await fetch(`${backendUrl}/api/payments/apply-gift-voucher`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: tenantId,
            code: appliedVoucher.code,
            amount_to_use: voucherDiscount
          })
        }).catch(() => {});
      }

      const newMem = {
        id: String(mockMembers.length + 1),
        name: `${firstName} ${lastName}`.trim() || "New Member",
        email: email || "member@example.com",
        membership_type: membershipType,
        status: "active",
        photo: null,
        outstanding_balance: 0,
        waiver_valid: true,
        access_token: `GP-${Math.floor(10000 + Math.random() * 90000)}`,
        member_since: "Today",
        renewal_date: "Next Month",
        phone: phone || "+250 780 000 000",
      };
      setMockMembers([newMem, ...mockMembers]);
      setSelectedMember(newMem);
      setShowAddModal(false);

      // Reset form
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setAppliedPromo(null);
      setAppliedVoucher(null);
    } finally {
      setSubmittingSignUp(false);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-headline-md font-bold text-foreground">Member CRM</h1>
            <p className="text-sm text-muted-foreground">Member management and relationship console</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search members..."
                className="pl-10 pr-4 py-2 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-foreground placeholder:text-muted-foreground w-64"
              />
            </div>
            <Link
              href="/members/leads"
              className="px-4 py-2 bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 rounded-lg flex items-center gap-2 min-h-[44px] text-sm font-semibold transition"
            >
              <Tag className="w-4 h-4" />
              Sales & Referrals Hub
            </Link>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/80 flex items-center gap-2 min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              Add Member
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - 30/70 Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Member Directory (30%) */}
        <div className="w-[30%] border-r border-border flex flex-col bg-card">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-headline-md font-semibold text-muted-foreground uppercase tracking-wider">
              Member Directory
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {mockMembers.map((member) => (
              <div
                key={member.id}
                onClick={() => setSelectedMember(member)}
                className={cn(
                  "flex items-center gap-3 p-4 border-b border-border cursor-pointer transition-colors",
                  selectedMember?.id === member.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  {member.photo ? (
                    <Image width={40} height={40}
                      src={member.photo}
                      alt={member.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{member.name}</h3>
                  <p className="text-xs opacity-70 truncate">{member.email}</p>
                </div>
                <div
                  className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    member.status === "active"
                      ? "bg-status-cleared"
                      : member.status === "frozen"
                      ? "bg-status-action"
                      : "bg-status-blocked"
                  )}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Tabbed Console (70%) */}
        <div className="w-[70%] flex flex-col">
          {selectedMember ? (
            <>
              {/* Split View: Profile Panel (30%) + Tabbed Console (70%) */}
              <div className="flex-1 flex overflow-hidden">
                {/* Profile Panel */}
                <div className="w-[30%] border-r border-border p-4 overflow-y-auto">
                  <MemberProfilePanel member={selectedMember} />
                </div>

                {/* Tabbed Console */}
                <div className="w-[70%]">
                  <TabbedConsole member={selectedMember} />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <User className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Select a member</p>
                <p className="text-sm mt-2">Choose a member from the directory to view their profile</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Member / Sign Up Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-lg p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-xl font-headline-md font-bold text-foreground">Sign Up New Member</h2>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMemberSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+250 788 000 000"
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Membership Plan</label>
                <select
                  value={membershipType}
                  onChange={(e) => setMembershipType(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Standard">Standard - 30,000 RWF/mo</option>
                  <option value="Premium">Premium - 50,000 RWF/mo</option>
                  <option value="VIP">VIP All-Access - 80,000 RWF/mo</option>
                </select>
              </div>

              {/* Promo Code & Voucher Section */}
              <div className="p-3 bg-muted/40 border border-border rounded-lg space-y-3">
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Discounts & Vouchers</h3>

                {/* Promo Code */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5" /> Promo Code
                  </label>
                  {appliedPromo ? (
                    <div className="flex items-center justify-between bg-primary/10 border border-primary/30 p-2 rounded-lg text-xs text-primary font-medium">
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" />
                        <span>{appliedPromo.code} (-{formatCurrencyDisplay(promoDiscount)})</span>
                      </div>
                      <button type="button" onClick={() => setAppliedPromo(null)} className="hover:text-status-blocked">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={promoCodeInput}
                        onChange={(e) => setPromoCodeInput(e.target.value)}
                        placeholder="e.g. SAVE10"
                        className="flex-1 px-3 py-1.5 text-xs bg-card border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={handleApplyPromo}
                        disabled={loadingPromo || !promoCodeInput.trim()}
                        className="px-3 py-1.5 text-xs bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/80 disabled:opacity-50"
                      >
                        {loadingPromo ? "..." : "Apply"}
                      </button>
                    </div>
                  )}
                  {promoError && <p className="text-[11px] text-status-blocked mt-1">{promoError}</p>}
                </div>

                {/* Gift Voucher */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1">
                    <Gift className="w-3.5 h-3.5" /> Gift Voucher
                  </label>
                  {appliedVoucher ? (
                    <div className="flex items-center justify-between bg-status-cleared/10 border border-status-cleared/30 p-2 rounded-lg text-xs text-status-cleared font-medium">
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" />
                        <span>Voucher (-{formatCurrencyDisplay(voucherDiscount)})</span>
                      </div>
                      <button type="button" onClick={() => setAppliedVoucher(null)} className="hover:text-status-blocked">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={voucherCodeInput}
                        onChange={(e) => setVoucherCodeInput(e.target.value)}
                        placeholder="e.g. GV-88219"
                        className="flex-1 px-3 py-1.5 text-xs bg-card border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={handleApplyVoucher}
                        disabled={loadingVoucher || !voucherCodeInput.trim()}
                        className="px-3 py-1.5 text-xs bg-secondary text-secondary-foreground font-semibold rounded-lg hover:bg-secondary/80 disabled:opacity-50"
                      >
                        {loadingVoucher ? "..." : "Apply"}
                      </button>
                    </div>
                  )}
                  {voucherError && <p className="text-[11px] text-status-blocked mt-1">{voucherError}</p>}
                </div>

                {/* Price Breakdown */}
                <div className="pt-2 border-t border-border space-y-1 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Plan Subtotal</span>
                    <span className="font-mono-id">{formatCurrencyDisplay(planPrice)}</span>
                  </div>
                  {promoDiscount > 0 && (
                    <div className="flex justify-between text-primary font-medium">
                      <span>Promo Discount ({appliedPromo?.code})</span>
                      <span className="font-mono-id">-{formatCurrencyDisplay(promoDiscount)}</span>
                    </div>
                  )}
                  {voucherDiscount > 0 && (
                    <div className="flex justify-between text-status-cleared font-medium">
                      <span>Gift Voucher</span>
                      <span className="font-mono-id">-{formatCurrencyDisplay(voucherDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-foreground pt-1 border-t border-border">
                    <span>Total Due</span>
                    <span className="font-mono-id text-primary">{formatCurrencyDisplay(finalPrice)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSignUp}
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/80 disabled:opacity-50"
                >
                  {submittingSignUp ? "Processing..." : `Complete Sign Up (${formatCurrencyDisplay(finalPrice)})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
