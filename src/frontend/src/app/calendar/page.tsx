"use client";

import { useState, useEffect } from "react";
import { useTenantId } from "@/contexts/AuthContext";
import { fetchCalendarPolicies, updateCalendarPolicies, fetchWaitlists, updateSchedule } from "@/lib/api/calendar";
import Link from "next/link";
import {
  Calendar as CalendarIcon,
  Search,
  Clock,
  MapPin,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Grid,
  CalendarDays,
  ShieldAlert,
  Ticket,
  UserCheck,
  CreditCard
} from "lucide-react";
import { cn, formatCurrencyDisplay } from "@/lib/utils";

export default function SchedulePage() {
  const tenantId = useTenantId();
  const [viewMode, setViewMode] = useState<"weekly" | "day" | "conflicts" | "rooms" | "rentals" | "policies">("weekly");
  const [selectedDay, setSelectedDay] = useState<string>("Monday");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFacilityForRental, setSelectedFacilityForRental] = useState<any | null>(null);
  const [rentalHours, setRentalHours] = useState(1);
  const [rentalDate, setRentalDate] = useState("2026-08-25");
  const [rentalStartTime, setRentalStartTime] = useState("14:00");
  const [rentalNotes, setRentalNotes] = useState("");
  const [showRentalSuccess, setShowRentalSuccess] = useState(false);

  // Policy state
  const [cancellationWindowHours, setCancellationWindowHours] = useState(2);
  const [lateCancelFeeRwf, setLateCancelFeeRwf] = useState(5000);
  const [noShowPenaltyRwf, setNoShowPenaltyRwf] = useState(10000);
  const [maxNoShowStrikes, setMaxNoShowStrikes] = useState(3);
  const [policySaved, setPolicySaved] = useState(false);

  // Schedules state
  interface ScheduleItem {
    id: string;
    title: string;
    instructor: string;
    room: string;
    day: string;
    time: string;
    duration: number;
    capacity: number;
    enrolled: number;
    waitlistCount?: number;
    conflicts: string[];
  }

  const [schedules, setSchedules] = useState<ScheduleItem[]>([
    {
      id: "1",
      title: "Power Yoga",
      instructor: "Coach Sarah",
      room: "Yoga Hall",
      day: "Monday",
      time: "08:00",
      duration: 60,
      capacity: 20,
      enrolled: 15,
      conflicts: [],
    },
    {
      id: "2",
      title: "CrossFit WOD",
      instructor: "Coach Mike",
      room: "Main Floor",
      day: "Monday",
      time: "10:00",
      duration: 60,
      capacity: 25,
      enrolled: 25,
      waitlistCount: 3,
      conflicts: [],
    },
    {
      id: "3",
      title: "HIIT Training",
      instructor: "Coach Sarah",
      room: "Main Floor",
      day: "Monday",
      time: "10:00",
      duration: 45,
      capacity: 15,
      enrolled: 12,
      conflicts: ["room_conflict", "instructor_conflict"],
    },
    {
      id: "4",
      title: "Spinning Class",
      instructor: "Coach Emma",
      room: "Studio A",
      day: "Tuesday",
      time: "07:00",
      duration: 45,
      capacity: 20,
      enrolled: 18,
      conflicts: [],
    },
    {
      id: "5",
      title: "Pilates Reformer",
      instructor: "Coach Sarah",
      room: "Studio B",
      day: "Wednesday",
      time: "14:00",
      duration: 60,
      capacity: 10,
      enrolled: 10,
      waitlistCount: 2,
      conflicts: [],
    }
  ]);

  // Facilities & Equipment for Hourly Rental
  const [facilities] = useState([
    { id: "1", name: "Squash Court A", capacity: 4, type: "Squash Court", hourlyRateRwf: 15000, status: "Available" },
    { id: "2", name: "Private Sauna Suite 1", capacity: 2, type: "Wellness Suite", hourlyRateRwf: 25000, status: "Available" },
    { id: "3", name: "Private Studio Room B", capacity: 15, type: "Studio", hourlyRateRwf: 20000, status: "Available" },
    { id: "4", name: "Spin Bike Cluster (10 Bikes)", capacity: 10, type: "Equipment Group", hourlyRateRwf: 12000, status: "Booked" },
  ]);

  const [rentals, setRentals] = useState([
    {
      id: "r1",
      facilityName: "Squash Court A",
      memberName: "Jean-Paul Habimana",
      startTime: "2026-08-25 14:00",
      endTime: "2026-08-25 16:00",
      totalFeeRwf: 30000,
      status: "Confirmed"
    },
    {
      id: "r2",
      facilityName: "Private Sauna Suite 1",
      memberName: "Marie Claire Uwase",
      startTime: "2026-08-25 17:00",
      endTime: "2026-08-25 18:00",
      totalFeeRwf: 25000,
      status: "Confirmed"
    }
  ]);

  const [waitlistEntries, setWaitlistEntries] = useState<any[]>([
    { id: "w1", className: "CrossFit WOD", memberName: "Eric Mugisha", joinedAt: "10 mins ago", status: "Waiting", position: 1 },
    { id: "w2", className: "CrossFit WOD", memberName: "Divine Ineza", joinedAt: "5 mins ago", status: "Waiting", position: 2 },
    { id: "w3", className: "Pilates Reformer", memberName: "Alice Kayitesi", joinedAt: "1 hour ago", status: "Promoted & Booked", position: 0 },
  ]);

  useEffect(() => {
    if (!tenantId) return;
    const loadPoliciesAndWaitlist = async () => {
      try {
        const polRes = await fetchCalendarPolicies(tenantId);
        if (polRes.success && polRes.policies) {
          setCancellationWindowHours(polRes.policies.cancellation_window_hours ?? 2);
          setLateCancelFeeRwf(polRes.policies.late_cancel_fee_rwf ?? 5000);
          setNoShowPenaltyRwf(polRes.policies.no_show_penalty_rwf ?? 10000);
          setMaxNoShowStrikes(polRes.policies.max_no_show_strikes ?? 3);
        }
      } catch (err) {
        console.error("Failed to load calendar policies:", err);
      }

      try {
        const waitRes = await fetchWaitlists(tenantId);
        if (waitRes.success && waitRes.waitlists && waitRes.waitlists.length > 0) {
          const mapped = waitRes.waitlists.map((w: any) => ({
            id: w.id,
            className: w.class_schedules?.title || "Group Fitness Class",
            memberName: w.profiles ? `${w.profiles.first_name || ''} ${w.profiles.last_name || ''}`.trim() : "Member",
            joinedAt: new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: w.status === 'promoted' ? "Promoted & Booked" : "Waiting",
            position: 1
          }));
          setWaitlistEntries(mapped);
        }
      } catch (err) {
        console.error("Failed to load waitlists:", err);
      }
    };
    loadPoliciesAndWaitlist();
  }, [tenantId]);

  const handleSavePolicyEngineSettings = async () => {
    if (!tenantId) return;
    try {
      await updateCalendarPolicies({
        tenant_id: tenantId,
        cancellation_window_hours: cancellationWindowHours,
        late_cancel_fee_rwf: lateCancelFeeRwf,
        no_show_penalty_rwf: noShowPenaltyRwf,
        max_no_show_strikes: maxNoShowStrikes
      });
      setPolicySaved(true);
      setTimeout(() => setPolicySaved(false), 2000);
    } catch (err) {
      console.error("Failed to save policy settings:", err);
    }
  };

  const handleFixConflict = async (scheduleId: string, updates: Partial<ScheduleItem>) => {
    if (tenantId) {
      try {
        await updateSchedule(scheduleId, { tenant_id: tenantId, ...updates });
      } catch (err) {
        console.error("Failed to update schedule conflict fix:", err);
      }
    }
    setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, ...updates, conflicts: [] } : s));
  };

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const timeSlots = ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

  const handleBookRental = () => {
    if (!selectedFacilityForRental) return;
    const fee = selectedFacilityForRental.hourlyRateRwf * rentalHours;
    const newRental = {
      id: `r${Date.now()}`,
      facilityName: selectedFacilityForRental.name,
      memberName: "Current Receptionist / Member",
      startTime: `${rentalDate} ${rentalStartTime}`,
      endTime: `${rentalDate} ${parseInt(rentalStartTime.split(":")[0]) + rentalHours}:00`,
      totalFeeRwf: fee,
      status: "Confirmed"
    };
    setRentals([newRental, ...rentals]);
    setShowRentalSuccess(true);
    setTimeout(() => {
      setShowRentalSuccess(false);
      setSelectedFacilityForRental(null);
    }, 2000);
  };

  const filteredSchedules = schedules.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.instructor.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.room.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-headline-md font-bold text-foreground flex items-center gap-2">
              <CalendarIcon className="w-6 h-6 text-primary shrink-0" />
              <span>Class Calendar & Facility Rentals</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Week/Day grid, conflict warnings, hourly rentals & booking policies</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:w-64 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search classes or rooms..."
                className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-foreground placeholder:text-muted-foreground text-xs sm:text-sm min-h-[40px]"
              />
            </div>
            <button
              onClick={() => setViewMode("rentals")}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 flex items-center gap-2 min-h-[44px] text-xs sm:text-sm font-medium shrink-0"
            >
              <Ticket className="w-4 h-4" />
              <span>Rent Facility Resource</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs Bar */}
      <div className="border-b border-border bg-card overflow-x-auto">
        <div className="flex min-w-max px-2">
          <button
            onClick={() => setViewMode("weekly")}
            className={cn(
              "flex items-center gap-2 px-4 sm:px-6 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors min-h-[44px] whitespace-nowrap",
              viewMode === "weekly"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Grid className="w-4 h-4" />
            Week Grid View
          </button>
          <button
            onClick={() => setViewMode("day")}
            className={cn(
              "flex items-center gap-2 px-4 sm:px-6 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors min-h-[44px] whitespace-nowrap",
              viewMode === "day"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <CalendarDays className="w-4 h-4" />
            Day View ({selectedDay})
          </button>
          <Link
            href="/calendar/rentals"
            className="flex items-center gap-2 px-4 sm:px-6 py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-amber-400 hover:text-amber-300 hover:bg-muted/50 transition-colors min-h-[44px] whitespace-nowrap"
          >
            <Ticket className="w-4 h-4" />
            Dedicated Space & Equipment Rental Engine →
          </Link>
          <button
            onClick={() => setViewMode("rentals")}
            className={cn(
              "flex items-center gap-2 px-4 sm:px-6 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors min-h-[44px] whitespace-nowrap",
              viewMode === "rentals"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Ticket className="w-4 h-4" />
            Facility Resource Rental
          </button>
          <button
            onClick={() => setViewMode("conflicts")}
            className={cn(
              "flex items-center gap-2 px-4 sm:px-6 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors min-h-[44px] whitespace-nowrap relative",
              viewMode === "conflicts"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <AlertTriangle className="w-4 h-4" />
            Conflict Matrix
            {schedules.some(s => s.conflicts.length > 0) && (
              <span className="w-2 h-2 rounded-full bg-status-blocked animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setViewMode("policies")}
            className={cn(
              "flex items-center gap-2 px-4 sm:px-6 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors min-h-[44px] whitespace-nowrap",
              viewMode === "policies"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <ShieldAlert className="w-4 h-4" />
            Booking Policies & Waitlists
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-auto">
        {viewMode === "weekly" && (
          <div className="p-4 sm:p-6">
            <div className="bg-card border border-border rounded-lg overflow-x-auto">
              <div className="min-w-[800px]">
                {/* Header Days */}
                <div className="grid grid-cols-8 border-b border-border bg-muted/50">
                  <div className="p-3 border-r border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
                    Time
                  </div>
                  {days.map((day) => (
                    <button
                      key={day}
                      onClick={() => { setSelectedDay(day); setViewMode("day"); }}
                      className="p-3 border-r border-border text-center hover:bg-muted/80 transition-colors"
                    >
                      <div className="text-xs sm:text-sm font-semibold text-foreground">{day}</div>
                    </button>
                  ))}
                </div>

                {/* Time Slots Grid */}
                <div className="max-h-[600px] overflow-y-auto">
                  {timeSlots.map((time) => (
                    <div key={time} className="grid grid-cols-8 border-b border-border min-h-[80px]">
                      <div className="p-2 border-r border-border text-xs font-medium text-muted-foreground text-right pr-3 bg-card">
                        {time}
                      </div>
                      {days.map((day) => (
                        <div key={`${time}-${day}`} className="border-r border-border p-1 relative hover:bg-muted/30 transition-colors">
                          {filteredSchedules
                            .filter(s => s.day === day && s.time === time)
                            .map((schedule) => (
                              <div
                                key={schedule.id}
                                className={cn(
                                  "text-xs p-2 rounded mb-1 cursor-pointer transition-all shadow-sm",
                                  schedule.conflicts.length > 0
                                    ? "bg-status-blocked/15 border-2 border-status-blocked text-status-blocked font-semibold animate-pulse"
                                    : "bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20"
                                )}
                              >
                                <div className="font-semibold truncate">{schedule.title}</div>
                                <div className="text-[11px] opacity-80 truncate">{schedule.instructor} • {schedule.room}</div>
                                <div className="flex items-center justify-between mt-1 text-[10px]">
                                  <span>{schedule.enrolled}/{schedule.capacity} booked</span>
                                  {schedule.waitlistCount && (
                                    <span className="bg-amber-500/20 text-amber-700 dark:text-amber-400 px-1 rounded">
                                      WL: {schedule.waitlistCount}
                                    </span>
                                  )}
                                </div>
                                {schedule.conflicts.length > 0 && (
                                  <div className="flex items-center gap-1 mt-1 font-bold text-status-blocked text-[10px]">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>Conflict</span>
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === "day" && (
          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h2 className="text-base sm:text-lg font-headline-md font-semibold text-foreground">
                Day Grid View: {selectedDay}
              </h2>
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
                {days.map((day) => (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-lg font-medium transition-colors whitespace-nowrap min-h-[36px]",
                      selectedDay === day
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4 space-y-4">
              {timeSlots.map((time) => {
                const daySchedules = filteredSchedules.filter(s => s.day === selectedDay && s.time === time);
                return (
                  <div key={time} className="flex border-b border-border pb-4 last:border-none">
                    <div className="w-16 sm:w-20 font-mono text-xs sm:text-sm font-semibold text-muted-foreground pt-2 shrink-0">
                      {time}
                    </div>
                    <div className="flex-1 space-y-2 min-w-0">
                      {daySchedules.length === 0 ? (
                        <div className="text-xs text-muted-foreground/60 italic pt-2">No scheduled classes</div>
                      ) : (
                        daySchedules.map((schedule) => (
                          <div
                            key={schedule.id}
                            className={cn(
                              "p-3.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2",
                              schedule.conflicts.length > 0
                                ? "bg-status-blocked/10 border-status-blocked"
                                : "bg-card border-border hover:border-primary/50"
                            )}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-foreground text-sm">{schedule.title}</h3>
                                {schedule.conflicts.length > 0 && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-status-blocked/20 text-status-blocked flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    Conflict Warning
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Instructor: <span className="text-foreground">{schedule.instructor}</span> • Room: <span className="text-foreground">{schedule.room}</span> • Duration: {schedule.duration}m
                              </p>
                            </div>
                            <div className="text-left sm:text-right shrink-0">
                              <span className="text-xs font-medium text-foreground">
                                {schedule.enrolled} / {schedule.capacity} Booked
                              </span>
                              {schedule.waitlistCount && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                                  {schedule.waitlistCount} on Waitlist
                                </p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === "rentals" && (
          <div className="p-4 sm:p-6 space-y-6">
            <div>
              <h2 className="text-base sm:text-lg font-headline-md font-semibold text-foreground">Facility & Equipment Hourly Rental</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">Book private rooms, squash courts, sauna suites, and spin bike clusters with hourly billing</p>
            </div>

            {/* Facilities List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {facilities.map((facility) => (
                <div key={facility.id} className="bg-card border border-border rounded-lg p-5 flex flex-col justify-between hover:border-primary/50 transition-all">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {facility.type}
                      </span>
                      <span className="text-xs font-medium text-status-cleared bg-status-cleared/10 px-2 py-0.5 rounded">
                        {facility.status}
                      </span>
                    </div>
                    <h3 className="font-semibold text-foreground text-base mb-1">{facility.name}</h3>
                    <p className="text-xs text-muted-foreground mb-4">Capacity: {facility.capacity} people</p>
                    <div className="text-lg font-bold text-primary mb-4">
                      {formatCurrencyDisplay(facility.hourlyRateRwf)} <span className="text-xs text-muted-foreground font-normal">/ hour</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedFacilityForRental(facility)}
                    className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium transition-colors min-h-[44px]"
                  >
                    Rent Now
                  </button>
                </div>
              ))}
            </div>

            {/* Existing Rentals Ledger */}
            <div className="bg-card border border-border rounded-lg p-4 sm:p-5">
              <h3 className="font-semibold text-foreground text-sm sm:text-base mb-4 flex items-center gap-2">
                <Ticket className="w-5 h-5 text-primary" />
                Active & Upcoming Hourly Rentals
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm text-left">
                  <thead className="text-xs text-muted-foreground bg-muted/50 uppercase">
                    <tr>
                      <th className="p-3">Facility / Resource</th>
                      <th className="p-3">Member</th>
                      <th className="p-3">Start Time</th>
                      <th className="p-3">End Time</th>
                      <th className="p-3">Total Fee</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rentals.map((r) => (
                      <tr key={r.id} className="border-b border-border">
                        <td className="p-3 font-semibold text-foreground">{r.facilityName}</td>
                        <td className="p-3 text-muted-foreground">{r.memberName}</td>
                        <td className="p-3 font-mono text-xs">{r.startTime}</td>
                        <td className="p-3 font-mono text-xs">{r.endTime}</td>
                        <td className="p-3 font-semibold text-primary">{formatCurrencyDisplay(r.totalFeeRwf)}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-status-cleared/15 text-status-cleared">
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Rental Modal */}
            {selectedFacilityForRental && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4 my-8">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="font-bold text-lg text-foreground">Rent {selectedFacilityForRental.name}</h3>
                    <button onClick={() => setSelectedFacilityForRental(null)} className="text-muted-foreground hover:text-foreground p-1">
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Hourly Rate</label>
                      <div className="font-bold text-primary">{formatCurrencyDisplay(selectedFacilityForRental.hourlyRateRwf)} / hour</div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Rental Date</label>
                      <input
                        type="date"
                        value={rentalDate}
                        onChange={(e) => setRentalDate(e.target.value)}
                        className="w-full p-2.5 bg-muted border border-border rounded-lg text-foreground text-sm min-h-[40px]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Start Time</label>
                      <input
                        type="time"
                        value={rentalStartTime}
                        onChange={(e) => setRentalStartTime(e.target.value)}
                        className="w-full p-2.5 bg-muted border border-border rounded-lg text-foreground text-sm min-h-[40px]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Duration (Hours)</label>
                      <input
                        type="number"
                        min="1"
                        max="8"
                        value={rentalHours}
                        onChange={(e) => setRentalHours(parseInt(e.target.value) || 1)}
                        className="w-full p-2.5 bg-muted border border-border rounded-lg text-foreground text-sm min-h-[40px]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Notes / Purpose</label>
                      <input
                        type="text"
                        placeholder="e.g. Member private coaching session"
                        value={rentalNotes}
                        onChange={(e) => setRentalNotes(e.target.value)}
                        className="w-full p-2.5 bg-muted border border-border rounded-lg text-foreground text-sm min-h-[40px]"
                      />
                    </div>

                    <div className="pt-3 border-t border-border flex items-center justify-between font-bold text-base">
                      <span>Total Rental Fee:</span>
                      <span className="text-primary">{formatCurrencyDisplay(selectedFacilityForRental.hourlyRateRwf * rentalHours)}</span>
                    </div>

                    {showRentalSuccess && (
                      <div className="p-3 bg-status-cleared/20 text-status-cleared border border-status-cleared/30 rounded-lg text-center font-semibold text-xs">
                        Rental Confirmed & Added to Ledger!
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-4">
                    <button
                      onClick={() => setSelectedFacilityForRental(null)}
                      className="flex-1 py-2.5 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 text-sm font-medium min-h-[44px]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBookRental}
                      className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-semibold min-h-[44px]"
                    >
                      Confirm Booking
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {viewMode === "conflicts" && (
          <div className="p-4 sm:p-6 space-y-6">
            <h2 className="text-base sm:text-lg font-headline-md font-semibold text-foreground">Conflict Matrix & Resolution</h2>

            {schedules.filter(s => s.conflicts.length > 0).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50 text-status-cleared" />
                <p className="text-sm">No conflicts detected</p>
                <p className="text-xs mt-1">All schedules are properly assigned</p>
              </div>
            ) : (
              <div className="space-y-4">
                {schedules
                  .filter(s => s.conflicts.length > 0)
                  .map((schedule) => (
                    <div key={schedule.id} className="bg-status-blocked/10 border border-status-blocked/20 rounded-lg p-4 sm:p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-status-blocked/20 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-5 h-5 text-status-blocked" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-headline-md font-semibold text-foreground text-sm sm:text-base">{schedule.title}</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground mb-3">
                            {schedule.day} at {schedule.time} • Room: {schedule.room} • Instructor: {schedule.instructor}
                          </p>

                          <div className="space-y-2">
                            {schedule.conflicts.includes("room_conflict") && (
                              <div className="flex items-center gap-2 text-xs sm:text-sm text-status-blocked font-medium">
                                <MapPin className="w-4 h-4 shrink-0" />
                                <span>Room conflict: {schedule.room} is double-booked during this slot</span>
                              </div>
                            )}
                            {schedule.conflicts.includes("instructor_conflict") && (
                              <div className="flex items-center gap-2 text-xs sm:text-sm text-status-blocked font-medium">
                                <Users className="w-4 h-4 shrink-0" />
                                <span>Instructor conflict: {schedule.instructor} is double-booked during this slot</span>
                              </div>
                            )}
                          </div>

                          <div className="mt-4 pt-4 border-t border-status-blocked/20">
                            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Recommended Conflict Fixes:</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <button
                                onClick={() => handleFixConflict(schedule.id, { room: "Studio B" })}
                                className="px-3 py-2 bg-card border border-border text-foreground rounded-lg text-xs hover:border-primary flex items-center gap-2 transition-colors font-medium min-h-[40px]"
                              >
                                <MapPin className="w-4 h-4 text-primary shrink-0" />
                                Reassign to Studio B
                              </button>
                              <button
                                onClick={() => handleFixConflict(schedule.id, { instructor: "Coach Emma" })}
                                className="px-3 py-2 bg-card border border-border text-foreground rounded-lg text-xs hover:border-primary flex items-center gap-2 transition-colors font-medium min-h-[40px]"
                              >
                                <Users className="w-4 h-4 text-primary shrink-0" />
                                Reassign to Coach Emma
                              </button>
                              <button
                                onClick={() => handleFixConflict(schedule.id, { time: "11:00" })}
                                className="px-3 py-2 bg-card border border-border text-foreground rounded-lg text-xs hover:border-primary flex items-center gap-2 transition-colors font-medium min-h-[40px]"
                              >
                                <Clock className="w-4 h-4 text-primary shrink-0" />
                                Reschedule to 11:00
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {viewMode === "policies" && (
          <div className="p-4 sm:p-6 space-y-6">
            <h2 className="text-base sm:text-lg font-headline-md font-semibold text-foreground flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary shrink-0" />
              <span>Booking Policies, Penalties & Automated Waitlists</span>
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-lg p-4 sm:p-5 space-y-4">
                <h3 className="font-semibold text-foreground text-sm sm:text-base flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary shrink-0" />
                  Cancellation & Penalty Engine Configuration
                </h3>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Free Cancellation Window (Hours Before Class)
                  </label>
                  <input
                    type="number"
                    value={cancellationWindowHours}
                    onChange={(e) => setCancellationWindowHours(parseInt(e.target.value) || 0)}
                    className="w-full p-2.5 bg-muted border border-border rounded-lg text-foreground text-sm min-h-[40px]"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Cancellations within this window trigger late-cancel fee.</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Late Cancellation Penalty Fee (RWF)
                  </label>
                  <input
                    type="number"
                    value={lateCancelFeeRwf}
                    onChange={(e) => setLateCancelFeeRwf(parseInt(e.target.value) || 0)}
                    className="w-full p-2.5 bg-muted border border-border rounded-lg text-foreground text-sm min-h-[40px]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    No-Show Penalty Fee (RWF)
                  </label>
                  <input
                    type="number"
                    value={noShowPenaltyRwf}
                    onChange={(e) => setNoShowPenaltyRwf(parseInt(e.target.value) || 0)}
                    className="w-full p-2.5 bg-muted border border-border rounded-lg text-foreground text-sm min-h-[40px]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Max No-Show Strikes Allowed Before Suspension
                  </label>
                  <input
                    type="number"
                    value={maxNoShowStrikes}
                    onChange={(e) => setMaxNoShowStrikes(parseInt(e.target.value) || 3)}
                    className="w-full p-2.5 bg-muted border border-border rounded-lg text-foreground text-sm min-h-[40px]"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleSavePolicyEngineSettings}
                    className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-semibold min-h-[44px]"
                  >
                    Save Policy Engine Settings
                  </button>
                  {policySaved && (
                    <span className="text-xs text-status-cleared font-semibold">Saved!</span>
                  )}
                </div>
              </div>

              {/* Waitlist Queue Live Monitor */}
              <div className="bg-card border border-border rounded-lg p-4 sm:p-5 space-y-4">
                <h3 className="font-semibold text-foreground text-sm sm:text-base flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-primary shrink-0" />
                  Automated Waitlist Promotion Queue
                </h3>
                <p className="text-xs text-muted-foreground">When cancellations occur, members are automatically promoted and notified via Push/SMS.</p>

                <div className="space-y-3">
                  {waitlistEntries.map((entry) => (
                    <div key={entry.id} className="p-3 bg-muted/40 border border-border rounded-lg flex items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-xs sm:text-sm text-foreground">{entry.memberName}</div>
                        <div className="text-[11px] text-muted-foreground">{entry.className} • Joined {entry.joinedAt}</div>
                      </div>
                      <span className={cn(
                        "text-[11px] px-2 py-0.5 rounded font-medium shrink-0",
                        entry.status === "Promoted & Booked"
                          ? "bg-status-cleared/20 text-status-cleared"
                          : "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                      )}>
                        {entry.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
