"use client";
import { useState, useEffect, useCallback } from "react";
import { Loader2, Calendar, CheckCircle2, AlertCircle } from "lucide-react";

interface TaskTemplate {
  name: string;
  is_mandatory: boolean;
}

interface Task {
  id: string;
  status: string;
  completed_at: string | null;
  photo_url: string | null;
  notes: string | null;
  template: TaskTemplate | null;
}

interface Staff {
  first_name: string;
  last_name: string;
}

interface Shift {
  id: string;
  staff: Staff | null;
  shift_start: string;
  shift_end: string | null;
  status: string;
  tasks: Task[];
}

export default function ManagerPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const tenantId = "t-001"; // Mock tenant
  const [dateFilter, setDateFilter] = useState("");

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/staff/manager/review`,
      );
      url.searchParams.append("tenant_id", tenantId);
      if (dateFilter) url.searchParams.append("date", dateFilter);

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        setShifts(data || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [dateFilter, tenantId]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (mounted) await fetchReviews();
    };
    load();
    return () => {
      mounted = false;
    };
  }, [fetchReviews]);

  const getCompletionRate = (tasks: Task[]) => {
    if (!tasks || tasks.length === 0) return 100;
    const completed = tasks.filter((t) => t.status === "completed").length;
    return Math.round((completed / tasks.length) * 100);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            Shift Logs & Quality Control
          </h2>
          <p className="text-slate-500 mt-1">
            Review staff task completion and shift reports.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-md px-3 py-2">
          <Calendar size={18} className="text-slate-500" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="outline-none text-sm text-slate-700"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
        </div>
      ) : (
        <div className="space-y-6">
          {shifts.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center text-slate-500">
              No shift logs found for this period.
            </div>
          ) : (
            shifts.map((shift) => {
              const completionRate = getCompletionRate(shift.tasks);
              const isPerfect = completionRate === 100;

              return (
                <div
                  key={shift.id}
                  className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden"
                >
                  <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
                        {shift.staff?.first_name?.[0] || "S"}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800">
                          {shift.staff?.first_name} {shift.staff?.last_name}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {new Date(shift.shift_start).toLocaleDateString()} •{" "}
                          {new Date(shift.shift_start).toLocaleTimeString()} -{" "}
                          {shift.shift_end
                            ? new Date(shift.shift_end).toLocaleTimeString()
                            : "Active"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">
                          Completion
                        </p>
                        <div
                          className={`flex items-center gap-1 font-bold ${isPerfect ? "text-emerald-600" : "text-amber-500"}`}
                        >
                          {isPerfect ? (
                            <CheckCircle2 size={16} />
                          ) : (
                            <AlertCircle size={16} />
                          )}
                          {completionRate}%
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">
                          Status
                        </p>
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${shift.status === "closed" ? "bg-slate-100 text-slate-600" : shift.status === "open" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}
                        >
                          {shift.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <h4 className="text-sm font-semibold text-slate-800 mb-4">
                      Task Checklist
                    </h4>
                    {!shift.tasks || shift.tasks.length === 0 ? (
                      <p className="text-sm text-slate-500 italic">
                        No tasks assigned during this shift.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {shift.tasks.map((task: Task) => (
                          <div
                            key={task.id}
                            className="flex items-start gap-3 p-3 rounded-md bg-slate-50 border border-slate-100"
                          >
                            <div className="pt-0.5">
                              {task.status === "completed" ? (
                                <CheckCircle2
                                  size={18}
                                  className="text-emerald-500"
                                />
                              ) : (
                                <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-300"></div>
                              )}
                            </div>
                            <div>
                              <p
                                className={`text-sm font-medium ${task.status === "completed" ? "text-slate-700" : "text-slate-500"}`}
                              >
                                {task.template?.name}
                              </p>
                              {task.status === "completed" &&
                                task.completed_at && (
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    {new Date(
                                      task.completed_at,
                                    ).toLocaleTimeString()}
                                  </p>
                                )}
                              {task.photo_url && (
                                <a
                                  href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/shift_photos/${task.photo_url}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                                >
                                  View Photo Evidence
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
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
  );
}
