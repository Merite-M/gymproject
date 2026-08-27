"use client";

import { useState } from "react";
import { LayoutDashboard, CreditCard, FileText, Users, Snowflake, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { MembershipFreeze } from "@/components/membership-freeze";
import { AccessControlPWA } from "@/components/access-control-pwa";
import { useTenantId } from "@/contexts/AuthContext";
import type { MemberPanelData } from "@/components/member-profile-panel";

interface TabbedConsoleProps {
  member: MemberPanelData;
}

type TabType = "overview" | "access_pass" | "membership" | "billing" | "waiver" | "dependents";

const tabs = [
  { id: "overview" as TabType, label: "Overview", icon: LayoutDashboard },
  { id: "access_pass" as TabType, label: "Access & PWA Pass", icon: QrCode },
  { id: "membership" as TabType, label: "Membership", icon: Snowflake },
  { id: "billing" as TabType, label: "Billing", icon: CreditCard },
  { id: "waiver" as TabType, label: "Waiver", icon: FileText },
  { id: "dependents" as TabType, label: "Dependents", icon: Users },
];

export function TabbedConsole({ member }: TabbedConsoleProps) {
  const contextTenantId = useTenantId();
  const tenantId = contextTenantId || process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '2c604504-41c3-406b-82a0-a43700057af8';
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const outstandingBalance = member.outstanding_balance || 0;

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Tabs Header */}
      <div className="border-b border-border bg-card">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px]",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "access_pass" && (
          <div className="p-6">
            <AccessControlPWA
              tenantId={tenantId}
              profileId={member?.id || "mock-id"}
              memberFullName={member?.name || "Member"}
            />
          </div>
        )}

        {activeTab === "overview" && (
          <div className="p-6">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Membership Type</p>
                <p className="text-lg font-headline-md font-semibold text-foreground">{member.membership_type}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                <p className={cn(
                  "text-lg font-headline-md font-semibold",
                  member.status === "active" ? "text-status-cleared" : 
                  member.status === "frozen" ? "text-status-action" : "text-status-blocked"
                )}>{member.status}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Balance</p>
                <p className={cn(
                  "text-lg font-mono-id font-semibold",
                  outstandingBalance > 0 ? "text-status-blocked" : "text-status-cleared"
                )}>
                  {outstandingBalance > 0 ? `RWF ${outstandingBalance.toLocaleString()}` : "RWF 0"}
                </p>
              </div>
            </div>
            
            <div className="text-center py-12 text-muted-foreground">
              <LayoutDashboard className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Additional overview statistics</p>
              <p className="text-xs mt-2">Visit frequency, class attendance, and engagement metrics</p>
            </div>
          </div>
        )}

        {activeTab === "membership" && (
          <div className="p-6">
            <MembershipFreeze member={member} />
          </div>
        )}

        {activeTab === "billing" && (
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-card border border-border rounded-lg">
                <div>
                  <p className="text-sm font-medium text-foreground">Outstanding Balance</p>
                  <p className="text-xs text-muted-foreground">Amount due for payment</p>
                </div>
                <p className={cn(
                  "text-xl font-mono-id font-bold",
                  outstandingBalance > 0 ? "text-status-blocked" : "text-status-cleared"
                )}>
                  {outstandingBalance > 0 ? `RWF ${outstandingBalance.toLocaleString()}` : "RWF 0"}
                </p>
              </div>

              {outstandingBalance > 0 && (
                <button className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/80 min-h-[44px]">
                  Request Payment
                </button>
              )}

              <div className="text-center py-12 text-muted-foreground">
                <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">Payment history and invoices</p>
                <p className="text-xs mt-2">Transaction history, payment methods, and billing statements</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "waiver" && (
          <div className="p-6">
            <div className={cn(
              "p-6 rounded-lg border",
              member.waiver_valid 
                ? "bg-status-cleared/10 border-status-cleared/20" 
                : "bg-status-action/10 border-status-action/20"
            )}>
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  member.waiver_valid ? "bg-status-cleared/20" : "bg-status-action/20"
                )}>
                  <FileText className={cn(
                    "w-6 h-6",
                    member.waiver_valid ? "text-status-cleared" : "text-status-action"
                  )} />
                </div>
                <div>
                  <h3 className="font-headline-md font-semibold text-foreground">
                    Waiver Status
                  </h3>
                  <p className={cn(
                    "text-sm",
                    member.waiver_valid ? "text-status-cleared" : "text-status-action"
                  )}>
                    {member.waiver_valid ? "Valid and signed" : "Action required"}
                  </p>
                </div>
              </div>
            </div>

            {!member.waiver_valid && (
              <button className="w-full mt-4 px-4 py-3 bg-status-action text-status-action-foreground rounded-lg font-medium hover:bg-status-action/80 min-h-[44px]">
                Sign Waiver
              </button>
            )}

            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Waiver history and documents</p>
              <p className="text-xs mt-2">Signed waivers, expiration dates, and document management</p>
            </div>
          </div>
        )}

        {activeTab === "dependents" && (
          <div className="p-6">
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Linked family members</p>
              <p className="text-xs mt-2">Dependents, family plans, and account relationships</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}