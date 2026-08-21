"use client";

import { useState, useEffect } from "react";
import { Radio, RadioOff, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ScannerStatus = "connected" | "disconnected" | "error";

export function ScannerState() {
  const [status, setStatus] = useState<ScannerStatus>("disconnected");
  const [lastScan, setLastScan] = useState<string | null>(null);

  useEffect(() => {
    // Simulate scanner connection check
    const checkConnection = () => {
      // In production, this would check actual scanner hardware
      const isConnected = Math.random() > 0.3; // Simulate connection
      setStatus(isConnected ? "connected" : "disconnected");
    };

    checkConnection();
    const interval = setInterval(checkConnection, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const getStatusConfig = () => {
    switch (status) {
      case "connected":
        return {
          icon: Radio,
          label: "Scanner Connected",
          color: "text-status-cleared",
          bgColor: "bg-status-cleared/10",
          borderColor: "border-status-cleared/20",
        };
      case "disconnected":
        return {
          icon: RadioOff,
          label: "Scanner Disconnected",
          color: "text-status-action",
          bgColor: "bg-status-action/10",
          borderColor: "border-status-action/20",
        };
      case "error":
        return {
          icon: AlertCircle,
          label: "Scanner Error",
          color: "text-status-blocked",
          bgColor: "bg-status-blocked/10",
          borderColor: "border-status-blocked/20",
        };
      default:
        return {
          icon: RadioOff,
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
        "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium",
        config.color,
        config.bgColor,
        config.borderColor
      )}
      role="status"
      aria-live="polite"
    >
      <Icon className="w-4 h-4" />
      <span>{config.label}</span>
      {lastScan && (
        <span className="text-xs opacity-70 ml-2">
          Last: {new Date(lastScan).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}