"use client";
import Image from "next/image";

import { Users, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScanQueueProps {
  queue: any[];
  onSelect: (member: any) => void;
}

export function ScanQueue({ queue, onSelect }: ScanQueueProps) {
  // Mock data for demonstration
  const mockQueue = [
    {
      id: "1",
      name: "Alice Johnson",
      time: "2 min ago",
      status: "waiting",
      photo: null,
    },
    {
      id: "2",
      name: "Bob Smith",
      time: "5 min ago",
      status: "processing",
      photo: null,
    },
  ];

  const displayQueue = queue.length > 0 ? queue : mockQueue;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-headline-md font-semibold text-foreground flex items-center gap-2">
          <Users className="w-5 h-5" />
          Scan Queue
        </h2>
        <span className="text-sm text-muted-foreground">{displayQueue.length} waiting</span>
      </div>

      <div className="space-y-2">
        {displayQueue.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelect(item)}
            className={cn(
              "flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors",
              "bg-card border-border hover:bg-muted"
            )}
          >
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
              {item.photo ? (
                <Image width={40} height={40}
                  src={item.photo}
                  alt={item.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-lg font-medium text-muted-foreground">
                  {item.name.charAt(0)}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-foreground truncate">{item.name}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{item.time}</span>
              </div>
            </div>

            {/* Status */}
            <div
              className={cn(
                "px-2 py-1 rounded text-xs font-medium",
                item.status === "waiting"
                  ? "bg-status-action/10 text-status-action"
                  : "bg-status-info/10 text-status-info"
              )}
            >
              {item.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}