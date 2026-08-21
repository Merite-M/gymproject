"use client";

import { FileText, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function WaiverWarning() {
  return (
    <div className="bg-status-action/10 border border-status-action/20 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-status-action/20 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-status-action" />
        </div>
        <div className="flex-1">
          <h4 className="font-headline-md font-semibold text-status-action mb-1">
            Waiver Required
          </h4>
          <p className="text-sm text-muted-foreground mb-3">
            Member must sign a liability waiver before check-in
          </p>
          <button className="px-3 py-2 bg-status-action text-status-action-foreground rounded-lg text-sm font-medium hover:bg-status-action/80 min-h-[44px] flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Sign Waiver
          </button>
        </div>
      </div>
    </div>
  );
}