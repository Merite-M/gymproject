"use client";

import { useState, useEffect } from "react";
import { ScannerState } from "@/components/scanner-state";
import { MemberSearch } from "@/components/member-search";
import { ScanQueue } from "@/components/scan-queue";
import { ActivityLog } from "@/components/activity-log";
import { VisitorCard } from "@/components/visitor-card";
import { AccessOutcome } from "@/components/access-outcome";
import { BalanceWarning } from "@/components/balance-warning";
import { WaiverWarning } from "@/components/waiver-warning";
import { useTenantId } from "@/contexts/AuthContext";
import { Users, LogOut, LogIn, FileSignature, UserPlus, Ticket, ShieldCheck, Camera } from "lucide-react";
import { ContractSignerModal } from "@/components/contract-signer-modal";
import {
  fetchOccupancy,
  checkInMember,
  checkOutMember,
  visitorCheckIn,
  OccupancyData
} from "@/lib/api/reception";

export default function ReceptionPage() {
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [scanQueue, setScanQueue] = useState<any[]>([]);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [occupancy, setOccupancy] = useState<OccupancyData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);

  // Visitor Check-In Modal State
  const [isVisitorModalOpen, setIsVisitorModalOpen] = useState(false);
  const [visitorName, setVisitorName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  const [passCode, setPassCode] = useState("");
  const [hostMemberId, setHostMemberId] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [waiverSigned, setWaiverSigned] = useState(false);
  const [isSubmittingVisitor, setIsSubmittingVisitor] = useState(false);

  const tenantId = useTenantId();

  const loadOccupancy = async () => {
    if (!tenantId) return;
    try {
      const data = await fetchOccupancy(tenantId);
      if (data.success && data.occupancy) {
        setOccupancy(data.occupancy);
      }
    } catch (err) {
      console.error('Failed to fetch occupancy in reception:', err);
    }
  };

  useEffect(() => {
    loadOccupancy();
    const interval = setInterval(loadOccupancy, 15000);
    return () => clearInterval(interval);
  }, [tenantId]);

  const handleCheckIn = async () => {
    if (!selectedMember || !tenantId) return;
    setIsProcessing(true);
    try {
      const res = await checkInMember({
        tenant_id: tenantId,
        profile_id: selectedMember.id,
        access_method: 'manual_override'
      });
      if (res.success) {
        loadOccupancy();
        setActivityLog(prev => [{
          id: Date.now().toString(),
          timestamp: new Date().toLocaleTimeString(),
          name: `${selectedMember.first_name || ''} ${selectedMember.last_name || ''}`.trim() || 'Member',
          type: 'check_in',
          status: 'cleared'
        }, ...prev]);
      } else {
        alert(res.reason || res.error || 'Check-in failed');
      }
    } catch (e: any) {
      console.error('Check-in error:', e);
      alert(e.message || 'Check-in failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckOut = async () => {
    if (!selectedMember || !tenantId) return;
    setIsProcessing(true);
    try {
      const res = await checkOutMember({
        tenant_id: tenantId,
        profile_id: selectedMember.id,
        checkout_method: 'manual'
      });
      if (res.success) {
        loadOccupancy();
        setActivityLog(prev => [{
          id: Date.now().toString(),
          timestamp: new Date().toLocaleTimeString(),
          name: `${selectedMember.first_name || ''} ${selectedMember.last_name || ''}`.trim() || 'Member',
          type: 'check_out',
          status: 'cleared'
        }, ...prev]);
      } else {
        alert(res.error || 'Check-out failed');
      }
    } catch (e: any) {
      console.error('Check-out error:', e);
      alert(e.message || 'Check-out failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVisitorCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !visitorName || !visitorPhone) return;
    setIsSubmittingVisitor(true);
    try {
      const res = await visitorCheckIn({
        tenant_id: tenantId,
        guest_name: visitorName,
        guest_phone: visitorPhone,
        guest_email: visitorEmail || undefined,
        pass_code: passCode || undefined,
        host_member_id: hostMemberId || selectedMember?.id || undefined,
        photo_url: photoUrl || undefined,
        waiver_signed: waiverSigned,
        waiver_signature_url: waiverSigned ? "signature_verified_digital" : undefined
      });

      if (res.success) {
        alert(`Visitor ${visitorName} checked in! Sales Lead auto-captured and Turnstile unlocked.`);
        loadOccupancy();
        setActivityLog(prev => [{
          id: Date.now().toString(),
          timestamp: new Date().toLocaleTimeString(),
          name: `Visitor: ${visitorName}`,
          type: 'guest_visit',
          status: 'cleared'
        }, ...prev]);

        // Reset form
        setVisitorName("");
        setVisitorPhone("");
        setVisitorEmail("");
        setPassCode("");
        setHostMemberId("");
        setPhotoUrl("");
        setWaiverSigned(false);
        setIsVisitorModalOpen(false);
      } else {
        alert(res.error || 'Visitor check-in failed');
      }
    } catch (err: any) {
      console.error('Visitor check-in error:', err);
      alert(err.message || 'Visitor check-in failed');
    } finally {
      setIsSubmittingVisitor(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-headline-md font-bold text-foreground">Reception Monitor</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Real-time check-in and access control</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Visitor Check-In Trigger Button */}
            <button
              onClick={() => setIsVisitorModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-lg shadow transition min-h-[44px]"
            >
              <UserPlus className="size-4" />
              <span>Visitor Check-In</span>
            </button>

            {/* Live Occupancy Badge */}
            <div className="flex items-center gap-3 px-3.5 py-2 bg-surface-container rounded-lg border border-border min-h-[44px]">
              <Users className="size-4 text-muted-foreground shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Inside Facility</span>
                <div className="flex items-baseline gap-1">
                  <span className={`text-sm font-bold ${
                    !occupancy ? 'text-foreground' :
                    occupancy.threshold_status === 'full' ? 'text-status-blocked' :
                    occupancy.threshold_status === 'critical' ? 'text-status-blocked' :
                    occupancy.threshold_status === 'warning' ? 'text-amber-500' :
                    'text-status-cleared'
                  }`}>
                    {occupancy?.current ?? '—'}
                  </span>
                  <span className="text-xs text-muted-foreground">/{occupancy?.max ?? '—'}</span>
                  {occupancy && occupancy.threshold_status !== 'normal' && (
                    <span className="ml-1 text-[10px] font-bold uppercase tracking-wider text-status-blocked">
                      ({occupancy.threshold_status.toUpperCase()})
                    </span>
                  )}
                </div>
              </div>
              <div className="w-16 bg-border rounded-full h-1.5 overflow-hidden ml-1 hidden sm:block">
                <div
                  className={`h-full rounded-full transition-all ${
                    !occupancy ? 'bg-status-cleared' :
                    occupancy.threshold_status === 'full' ? 'bg-status-blocked' :
                    occupancy.threshold_status === 'warning' ? 'bg-amber-500' :
                    'bg-status-cleared'
                  }`}
                  style={{ width: `${Math.min(occupancy?.percentage ?? 0, 100)}%` }}
                />
              </div>
            </div>

            <ScannerState />
          </div>
        </div>
      </header>

      {/* Main Content - Responsive Split */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
        {/* Left Panel */}
        <div className="w-full lg:w-[65%] flex flex-col border-b lg:border-b-0 lg:border-r border-border">
          {/* Search and Scanner Area */}
          <div className="p-4 sm:p-6 border-b border-border">
            <MemberSearch onMemberSelect={setSelectedMember} />
          </div>

          {/* Scan Queue */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto min-h-[200px]">
            <ScanQueue queue={scanQueue} onSelect={setSelectedMember} />
          </div>

          {/* Activity Log */}
          <div className="h-64 border-t border-border">
            <ActivityLog activities={activityLog} />
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-full lg:w-[35%] flex flex-col bg-card border-t lg:border-t-0 border-border">
          {/* Persistent Visitor Card */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto min-h-[250px]">
            {selectedMember ? (
              <>
                <VisitorCard member={selectedMember} />
                
                {/* Access Outcome */}
                <div className="mt-6">
                  <AccessOutcome member={selectedMember} />
                </div>

                {/* Warnings */}
                <div className="mt-6 space-y-4">
                  {selectedMember.outstanding_balance > 0 && (
                    <BalanceWarning amount={selectedMember.outstanding_balance} />
                  )}
                  {!selectedMember.waiver_valid && (
                    <WaiverWarning />
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full py-12 lg:py-0 text-muted-foreground">
                <div className="text-center">
                  <p className="text-sm">Select a member to view details</p>
                  <p className="text-xs mt-2">Use scanner or search above</p>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          {selectedMember && (
            <div className="p-4 border-t border-border bg-muted/50">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={handleCheckIn}
                  disabled={isProcessing}
                  className="px-3 py-2 bg-status-cleared text-status-cleared-foreground rounded-lg text-xs sm:text-sm font-medium hover:bg-status-cleared/80 min-h-[44px] flex items-center justify-center gap-1.5"
                >
                  <LogIn className="size-4" />
                  <span>Check In</span>
                </button>
                <button
                  onClick={handleCheckOut}
                  disabled={isProcessing}
                  className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs sm:text-sm font-medium hover:bg-primary/80 min-h-[44px] flex items-center justify-center gap-1.5"
                >
                  <LogOut className="size-4" />
                  <span>Check Out</span>
                </button>
                <button className="px-3 py-2 bg-status-action text-status-action-foreground rounded-lg text-xs sm:text-sm font-medium hover:bg-status-action/80 min-h-[44px]">
                  MoMo Pay
                </button>
                <button
                  onClick={() => setIsContractModalOpen(true)}
                  className="px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-xs sm:text-sm font-medium hover:bg-secondary/80 min-h-[44px] flex items-center justify-center gap-1.5"
                >
                  <FileSignature className="size-4" />
                  <span>Sign Agreement</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contract & E-Signature Modal */}
      {tenantId && selectedMember && (
        <ContractSignerModal
          isOpen={isContractModalOpen}
          onClose={() => setIsContractModalOpen(false)}
          tenantId={tenantId}
          profileId={selectedMember.id}
          memberFullName={`${selectedMember.first_name || ''} ${selectedMember.last_name || ''}`.trim()}
          onSignedSuccess={() => {
            setSelectedMember((prev: any) => prev ? { ...prev, waiver_valid: true, waiver_signed: true } : null);
          }}
        />
      )}

      {/* Visitor Check-In Modal */}
      {isVisitorModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-5 sm:p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Ticket className="w-5 h-5 text-emerald-500" />
                Visitor Check-In & Guest Pass Entry
              </h3>
              <button
                onClick={() => setIsVisitorModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold min-h-[36px] min-w-[36px]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleVisitorCheckIn} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Visitor Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jane Smith"
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +250 788 123 456"
                    value={visitorPhone}
                    onChange={(e) => setVisitorPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Email Address (Optional)</label>
                  <input
                    type="email"
                    placeholder="e.g. jane@example.com"
                    value={visitorEmail}
                    onChange={(e) => setVisitorEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Guest Pass Code (If invited)</label>
                  <input
                    type="text"
                    placeholder="e.g. GP-X89K2P"
                    value={passCode}
                    onChange={(e) => setPassCode(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
                  />
                </div>
              </div>

              {/* Photo Verification Upload / URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5" />
                  Photo Verification (URL or Capture)
                </label>
                <input
                  type="text"
                  placeholder="https://... photo url"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
                />
              </div>

              {/* Digital Waiver Checkbox */}
              <div className="p-3 bg-secondary/30 border border-border rounded-xl space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={waiverSigned}
                    onChange={(e) => setWaiverSigned(e.target.checked)}
                    className="mt-0.5 rounded border-border text-emerald-600 focus:ring-emerald-500 size-4"
                  />
                  <div className="text-xs space-y-0.5">
                    <span className="font-bold text-foreground flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 inline" />
                      Guest Safety & Facility Waiver Signed
                    </span>
                    <p className="text-muted-foreground">
                      Visitor has completed and signed the single-day guest safety liability release agreement.
                    </p>
                  </div>
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsVisitorModalOpen(false)}
                  className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingVisitor}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-500 transition shadow disabled:opacity-50 flex items-center gap-1.5 min-h-[44px]"
                >
                  {isSubmittingVisitor ? "Processing..." : "Complete Visitor Check-In"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
