"use client";

import { Activity, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityLogProps {
  activities: any[];
}

export function ActivityLog({ activities }: ActivityLogProps) {
  // Mock data for demonstration
  const mockActivities = [
    {
      id: "1",
      member: "Alice Johnson",
      action: "check_in",
      method: "scan",
      time: "2 min ago",
      status: "success",
    },
    {
      id: "2",
      member: "Bob Smith",
      action: "check_in",
      method: "manual",
      time: "5 min ago",
      status: "blocked",
      reason: "outstanding_balance",
    },
    {
      id: "3",
      member: "Charlie Brown",
      action: "check_in",
      method: "scan",
      time: "8 min ago",
      status: "action",
      reason: "waiver_expired",
    },
  ];

  const displayActivities = activities.length > 0 ? activities : mockActivities;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-status-cleared" />;
      case "blocked":
        return <XCircle className="w-4 h-4 text-status-blocked" />;
      case "action":
        return <AlertTriangle className="w-4 h-4 text-status-action" />;
      default:
        return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-3 border-b border-border bg-muted/50">
        <h2 className="text-sm font-headline-md font-semibold text-foreground flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Activity Log
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full">
          <thead className="bg-muted/30">
            <tr>
              <th className="px-6 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Member
              </th>
              <th className="px-6 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Action
              </th>
              <th className="px-6 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Method
              </th>
              <th className="px-6 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Time
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayActivities.map((activity) => (
              <tr key={activity.id} className="hover:bg-muted/50">
                <td className="px-6 py-3 text-sm text-foreground">{activity.member}</td>
                <td className="px-6 py-3 text-sm text-foreground capitalize">
                  {activity.action.replace("_", " ")}
                </td>
                <td className="px-6 py-3 text-sm text-muted-foreground capitalize">
                  {activity.method}
                </td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(activity.status)}
                    <span className="text-sm capitalize">{activity.status}</span>
                  </div>
                </td>
                <td className="px-6 py-3 text-sm text-muted-foreground">{activity.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}