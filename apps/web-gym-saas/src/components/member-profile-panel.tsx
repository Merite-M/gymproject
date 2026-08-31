"use client";
import Image from "next/image";

import { User, CreditCard, Calendar, Phone, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MemberPanelData {
  id: string;
  name: string;
  email?: string | null;
  membership_type?: string | null;
  status: string;
  photo?: string | null;
  outstanding_balance?: number;
  waiver_valid?: boolean;
  access_token?: string | null;
  member_since?: string | null;
  renewal_date?: string | null;
  phone?: string | null;
  [key: string]: unknown;
}

interface MemberProfilePanelProps {
  member: MemberPanelData;
}

export function MemberProfilePanel({ member }: MemberProfilePanelProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-6">
      {/* Photo and Basic Info */}
      <div className="flex items-start gap-4">
        <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center shrink-0">
          {member.photo ? (
            <Image width={40} height={40}
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
                  : "bg-status-warning/10 text-status-warning"
              )}
            >
              {member.status}
            </span>
          </div>
        </div>
      </div>

      {/* Access Token / RFID / QR */}
      <div className="bg-muted/50 p-4 rounded-lg">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
          Active Pass Token
        </p>
        <p className="font-mono text-sm font-semibold text-foreground">
          {member.access_token}
        </p>
      </div>

      {/* Financial & Membership Details */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 bg-card border border-border rounded-lg">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CreditCard className="w-4 h-4" />
            <span className="text-xs">Balance Due</span>
          </div>
          <p className="text-lg font-mono font-semibold text-foreground">
            {member.outstanding_balance?.toLocaleString()} RWF
          </p>
        </div>

        <div className="p-3 bg-card border border-border rounded-lg">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Calendar className="w-4 h-4" />
            <span className="text-xs">Renewal Date</span>
          </div>
          <p className="text-sm font-semibold text-foreground">
            {member.renewal_date}
          </p>
        </div>
      </div>

      {/* Contact Details */}
      <div className="space-y-3 pt-4 border-t border-border">
        <div className="flex items-center gap-3 text-sm">
          <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-foreground">{member.phone}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-foreground">{member.email}</span>
        </div>
      </div>
    </div>
  );
}