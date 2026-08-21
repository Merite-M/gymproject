"use client";

import { useState } from "react";
import { Megaphone, MessageSquare, Users, AlertTriangle, Clock, Plus, Play, Pause, Eye, Edit, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RetentionPage() {
  const [activeTab, setActiveTab] = useState<"workflows" | "churn-risk" | "queue">("workflows");

  // Mock automation workflows
  const workflows = [
    {
      id: "1",
      name: "Attendance Drop-off Recovery",
      status: "active",
      triggers: ["attendance_drop"],
      lastRun: "2 hours ago",
      successRate: 85,
      messagesSent: 142,
    },
    {
      id: "2",
      name: "Payment Reminder Sequence",
      status: "active",
      triggers: ["payment_overdue"],
      lastRun: "1 day ago",
      successRate: 92,
      messagesSent: 89,
    },
    {
      id: "3",
      name: "New Member Onboarding",
      status: "draft",
      triggers: ["new_member"],
      lastRun: null,
      successRate: 0,
      messagesSent: 0,
    },
  ];

  // Mock churn-risk members
  const churnRiskMembers = [
    {
      id: "1",
      name: "Alice Johnson",
      riskScore: 85,
      riskLevel: "high",
      lastVisit: "14 days ago",
      attendanceRate: 45,
      actions: ["payment_overdue", "attendance_drop"],
    },
    {
      id: "2",
      name: "Bob Smith",
      riskScore: 72,
      riskLevel: "medium",
      lastVisit: "7 days ago",
      attendanceRate: 60,
      actions: ["attendance_drop"],
    },
    {
      id: "3",
      name: "Charlie Brown",
      riskScore: 90,
      riskLevel: "high",
      lastVisit: "21 days ago",
      attendanceRate: 30,
      actions: ["payment_overdue", "attendance_drop", "membership_expiring"],
    },
  ];

  // Mock message queue
  const messageQueue = [
    {
      id: "1",
      recipient: "Alice Johnson",
      type: "whatsapp",
      status: "pending",
      workflow: "Attendance Drop-off Recovery",
      scheduledFor: "2026-08-21T14:00:00Z",
    },
    {
      id: "2",
      recipient: "Bob Smith",
      type: "sms",
      status: "sent",
      workflow: "Payment Reminder Sequence",
      scheduledFor: "2026-08-21T12:00:00Z",
    },
    {
      id: "3",
      recipient: "Charlie Brown",
      type: "whatsapp",
      status: "failed",
      workflow: "Attendance Drop-off Recovery",
      scheduledFor: "2026-08-21T10:00:00Z",
    },
  ];

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-headline-md font-bold text-foreground">Retention Automation</h1>
            <p className="text-sm text-muted-foreground">WhatsApp/SMS-first workflow builder with churn-risk management</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-muted border border-border text-foreground rounded-lg hover:bg-muted/80 flex items-center gap-2 min-h-[44px]">
              <Eye className="w-4 h-4" />
              Preview Templates
            </button>
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/80 flex items-center gap-2 min-h-[44px]">
              <Plus className="w-4 h-4" />
              Create Workflow
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-border bg-card">
        <div className="flex">
          <button
            onClick={() => setActiveTab("workflows")}
            className={cn(
              "flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors min-h-[44px]",
              activeTab === "workflows"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Megaphone className="w-4 h-4" />
            Workflows
            <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">{workflows.length}</span>
          </button>
          <button
            onClick={() => setActiveTab("churn-risk")}
            className={cn(
              "flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors min-h-[44px]",
              activeTab === "churn-risk"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <AlertTriangle className="w-4 h-4" />
            Churn Risk
            <span className="bg-status-blocked/20 text-status-blocked text-xs px-2 py-0.5 rounded-full">{churnRiskMembers.length}</span>
          </button>
          <button
            onClick={() => setActiveTab("queue")}
            className={cn(
              "flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors min-h-[44px]",
              activeTab === "queue"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <MessageSquare className="w-4 h-4" />
            Message Queue
            <span className="bg-status-action/20 text-status-action text-xs px-2 py-0.5 rounded-full">{messageQueue.length}</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "workflows" && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workflows.map((workflow) => (
                <div key={workflow.id} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        workflow.status === "active" ? "bg-status-cleared/20" : "bg-muted"
                      )}>
                        <Megaphone className={cn(
                          "w-5 h-5",
                          workflow.status === "active" ? "text-status-cleared" : "text-muted-foreground"
                        )} />
                      </div>
                      <div>
                        <h3 className="font-headline-md font-semibold text-foreground">{workflow.name}</h3>
                        <p className="text-xs text-muted-foreground capitalize">{workflow.status}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button className="p-2 hover:bg-muted rounded-lg transition-colors min-h-[36px] min-w-[36px]">
                        <Edit className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button className="p-2 hover:bg-muted rounded-lg transition-colors min-h-[36px] min-w-[36px]">
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Triggers:</span>
                      <span className="text-foreground">{workflow.triggers.join(", ")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Run:</span>
                      <span className="text-foreground">{workflow.lastRun || "Never"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Success Rate:</span>
                      <span className={cn(
                        "font-medium",
                        workflow.successRate >= 80 ? "text-status-cleared" : 
                        workflow.successRate >= 60 ? "text-status-action" : "text-status-blocked"
                      )}>{workflow.successRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Messages Sent:</span>
                      <span className="text-foreground">{workflow.messagesSent}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border flex gap-2">
                    {workflow.status === "active" ? (
                      <button className="flex-1 px-3 py-2 bg-muted border border-border text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 min-h-[44px] flex items-center justify-center gap-2">
                        <Pause className="w-4 h-4" />
                        Pause
                      </button>
                    ) : (
                      <button className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/80 min-h-[44px] flex items-center justify-center gap-2">
                        <Play className="w-4 h-4" />
                        Activate
                      </button>
                    )}
                    <button className="px-3 py-2 bg-muted border border-border text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 min-h-[44px]">
                      Edit Flow
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "churn-risk" && (
          <div className="p-6">
            <div className="space-y-4">
              {churnRiskMembers.map((member) => (
                <div key={member.id} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Users className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-headline-md font-semibold text-foreground">{member.name}</h3>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-lg font-bold font-mono-id",
                            member.riskLevel === "high" ? "text-status-blocked" : "text-status-action"
                          )}>{member.riskScore}%</span>
                          <span className={cn(
                            "text-xs px-2 py-1 rounded",
                            member.riskLevel === "high" ? "bg-status-blocked/10 text-status-blocked" : "bg-status-action/10 text-status-action"
                          )}>{member.riskLevel} risk</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                        <div>
                          <p className="text-muted-foreground">Last Visit</p>
                          <p className="text-foreground">{member.lastVisit}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Attendance Rate</p>
                          <p className="text-foreground">{member.attendanceRate}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Risk Factors</p>
                          <div className="flex gap-1 flex-wrap">
                            {member.actions.map((action) => (
                              <span key={action} className="text-xs bg-muted px-2 py-1 rounded capitalize">
                                {action.replace("_", " ")}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/80 min-h-[44px] flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" />
                          Send Message
                        </button>
                        <button className="px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 min-h-[44px]">
                          View Profile
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "queue" && (
          <div className="p-6">
            <div className="space-y-3">
              {messageQueue.map((message) => (
                <div key={message.id} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        message.type === "whatsapp" ? "bg-status-cleared/20" : "bg-secondary/20"
                      )}>
                        <MessageSquare className={cn(
                          "w-5 h-5",
                          message.type === "whatsapp" ? "text-status-cleared" : "text-secondary"
                        )} />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{message.recipient}</p>
                        <p className="text-xs text-muted-foreground">{message.workflow}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "text-xs px-2 py-1 rounded",
                        message.status === "sent" ? "bg-status-cleared/10 text-status-cleared" :
                        message.status === "failed" ? "bg-status-blocked/10 text-status-blocked" :
                        "bg-status-action/10 text-status-action"
                      )}>
                        {message.status}
                      </span>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{new Date(message.scheduledFor).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}