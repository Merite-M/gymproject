"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  Star,
  Users,
} from "lucide-react";
import {
  type Resources,
  type Session,
  addDays,
  fetchResources,
  fetchSessions,
  formatHour,
  isWithinOffPeak,
  startOfWeek,
} from "@/lib/calendar";
import RosterDrawer from "./RosterDrawer";
import ScheduleSessionModal from "./ScheduleSessionModal";

const HOURS = Array.from({ length: 15 }, (_, index) => index + 6); // 06:00 - 20:00

export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [resources, setResources] = useState<Resources | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [facilityFilter, setFacilityFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [schedulingSlot, setSchedulingSlot] = useState<Date | null>(null);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSessions(
        weekStart,
        addDays(weekStart, 7),
        facilityFilter || undefined,
      );
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load calendar");
    }
    setLoading(false);
  }, [weekStart, facilityFilter]);

  useEffect(() => {
    fetchResources()
      .then(setResources)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load resources"),
      );
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const sessionsFor = (day: Date, hour: number) =>
    sessions.filter((session) => {
      const start = new Date(session.starts_at);
      return (
        start.getFullYear() === day.getFullYear() &&
        start.getMonth() === day.getMonth() &&
        start.getDate() === day.getDate() &&
        start.getHours() === hour
      );
    });

  const weekLabel = `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${addDays(
    weekStart,
    6,
  ).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">
            Calendar Bookings Matrix
          </h1>
          <p className="text-sm text-[#64748B]">
            Resource-aware scheduling with conflict resolution and automatic
            waitlist promotion.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={facilityFilter}
            onChange={(event) => setFacilityFilter(event.target.value)}
            aria-label="Room filter"
            className="rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
          >
            <option value="">Room filter: ALL</option>
            {(resources?.facilities || []).map((facility) => (
              <option key={facility.id} value={facility.id}>
                {facility.name}
              </option>
            ))}
          </select>

          <div className="flex items-center rounded-md border border-[#E2E8F0] bg-white">
            <button
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              aria-label="Previous week"
              className="px-2 py-2 text-[#64748B] hover:text-[#0f172a]"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="px-3 text-sm font-medium text-[#0f172a]">
              {weekLabel}
            </span>
            <button
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              aria-label="Next week"
              className="px-2 py-2 text-[#64748B] hover:text-[#0f172a]"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <button
            onClick={() => setSchedulingSlot(new Date(weekStart))}
            disabled={!resources}
            className="flex items-center gap-2 rounded-md bg-[#0f172a] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <CalendarPlus size={16} /> Schedule Session
          </button>
        </div>
      </header>

      {error && (
        <p className="mb-4 rounded-md bg-[#FEE2E2] px-4 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-[#E2E8F0] bg-white">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="bg-[#F8FAFC] text-left">
              <th className="w-20 border-b border-[#E2E8F0] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Time
              </th>
              {days.map((day) => (
                <th
                  key={day.toISOString()}
                  className="border-b border-l border-[#E2E8F0] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#64748B]"
                >
                  {day.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((hour) => (
              <tr key={hour} className="align-top">
                <td className="border-b border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#64748B]">
                  {formatHour(hour)}
                </td>
                {days.map((day) => {
                  const offPeak = isWithinOffPeak(
                    resources?.off_peak_windows || [],
                    day,
                    hour,
                  );
                  const cellSessions = sessionsFor(day, hour);

                  if (offPeak && cellSessions.length === 0) {
                    return (
                      <td
                        key={`${day.toISOString()}-${hour}`}
                        className={`border-b border-l border-[#E2E8F0] px-3 py-2 text-xs ${
                          offPeak.access_mode === "locked"
                            ? "bg-[#F1F5F9] text-[#475569]"
                            : "bg-[#FEF3C7] text-[#92400E]"
                        }`}
                      >
                        <span className="flex items-center gap-1 font-semibold uppercase tracking-wider">
                          {offPeak.access_mode === "locked" ? (
                            <Lock size={12} />
                          ) : (
                            <Star size={12} />
                          )}
                          {offPeak.label}
                        </span>
                        <span className="mt-0.5 block">
                          {offPeak.access_mode === "locked"
                            ? "Door entry locked"
                            : "Premium members only"}
                        </span>
                      </td>
                    );
                  }

                  return (
                    <td
                      key={`${day.toISOString()}-${hour}`}
                      className="border-b border-l border-[#E2E8F0] px-2 py-2"
                    >
                      <div className="space-y-1">
                        {cellSessions.map((session) => (
                          <button
                            key={session.id}
                            onClick={() => setActiveSession(session)}
                            className={`w-full rounded-md border-l-2 px-2 py-1.5 text-left text-xs transition-colors hover:bg-[#F1F5F9] ${
                              session.is_overflow || session.seats_left === 0
                                ? "border-[#EF4444] bg-[#FEE2E2]/50"
                                : "border-[#2563EB] bg-[#EFF6FF]"
                            }`}
                          >
                            <span className="block font-semibold text-[#0f172a]">
                              {session.class?.name || "Session"}
                            </span>
                            <span className="block text-[#64748B]">
                              Coach: {session.trainer?.full_name || "Unassigned"}
                            </span>
                            <span className="flex items-center gap-1 text-[#64748B]">
                              <Users size={11} />
                              {session.facility?.name || "No room"} (
                              {session.booked_count}/{session.capacity})
                              {session.is_overflow && (
                                <span className="font-bold text-[#EF4444]">
                                  OVERFLOW
                                </span>
                              )}
                            </span>
                            {session.waitlist_count > 0 && (
                              <span className="mt-0.5 inline-block rounded bg-[#FEF3C7] px-1 text-[10px] font-semibold text-[#92400E]">
                                {session.waitlist_count} waiting
                              </span>
                            )}
                          </button>
                        ))}

                        <button
                          onClick={() => {
                            const slot = new Date(day);
                            slot.setHours(hour, 0, 0, 0);
                            setSchedulingSlot(slot);
                          }}
                          disabled={!resources}
                          className="w-full rounded-md border border-dashed border-[#E2E8F0] py-1 text-[11px] text-[#94A3B8] hover:border-[#0f172a] hover:text-[#0f172a] disabled:opacity-40"
                        >
                          + Available slot
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading calendar…
        </div>
      )}

      {activeSession && (
        <RosterDrawer
          session={activeSession}
          onClose={() => setActiveSession(null)}
          onChanged={loadSessions}
        />
      )}

      {schedulingSlot && resources && (
        <ScheduleSessionModal
          resources={resources}
          defaultStart={schedulingSlot}
          onClose={() => setSchedulingSlot(null)}
          onCreated={() => {
            setSchedulingSlot(null);
            loadSessions();
          }}
        />
      )}
    </div>
  );
}
