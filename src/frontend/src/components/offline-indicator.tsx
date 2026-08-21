"use client";

import { useState, useEffect } from "react";
import { Wifi, WifiOff, RefreshCw, CloudOff, CloudCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type SyncStatus = "online" | "offline" | "syncing" | "error";

export function OfflineIndicator() {
  const [status, setStatus] = useState<SyncStatus>("online");
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    // Monitor online/offline status
    const handleOnline = () => setStatus("online");
    const handleOffline = () => setStatus("offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    setStatus(navigator.onLine ? "online" : "offline");

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const getStatusConfig = () => {
    switch (status) {
      case "online":
        return {
          icon: CloudCheck,
          label: "Synced",
          color: "text-status-cleared",
          bgColor: "bg-status-cleared/10",
          borderColor: "border-status-cleared/20",
        };
      case "offline":
        return {
          icon: WifiOff,
          label: "Offline",
          color: "text-status-action",
          bgColor: "bg-status-action/10",
          borderColor: "border-status-action/20",
        };
      case "syncing":
        return {
          icon: RefreshCw,
          label: "Syncing...",
          color: "text-status-info",
          bgColor: "bg-status-info/10",
          borderColor: "border-status-info/20",
        };
      case "error":
        return {
          icon: CloudOff,
          label: "Sync Error",
          color: "text-status-blocked",
          bgColor: "bg-status-blocked/10",
          borderColor: "border-status-blocked/20",
        };
      default:
        return {
          icon: Wifi,
          label: "Unknown",
          color: "text-muted-foreground",
          bgColor: "bg-muted",
          borderColor: "border-border",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all",
        config.color,
        config.bgColor,
        config.borderColor,
        "animate-in slide-in-from-top-2 fade-in duration-300"
      )}
      role="status"
      aria-live="polite"
    >
      <Icon className={cn("w-4 h-4", status === "syncing" && "animate-spin")} />
      <span>{config.label}</span>
      {queueCount > 0 && (
        <span className="ml-1 px-1.5 py-0.5 rounded bg-background text-foreground">
          {queueCount}
        </span>
      )}
    </div>
  );
}