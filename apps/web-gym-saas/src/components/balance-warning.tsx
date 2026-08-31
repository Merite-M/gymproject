"use client";

import { AlertTriangle, CreditCard } from "lucide-react";
import { formatCurrencyDisplay } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface BalanceWarningProps {
  amount: number;
}

export function BalanceWarning({ amount }: BalanceWarningProps) {
  return (
    <div className="bg-status-blocked/10 border border-status-blocked/20 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-status-blocked/20 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-status-blocked" />
        </div>
        <div className="flex-1">
          <h4 className="font-headline-md font-semibold text-status-blocked mb-1">
            Outstanding Balance
          </h4>
          <p className="text-sm text-muted-foreground mb-3">
            Member has an outstanding balance that must be cleared
          </p>
          <div className="flex items-center justify-between">
            <span className="text-lg font-mono-id font-bold text-status-blocked">
              {formatCurrencyDisplay(amount)}
            </span>
            <button className="px-3 py-2 bg-status-blocked text-status-blocked-foreground rounded-lg text-sm font-medium hover:bg-status-blocked/80 min-h-[44px] flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Request Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}