"use client";

import { useState } from "react";
import { Calendar, Plus, Search, Filter, Clock, MapPin, Users, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SchedulePage() {
  const [viewMode, setViewMode] = useState<"weekly" | "conflicts" | "rooms">("weekly");
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Mock schedule data
  const schedules = [
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
      enrolled: 22,
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
  ];

  const rooms = [
    { id: "1", name: "Yoga Hall", capacity: 25, type: "Studio" },
    { id: "2", name: "Main Floor", capacity: 40, type: "Open Space" },
    { id: "3", name: "Studio A", capacity: 20, type: "Studio" },
    { id: "4", name: "Studio B", capacity: 15, type: "Studio" },
  ];

  const instructors = [
    { id: "1", name: "Coach Sarah", specialties: ["Yoga", "HIIT"] },
    { id: "2", name: "Coach Mike", specialties: ["CrossFit", "Strength"] },
    { id: "3", name: "Coach Emma", specialties: ["Spinning", "Cardio"] },
  ];

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const timeSlots = ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

  const hasConflicts = schedules.some(s => s.conflicts.length > 0);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-headline-md font-bold text-foreground">Schedule & Conflict Manager</h1>
            <p className="text-sm text-muted-foreground">Weekly classes with resource assignment and conflict resolution</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search classes..."
                className="pl-10 pr-4 py-2 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-foreground placeholder:text-muted-foreground w-64"
              />
            </div>
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/80 flex items-center gap-2 min-h-[44px]">
              <Plus className="w-4 h-4" />
              Schedule Class
            </button>
          </div>
        </div>
      </header>

      {/* View Mode Tabs */}
      <div className="border-b border-border bg-card">
        <div className="flex">
          <button
            onClick={() => setViewMode("weekly")}
            className={cn(
              "flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors min-h-[44px]",
              viewMode === "weekly"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Calendar className="w-4 h-4" />
            Weekly Calendar
          </button>
          <button
            onClick={() => setViewMode("conflicts")}
            className={cn(
              "flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors min-h-[44px]",
              viewMode === "conflicts"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <AlertTriangle className="w-4 h-4" />
            Conflicts
            {hasConflicts && (
              <span className="bg-status-blocked text-status-blocked-foreground text-xs px-2 py-0.5 rounded-full">
                {schedules.filter(s => s.conflicts.length > 0).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setViewMode("rooms")}
            className={cn(
              "flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors min-h-[44px]",
              viewMode === "rooms"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <MapPin className="w-4 h-4" />
            Room Assignments
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === "weekly" && (
          <div className="p-6">
            {/* Weekly Calendar Grid */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              {/* Calendar Header */}
              <div className="grid grid-cols-8 border-b border-border bg-muted/30">
                <div className="p-3 border-r border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
                  Time
                </div>
                {days.map((day) => (
                  <div key={day} className="p-3 border-r border-border text-center">
                    <div className="text-sm font-semibold text-foreground">{day}</div>
                  </div>
                ))}
              </div>

              {/* Calendar Body */}
              <div className="max-h-[600px] overflow-y-auto">
                {timeSlots.map((time) => (
                  <div key={time} className="grid grid-cols-8 border-b border-border h-16">
                    <div className="p-2 border-r border-border text-xs font-medium text-muted-foreground text-right pr-4 bg-card">
                      {time}
                    </div>
                    {days.map((day) => (
                      <div key={`${time}-${day}`} className="border-r border-border p-1 relative">
                        {schedules
                          .filter(s => s.day === day && s.time === time)
                          .map((schedule) => (
                            <div
                              key={schedule.id}
                              className={cn(
                                "text-xs p-2 rounded mb-1 cursor-pointer transition-colors",
                                schedule.conflicts.length > 0
                                  ? "bg-status-blocked/10 border border-status-blocked/20 text-status-blocked"
                                  : "bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20"
                              )}
                            >
                              <div className="font-medium truncate">{schedule.title}</div>
                              <div className="text-xs opacity-70 truncate">{schedule.instructor}</div>
                              <div className="text-xs opacity-70 truncate">{schedule.room}</div>
                              {schedule.conflicts.length > 0 && (
                                <div className="flex items-center gap-1 mt-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span className="text-xs">Conflict</span>
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

            {/* Off-Peak Access Blocks */}
            <div className="mt-6 bg-status-action/10 border border-status-action/20 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle className="w-5 h-5 text-status-action" />
                <div>
                  <h3 className="font-headline-md font-semibold text-status-action">Off-Peak Access Blocks</h3>
                  <p className="text-sm text-muted-foreground">Time-based access restrictions for cost optimization</p>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {days.map((day) => (
                  <div key={day} className="bg-card border border-border rounded p-3">
                    <div className="text-xs font-medium text-foreground mb-2">{day}</div>
                    <div className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-1 mb-1">
                        <Clock className="w-3 h-3" />
                        <span>11:00 - 15:00</span>
                      </div>
                      <span className="text-status-action">Restricted Access</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {viewMode === "conflicts" && (
          <div className="p-6">
            <h2 className="text-lg font-headline-md font-semibold text-foreground mb-4">Conflict Resolution</h2>
            
            {schedules.filter(s => s.conflicts.length > 0).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50 text-status-cleared" />
                <p className="text-sm">No conflicts detected</p>
                <p className="text-xs mt-2">All schedules are properly assigned</p>
              </div>
            ) : (
              <div className="space-y-4">
                {schedules
                  .filter(s => s.conflicts.length > 0)
                  .map((schedule) => (
                    <div key={schedule.id} className="bg-status-blocked/10 border border-status-blocked/20 rounded-lg p-4">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-status-blocked/20 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-5 h-5 text-status-blocked" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-headline-md font-semibold text-foreground">{schedule.title}</h3>
                          <p className="text-sm text-muted-foreground mb-2">
                            {schedule.day} at {schedule.time} • {schedule.room} • {schedule.instructor}
                          </p>
                          
                          <div className="space-y-2">
                            {schedule.conflicts.includes("room_conflict") && (
                              <div className="flex items-center gap-2 text-sm">
                                <MapPin className="w-4 h-4 text-status-blocked" />
                                <span className="text-status-blocked">Room conflict: {schedule.room} is double-booked</span>
                              </div>
                            )}
                            {schedule.conflicts.includes("instructor_conflict") && (
                              <div className="flex items-center gap-2 text-sm">
                                <Users className="w-4 h-4 text-status-blocked" />
                                <span className="text-status-blocked">Instructor conflict: {schedule.instructor} is double-booked</span>
                              </div>
                            )}
                          </div>

                          {/* Recommendations */}
                          <div className="mt-4 pt-4 border-t border-status-blocked/20">
                            <h4 className="text-sm font-medium text-foreground mb-2">Recommended Solutions:</h4>
                            <div className="space-y-2">
                              {schedule.conflicts.includes("room_conflict") && (
                                <button className="w-full px-3 py-2 bg-muted border border-border text-foreground rounded-lg text-sm hover:bg-muted/80 min-h-[44px] flex items-center gap-2">
                                  <MapPin className="w-4 h-4" />
                                  Move to Studio B (available)
                                </button>
                              )}
                              {schedule.conflicts.includes("instructor_conflict") && (
                                <button className="w-full px-3 py-2 bg-muted border border-border text-foreground rounded-lg text-sm hover:bg-muted/80 min-h-[44px] flex items-center gap-2">
                                  <Users className="w-4 h-4" />
                                  Assign to Coach Emma (available)
                                </button>
                              )}
                              <button className="w-full px-3 py-2 bg-muted border border-border text-foreground rounded-lg text-sm hover:bg-muted/80 min-h-[44px] flex items-center gap-2">
                                <Clock className="w-4 h-4" />
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

        {viewMode === "rooms" && (
          <div className="p-6">
            <h2 className="text-lg font-headline-md font-semibold text-foreground mb-4">Room Assignments</h2>
            
            <div className="grid grid-cols-2 gap-4">
              {rooms.map((room) => (
                <div key={room.id} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-headline-md font-semibold text-foreground">{room.name}</h3>
                    <span className="text-xs bg-muted px-2 py-1 rounded">{room.type}</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Capacity:</span>
                      <span className="text-foreground">{room.capacity} people</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Utilization:</span>
                      <span className="text-status-cleared">65%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Today's Classes:</span>
                      <span className="text-foreground">4</span>
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
