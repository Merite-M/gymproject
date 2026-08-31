"use client";

import { CheckCircle, XCircle, AlertTriangle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccessOutcomeProps {
  member: any;
}

export function AccessOutcome({ member }: AccessOutcomeProps) {
  // Determine access status based on member data
  const getAccessStatus = () => {
    if (member.outstanding_balance > 0) {
      return {
        status: "blocked",
        icon: XCircle,
        title: "Access Blocked",
        message: "Outstanding balance must be cleared",
        color: "text-status-blocked",
        bgColor: "bg-status-blocked/10",
        borderColor: "border-status-blocked/20",
      };
    }
    if (!member.waiver_valid) {
      return {
        status: "action",
        icon: AlertTriangle,
        title: "Action Required",
        message: "Waiver signature needed",
        color: "text-status-action",
        bgColor: "bg-status-action/10",
        borderColor: "border-status-action/20",
      };
    }
    return {
      status: "cleared",
      icon: CheckCircle,
      title: "Access Cleared",
      message: "Member can check in",
      color: "text-status-cleared",
      bgColor: "bg-status-cleared/10",
      borderColor: "border-status-cleared/20",
    };
  };

  const config = getAccessStatus();
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg border",
        config.bgColor,
        config.borderColor
      )}
    >
      <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", config.bgColor)}>
        <Icon className={cn("w-6 h-6", config.color)} />
      </div>
      <div className="flex-1">
        <h4 className={cn("font-headline-md font-semibold", config.color)}>
          {config.title}
        </h4>
        <p className="text-sm text-muted-foreground">{config.message}</p>
      </div>
      {config.status === "blocked" && (
        <button className="px-3 py-2 bg-status-blocked text-status-blocked-foreground rounded-lg text-sm font-medium hover:bg-status-blocked/80 min-h-[44px]">
          <Lock className="w-4 h-4 inline mr-1" />
          Force Unlock
        </button>
      )}
    </div>
  );
}