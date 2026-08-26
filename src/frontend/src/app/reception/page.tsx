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
import { Users, LogOut, LogIn, FileSignature } from "lucide-react";
import { ContractSignerModal } from "@/components/contract-signer-modal";

interface OccupancyData {
  current: number;
  max: number;
  percentage: number;
  policy: string;
  threshold_status: 'normal' | 'warning' | 'critical' | 'full';
  auto_checkout_minutes: number;
}

export default function ReceptionPage() {
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [scanQueue, setScanQueue] = useState<any[]>([]);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [occupancy, setOccupancy] = useState<OccupancyData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const tenantId = useTenantId();

  const fetchOccupancy = async () => {
    if (!tenantId) return;
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const res = await fetch(`${backendUrl}/api/iot/occupancy?tenant_id=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.occupancy) {
          setOccupancy(data.occupancy);
        }
      }
    } catch (err) {
      console.error('Failed to fetch occupancy in reception:', err);
    }
  };

  useEffect(() => {
    fetchOccupancy();
    const interval = setInterval(fetchOccupancy, 15000);
    return () => clearInterval(interval);
  }, [tenantId]);

  const handleCheckIn = async () => {
    if (!selectedMember || !tenantId) return;
    setIsProcessing(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const res = await fetch(`${backendUrl}/api/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          profile_id: selectedMember.id,
          access_method: 'manual_override'
        })
      });
      const data = await res.json();
      if (res.ok) {
        fetchOccupancy();
      } else {
        alert(data.reason || data.error || 'Check-in failed');
      }
    } catch (e: any) {
      console.error('Check-in error:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckOut = async () => {
    if (!selectedMember || !tenantId) return;
    setIsProcessing(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const res = await fetch(`${backendUrl}/api/iot/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          profile_id: selectedMember.id,
          checkout_method: 'manual'
        })
      });
      const data = await res.json();
      if (res.ok) {
        fetchOccupancy();
      } else {
        alert(data.error || 'Check-out failed');
      }
    } catch (e: any) {
      console.error('Check-out error:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-headline-md font-bold text-foreground">Reception Monitor</h1>
            <p className="text-sm text-muted-foreground">Real-time check-in and access control</p>
          </div>
          <div className="flex items-center gap-6">
            {/* Live Occupancy Badge */}
            <div className="flex items-center gap-3 px-4 py-2 bg-surface-container rounded-lg border border-border">
              <Users className="size-4 text-muted-foreground" />
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

      {/* Main Content - 65/35 Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - 65% */}
        <div className="w-[65%] flex flex-col border-r border-border">
          {/* Search and Scanner Area */}
          <div className="p-6 border-b border-border">
            <MemberSearch onMemberSelect={setSelectedMember} />
          </div>

          {/* Scan Queue */}
          <div className="flex-1 p-6 overflow-y-auto">
            <ScanQueue queue={scanQueue} onSelect={setSelectedMember} />
          </div>

          {/* Activity Log */}
          <div className="h-64 border-t border-border">
            <ActivityLog activities={activityLog} />
          </div>
        </div>

        {/* Right Panel - 35% */}
        <div className="w-[35%] flex flex-col bg-card">
          {/* Persistent Visitor Card */}
          <div className="flex-1 p-6 overflow-y-auto">
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
              <div className="flex items-center justify-center h-full text-muted-foreground">
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
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={handleCheckIn}
                  disabled={isProcessing}
                  className="px-3 py-2 bg-status-cleared text-status-cleared-foreground rounded-lg text-sm font-medium hover:bg-status-cleared/80 min-h-[44px] flex items-center justify-center gap-1.5"
                >
                  <LogIn className="size-4" />
                  <span>Check In</span>
                </button>
                <button
                  onClick={handleCheckOut}
                  disabled={isProcessing}
                  className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/80 min-h-[44px] flex items-center justify-center gap-1.5"
                >
                  <LogOut className="size-4" />
                  <span>Check Out</span>
                </button>
                <button className="px-3 py-2 bg-status-action text-status-action-foreground rounded-lg text-sm font-medium hover:bg-status-action/80 min-h-[44px]">
                  MoMo Pay
                </button>
                <button
                  onClick={() => setIsContractModalOpen(true)}
                  className="px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 min-h-[44px] flex items-center justify-center gap-1.5"
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
          onSignedSuccess={(contract) => {
            setSelectedMember((prev: any) => prev ? { ...prev, waiver_valid: true, waiver_signed: true } : null);
          }}
        />
      )}
    </div>
  );
}