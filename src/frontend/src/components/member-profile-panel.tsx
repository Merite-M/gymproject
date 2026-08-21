"use client";

import { User, CreditCard, Calendar, Phone, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

interface MemberProfilePanelProps {
  member: any;
}

export function MemberProfilePanel({ member }: MemberProfilePanelProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-6">
      {/* Photo and Basic Info */}
      <div className="flex items-start gap-4">
        <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center shrink-0">
          {member.photo ? (
            <img
              src={member.photo}
              alt={member.name}
              className="w-full h-full rounded-lg object-cover"
            />
          ) : (
            <User className="w-10 h-10 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-headline-md font-semibold text-foreground">
            {member.name}
          </h3>
          <p className="text-sm text-muted-foreground">{member.email}</p>
          <div className="mt-2 flex gap-2">
            <span className="inline-flex items-center px-2 py-1 rounded bg-primary/10 text-primary text-xs font-medium">
              {member.membership_type}
            </span>
            <span
              className={cn(
                "inline-flex items-center px-2 py-1 rounded text-xs font-medium",
                member.status === "active"
                  ? "bg-status-cleared/10 text-status-cleared"
                  : member.status === "frozen"
                  ? "bg-status-action/10 text-status-action"
                  : "bg-status-blocked/10 text-status-blocked"
              )}
            >
              {member.status}
            </span>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="space-y-3 pt-4 border-t border-border">
        <div className="flex items-center gap-3 text-sm">
          <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Email:</span>
          <span className="text-foreground">{member.email}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Phone:</span>
          <span className="text-foreground">{member.phone || "Not provided"}</span>
        </div>
      </div>

      {/* Membership Details */}
      <div className="space-y-3 pt-4 border-t border-border">
        <div className="flex items-center gap-3 text-sm">
          <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Access Token:</span>
          <span className="font-mono-id text-foreground">{member.access_token || "N/A"}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Member Since:</span>
          <span className="text-foreground">{member.member_since || "N/A"}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Renewal Date:</span>
          <span className="text-foreground">{member.renewal_date || "N/A"}</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="pt-4 border-t border-border">
        <div className="grid grid-cols-2 gap-2">
          <button className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/80 min-h-[44px]">
            Check In
          </button>
          <button className="px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 min-h-[44px]">
            Freeze
          </button>
        </div>
      </div>
    </div>
  );
}