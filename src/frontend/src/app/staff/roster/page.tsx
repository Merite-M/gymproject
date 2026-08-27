"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Camera,
  Check,
  Clock,
  Play,
  Square,
  Loader2,
  Calendar as CalendarIcon,
  Bell,
  ChevronRight,
  MapPin,
  AlertCircle,
} from "lucide-react";
import { useTenantId, useAuth } from "@/contexts/AuthContext";

interface TaskTemplate {
  name: string;
  description: string;
  is_mandatory: boolean;
  requires_photo_evidence: boolean;
}

interface Task {
  id: string;
  status: string;
  completed_at: string | null;
  photo_url: string | null;
  task_template: TaskTemplate | null;
}

interface Shift {
  id: string;
  shift_start: string;
  shift_end: string | null;
  status: string;
}

export default function RosterPage() {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const [shift, setShift] = useState<Shift | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState<string>("");
  const [photoFiles, setPhotoFiles] = useState<Record<string, File>>({});
  const [completingTask, setCompletingTask] = useState<string | null>(null);
  const [featureDisabled, setFeatureDisabled] = useState(false);

  const fetchShiftData = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/staff/shift?tenant_id=${tenantId}&staff_id=${staffId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setShift(data.shift);
        setTasks(data.tasks || []);
        setFeatureDisabled(false);
      } else if (res.status === 403) {
        setFeatureDisabled(true);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [tenantId, staffId]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (mounted) await fetchShiftData();
    };
    load();
    return () => {
      mounted = false;
    };
  }, [fetchShiftData]);

  // Set staff info from authenticated user
  useEffect(() => {
    if (user) {
      setStaffId(user.id);
      setStaffName(user.user_metadata?.full_name || user.email || "Staff Member");
    }
  }, [user]);

  const refetchData = async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/staff/shift?tenant_id=${tenantId}&staff_id=${staffId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setShift(data.shift);
        setTasks(data.tasks || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const startShift = async () => {
    if (!tenantId || !staffId) {
      alert("Authentication required");
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/staff/shift/start`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: tenantId,
            staff_id: staffId,
            starting_cash: 100,
          }),
        },
      );
      if (res.ok) {
        refetchData();
      } else {
        alert("Failed to start shift");
      }
    } catch (e) {
      console.error(e);
      alert("Error starting shift");
    }
  };

  const endShift = async () => {
    if (!shift) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/staff/shift/end`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenant_id: tenantId, shift_id: shift.id }),
        },
      );
      if (res.ok) {
        refetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to end shift");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const completeTask = async (
    taskId: string,
    requiresPhoto: boolean | undefined,
  ) => {
    setCompletingTask(taskId);
    try {
      const formData = new FormData();
      formData.append("task_id", taskId);
      formData.append("tenant_id", tenantId || "");
      formData.append("staff_id", staffId || "");

      if (requiresPhoto && photoFiles[taskId]) {
        formData.append("photo", photoFiles[taskId]);
      } else if (requiresPhoto) {
        alert("Photo evidence is required for this task.");
        setCompletingTask(null);
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/staff/task/complete`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (res.ok) {
        refetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to complete task");
      }
    } catch (e) {
      console.error(e);
    }
    setCompletingTask(null);
  };

  if (loading || !tenantId || !staffId)
    return (
      <div className="flex items-center justify-center h-full min-h-screen bg-background">
        <Loader2 className="animate-spin w-8 h-8 text-foreground" />
      </div>
    );

  if (featureDisabled) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen flex-col bg-background">
        <AlertCircle size={48} className="text-slate-400 mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Feature Disabled
        </h2>
        <p className="text-slate-500">
          Staff roster management is disabled for this facility.
        </p>
      </div>
    );
  }

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const progressPercent =
    tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Shift Operations
            </h1>
            <p className="text-sm text-muted-foreground mt-1 font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-status-cleared"></span>
              Staff Member: {staffName}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right mr-4 hidden sm:block">
              <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                Status
              </p>
              <p className="text-sm font-semibold text-foreground">
                {shift ? "On Shift" : "Off-Shift"}
              </p>
            </div>
            {!shift ? (
              <button
                onClick={startShift}
                className="bg-foreground hover:bg-foreground/90 text-white h-10 px-6 rounded shadow-sm font-semibold flex items-center gap-2 transition-all"
              >
                <Play size={18} fill="currentColor" /> Start Shift
              </button>
            ) : (
              <div className="flex items-center gap-4 bg-muted p-1.5 rounded-md border border-border">
                <div className="px-3 flex items-center gap-2 text-muted-foreground text-sm font-medium">
                  <Clock size={16} />
                  <span className="font-mono">
                    {new Date(shift.shift_start).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <button
                  onClick={endShift}
                  className="bg-white border border-border hover:border-destructive hover:text-destructive text-foreground h-8 px-4 rounded shadow-sm font-semibold flex items-center gap-2 transition-all"
                >
                  <Square size={14} fill="currentColor" /> End Shift
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8">
        {/* MAIN AREA - Tasks (75%) */}
        <div className="flex-1 lg:w-[75%] max-w-4xl">
          <div className="mb-6 flex justify-between items-end">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Shift Checklist
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Complete mandatory assignments before shift end.
              </p>
            </div>
            {shift && tasks.length > 0 && (
              <div className="text-right">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Progress
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-status-cleared rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-mono font-medium text-foreground">
                    {completedCount}/{tasks.length}
                  </span>
                </div>
              </div>
            )}
          </div>

          {!shift ? (
            <div className="bg-white rounded-lg border border-border p-12 text-center shadow-sm">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock size={24} className="text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                You are currently off-shift
              </h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Start your shift to view your assigned task checklist and begin
                logging operations.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.length === 0 ? (
                <div className="bg-white rounded border border-border p-8 text-center text-muted-foreground">
                  No specific tasks assigned for this shift profile.
                </div>
              ) : (
                tasks.map((task) => {
                  const isDone = task.status === "completed";
                  return (
                    <div
                      key={task.id}
                      className={`bg-white rounded-lg border shadow-sm transition-all overflow-hidden ${isDone ? "border-border opacity-75" : "border-foreground/20"}`}
                    >
                      <div className="p-5 sm:p-6 flex flex-col sm:flex-row gap-4 sm:items-start justify-between">
                        <div className="flex gap-4">
                          <div className="pt-1 flex-shrink-0">
                            {isDone ? (
                              <div className="w-6 h-6 rounded-full bg-success-soft text-status-cleared-foreground flex items-center justify-center border border-status-cleared">
                                <Check size={14} strokeWidth={3} />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-full border-2 border-border bg-background"></div>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h3
                                className={`font-semibold text-base ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}
                              >
                                {task.task_template?.name}
                              </h3>
                              {task.task_template?.is_mandatory && !isDone && (
                                <span className="bg-destructive/10 text-destructive text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-destructive/20">
                                  Required
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground max-w-xl">
                              {task.task_template?.description}
                            </p>

                            {isDone && task.completed_at && (
                              <div className="flex items-center gap-2 mt-3 text-xs font-medium text-muted-foreground">
                                <Check size={14} className="text-status-cleared" />
                                Completed at{" "}
                                <span className="font-mono">
                                  {new Date(
                                    task.completed_at,
                                  ).toLocaleTimeString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {!isDone && (
                          <div className="flex flex-col sm:items-end gap-3 mt-4 sm:mt-0 pt-4 sm:pt-0 border-t border-border sm:border-0">
                            {task.task_template?.requires_photo_evidence && (
                              <label
                                className={`cursor-pointer w-full sm:w-auto px-4 py-2 text-sm font-semibold rounded border transition-colors flex items-center justify-center gap-2 ${photoFiles[task.id] ? "bg-muted border-foreground text-foreground" : "bg-white border-border text-foreground hover:bg-background"}`}
                              >
                                <Camera size={16} />
                                {photoFiles[task.id]
                                  ? "Photo Ready"
                                  : "Take Photo Evidence"}
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="hidden"
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      setPhotoFiles((prev) => ({
                                        ...prev,
                                        [task.id]: e.target.files![0],
                                      }));
                                    }
                                  }}
                                />
                              </label>
                            )}
                            <button
                              onClick={() =>
                                completeTask(
                                  task.id,
                                  task.task_template?.requires_photo_evidence,
                                )
                              }
                              disabled={
                                completingTask === task.id ||
                                (task.task_template?.requires_photo_evidence &&
                                  !photoFiles[task.id])
                              }
                              className={`w-full sm:w-auto px-6 py-2 rounded text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                                completingTask === task.id
                                  ? "bg-border text-muted-foreground"
                                  : task.task_template
                                        ?.requires_photo_evidence &&
                                      !photoFiles[task.id]
                                    ? "bg-muted text-muted-foreground/60 cursor-not-allowed border border-border"
                                    : "bg-foreground text-white shadow-sm hover:bg-foreground/90"
                              }`}
                            >
                              {completingTask === task.id ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Check size={16} />
                              )}
                              Mark as Done
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* SECONDARY SIDEBAR (25%) */}
        <div className="lg:w-[25%] lg:min-w-[320px] space-y-6">
          <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-background">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <CalendarIcon size={18} className="text-muted-foreground" />
                Upcoming Roster
              </h3>
            </div>
            <div className="divide-y divide-border">
              <div className="p-4 hover:bg-background transition-colors cursor-pointer">
                <p className="text-xs font-bold text-foreground mb-1">
                  TOMORROW
                </p>
                <div className="flex justify-between items-center">
                  <p className="text-sm font-mono text-muted-foreground">
                    06:00 - 14:00
                  </p>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded flex items-center gap-1">
                    <MapPin size={10} /> Front Desk
                  </span>
                </div>
              </div>
              <div className="p-4 hover:bg-background transition-colors cursor-pointer">
                <p className="text-xs font-bold text-foreground mb-1">
                  WEDNESDAY
                </p>
                <div className="flex justify-between items-center">
                  <p className="text-sm font-mono text-muted-foreground">
                    14:00 - 22:00
                  </p>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded flex items-center gap-1">
                    <MapPin size={10} /> Floor Mgr
                  </span>
                </div>
              </div>
              <div className="p-4 flex items-center justify-between text-foreground hover:bg-background cursor-pointer transition-colors">
                <span className="text-sm font-semibold">
                  View Full Schedule
                </span>
                <ChevronRight size={16} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-background flex justify-between items-center">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Bell size={18} className="text-muted-foreground" />
                Announcements
              </h3>
              <span className="w-2 h-2 bg-destructive rounded-full"></span>
            </div>
            <div className="p-5 space-y-4">
              <div className="border-l-2 border-status-action pl-3">
                <p className="text-xs font-bold text-status-action mb-0.5 uppercase tracking-wider">
                  Facility Notice
                </p>
                <p className="text-sm text-foreground font-medium leading-tight">
                  Planned Maintenance: Spin Studio AC unit repair today at
                  14:00.
                </p>
              </div>
              <div className="border-l-2 border-status-cleared pl-3">
                <p className="text-xs font-bold text-status-cleared mb-0.5 uppercase tracking-wider">
                  Inventory Update
                </p>
                <p className="text-sm text-foreground font-medium leading-tight">
                  New Shipment: Premium Towels have arrived in the back
                  stockroom.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
