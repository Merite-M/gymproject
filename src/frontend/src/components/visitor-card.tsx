"use client";
import Image from "next/image";

import { User, CreditCard, Calendar } from "lucide-react";
import { formatCurrencyDisplay } from "@/lib/utils";

interface VisitorCardProps {
  member: any;
}

export function VisitorCard({ member }: VisitorCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4">
      {/* Header with Photo */}
      <div className="flex items-start gap-4">
        <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center shrink-0">
          {member.photo ? (
            <Image width={100} height={100}
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
          <div className="mt-2">
            <span className="inline-flex items-center px-2 py-1 rounded bg-primary/10 text-primary text-xs font-medium">
              {member.membership_type}
            </span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-3 pt-4 border-t border-border">
        <div className="flex items-center gap-3 text-sm">
          <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Access Token:</span>
          <span className="font-mono-id text-foreground">{member.access_token}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Member Since:</span>
          <span className="text-foreground">Jan 2024</span>
        </div>
      </div>

      {/* Balance */}
      {member.outstanding_balance > 0 && (
        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Outstanding Balance</span>
            <span className="text-lg font-mono-id font-bold text-status-blocked">
              {formatCurrencyDisplay(member.outstanding_balance)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}