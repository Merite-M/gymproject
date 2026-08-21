"use client";

import { useState } from "react";
import { ScannerState } from "@/components/scanner-state";
import { MemberSearch } from "@/components/member-search";
import { ScanQueue } from "@/components/scan-queue";
import { ActivityLog } from "@/components/activity-log";
import { VisitorCard } from "@/components/visitor-card";
import { AccessOutcome } from "@/components/access-outcome";
import { BalanceWarning } from "@/components/balance-warning";
import { WaiverWarning } from "@/components/waiver-warning";

export default function ReceptionPage() {
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [scanQueue, setScanQueue] = useState<any[]>([]);
  const [activityLog, setActivityLog] = useState<any[]>([]);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-headline-md font-bold text-foreground">Reception Monitor</h1>
            <p className="text-sm text-muted-foreground">Real-time check-in and access control</p>
          </div>
          <div className="flex items-center gap-4">
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
              <div className="grid grid-cols-3 gap-2">
                <button className="px-3 py-2 bg-status-cleared text-status-cleared-foreground rounded-lg text-sm font-medium hover:bg-status-cleared/80 min-h-[44px]">
                  Check In
                </button>
                <button className="px-3 py-2 bg-status-action text-status-action-foreground rounded-lg text-sm font-medium hover:bg-status-action/80 min-h-[44px]">
                  MoMo Pay
                </button>
                <button className="px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 min-h-[44px]">
                  Waiver
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}