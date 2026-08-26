"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  AlertCircle,
  XCircle,
  CreditCard,
  Filter,
  Dumbbell,
  Sparkles,
  ArrowLeft,
  Check
} from "lucide-react";
import { cn, formatCurrencyDisplay } from "@/lib/utils";

interface Resource {
  id: string;
  name: string;
  resource_type: "court" | "studio" | "equipment" | "room" | string;
  max_capacity: number;
  hourly_rate_rwf: number;
}

interface RentalBooking {
  id: string;
  facility_id: string;
  resource_id?: string;
  profile_id: string;
  member_name: string;
  start_time: string;
  end_time: string;
  total_fee: number;
  hourly_rate_rwf: number;
  status: "confirmed" | "cancelled" | "completed" | string;
  payment_status: "paid" | "unpaid" | string;
  notes?: string;
}

interface ClassScheduleConflict {
  id: string;
  facility_id: string;
  title: string;
  start_time: string;
  end_time: string;
}

const INITIAL_RESOURCES: Resource[] = [
  {
    id: "a1111111-1111-1111-1111-111111111111",
    name: "Squash Court A",
    resource_type: "court",
    max_capacity: 2,
    hourly_rate_rwf: 15000
  },
  {
    id: "a2222222-2222-2222-2222-222222222222",
    name: "Sauna Suite 1",
    resource_type: "studio",
    max_capacity: 4,
    hourly_rate_rwf: 25000
  },
  {
    id: "a3333333-3333-3333-3333-333333333333",
    name: "InBody 770 Analyzer",
    resource_type: "equipment",
    max_capacity: 1,
    hourly_rate_rwf: 10000
  },
  {
    id: "a4444444-4444-4444-4444-444444444444",
    name: "Spin Bike Studio - Pro",
    resource_type: "equipment",
    max_capacity: 1,
    hourly_rate_rwf: 8000
  }
];

const INITIAL_RENTALS: RentalBooking[] = [
  {
    id: "rent-1",
    facility_id: "a1111111-1111-1111-1111-111111111111",
    profile_id: "prof-1",
    member_name: "Jean Paul Ndayishimiye",
    start_time: "2026-08-25T09:00:00.000Z",
    end_time: "2026-08-25T11:00:00.000Z",
    total_fee: 30000,
    hourly_rate_rwf: 15000,
    status: "confirmed",
    payment_status: "paid",
    notes: "Requires 2 squash rackets"
  },
  {
    id: "rent-2",
    facility_id: "a2222222-2222-2222-2222-222222222222",
    profile_id: "prof-2",
    member_name: "Aline Uwase",
    start_time: "2026-08-25T14:00:00.000Z",
    end_time: "2026-08-25T15:00:00.000Z",
    total_fee: 25000,
    hourly_rate_rwf: 25000,
    status: "confirmed",
    payment_status: "unpaid",
    notes: "VIP Guest recovery session"
  }
];

const TIME_SLOTS = Array.from({ length: 14 }, (_, i) => {
  const hour = i + 7;
  return `${hour.toString().padStart(2, "0")}:00`;
});

export default function FacilityRentalsPage() {
  const [selectedDate, setSelectedDate] = useState<string>("2026-08-25");
  const [selectedResourceType, setSelectedResourceType] = useState<string>("all");
  const [selectedResourceId, setSelectedResourceId] = useState<string>("a1111111-1111-1111-1111-111111111111");
  const [searchQuery, setSearchQuery] = useState("");
  const [resources, setResources] = useState<Resource[]>(INITIAL_RESOURCES);
  const [rentals, setRentals] = useState<RentalBooking[]>(INITIAL_RENTALS);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalResourceId, setModalResourceId] = useState(selectedResourceId);
  const [memberName, setMemberName] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [durationHours, setDurationHours] = useState(1);
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "unpaid">("unpaid");
  const [notes, setNotes] = useState("");
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState("");
  const [bookingErrorMsg, setBookingErrorMsg] = useState("");

  const selectedResource = useMemo(() => {
    return resources.find((r) => r.id === selectedResourceId) || resources[0];
  }, [resources, selectedResourceId]);

  const filteredResources = useMemo(() => {
    if (selectedResourceType === "all") return resources;
    return resources.filter((r) => r.resource_type === selectedResourceType);
  }, [resources, selectedResourceType]);

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const openBookingForSlot = (timeStr: string) => {
    setModalResourceId(selectedResourceId);
    setStartTime(timeStr);
    setDurationHours(1);
    setMemberName("");
    setNotes("");
    setBookingErrorMsg("");
    setBookingSuccessMsg("");
    setIsModalOpen(true);
  };

  const calculateModalTotalFee = () => {
    const res = resources.find((r) => r.id === modalResourceId);
    const rate = res ? res.hourly_rate_rwf : 0;
    return rate * durationHours;
  };

  const handleCreateRental = (e: React.FormEvent) => {
    e.preventDefault();
    setBookingErrorMsg("");

    if (!memberName.trim()) {
      setBookingErrorMsg("Please enter member name.");
      return;
    }

    const startIso = `${selectedDate}T${startTime}:00.000Z`;
    const startHour = parseInt(startTime.split(":")[0]);
    const endHour = startHour + durationHours;
    const endIso = `${selectedDate}T${endHour.toString().padStart(2, "0")}:00:00.000Z`;

    const res = resources.find((r) => r.id === modalResourceId);
    const conflict = rentals.find(
      (r) =>
        r.facility_id === modalResourceId &&
        r.status !== "cancelled" &&
        new Date(r.start_time) < new Date(endIso) &&
        new Date(r.end_time) > new Date(startIso)
    );

    if (conflict) {
      setBookingErrorMsg(`Time slot conflict with existing booking for ${conflict.member_name}`);
      return;
    }

    const newRental: RentalBooking = {
      id: `rent-${Date.now()}`,
      facility_id: modalResourceId,
      profile_id: `prof-${Date.now()}`,
      member_name: memberName,
      start_time: startIso,
      end_time: endIso,
      total_fee: calculateModalTotalFee(),
      hourly_rate_rwf: res ? res.hourly_rate_rwf : 0,
      status: "confirmed",
      payment_status: paymentStatus,
      notes: notes || undefined
    };

    setRentals([newRental, ...rentals]);
    setBookingSuccessMsg(`Successfully booked ${res?.name} for ${memberName}!`);
    setTimeout(() => {
      setIsModalOpen(false);
      setBookingSuccessMsg("");
    }, 1200);
  };

  const handleTogglePaymentStatus = (id: string) => {
    setRentals(
      rentals.map((r) =>
        r.id === id
          ? { ...r, payment_status: r.payment_status === "paid" ? "unpaid" : "paid" }
          : r
      )
    );
  };

  const handleCancelRental = (id: string) => {
    setRentals(
      rentals.map((r) =>
        r.id === id ? { ...r, status: "cancelled" } : r
      )
    );
  };

  const filteredRentals = useMemo(() => {
    return rentals.filter(
      (r) =>
        r.member_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.notes && r.notes.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [rentals, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/calendar"
              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Class Calendar
            </Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Sparkles className="w-7 h-7 text-amber-400" />
            Court, Studio & Specialized Equipment Rental Engine
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Hourly dedicated facility spaces (Squash Courts, Sauna Suites, Private Studios) and high-value equipment rentals (InBody Analyzers, Spin Bikes).
          </p>
        </div>

        <button
          onClick={() => {
            setModalResourceId(selectedResourceId);
            setStartTime("10:00");
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-all shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" /> Book Facility Slot
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
          <button
            onClick={handlePrevDay}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarIcon className="w-4 h-4 text-amber-400" />
            <span>{new Date(selectedDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
          <button
            onClick={handleNextDay}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs text-slate-400 font-medium shrink-0">Type:</span>
          <select
            value={selectedResourceType}
            onChange={(e) => setSelectedResourceType(e.target.value)}
            className="bg-transparent text-sm text-white focus:outline-none w-full cursor-pointer"
          >
            <option value="all" className="bg-slate-900 text-white">All Facility Resources</option>
            <option value="court" className="bg-slate-900 text-white">Squash & Sports Courts</option>
            <option value="studio" className="bg-slate-900 text-white">Sauna & Private Studios</option>
            <option value="equipment" className="bg-slate-900 text-white">Specialized Equipment</option>
          </select>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
          <Dumbbell className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs text-slate-400 font-medium shrink-0">Resource:</span>
          <select
            value={selectedResourceId}
            onChange={(e) => setSelectedResourceId(e.target.value)}
            className="bg-transparent text-sm text-white focus:outline-none w-full cursor-pointer font-semibold"
          >
            {filteredResources.map((res) => (
              <option key={res.id} value={res.id} className="bg-slate-900 text-white">
                {res.name} ({formatCurrencyDisplay(res.hourly_rate_rwf)} RWF/hr)
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedResource && (
        <div className="bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border border-amber-500/30 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {selectedResource.resource_type}
              </span>
              <h2 className="text-xl font-bold text-white">{selectedResource.name}</h2>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-3">
              <span>Max Capacity: <strong className="text-slate-200">{selectedResource.max_capacity} Persons</strong></span>
              <span>•</span>
              <span>Rate: <strong className="text-amber-300">{formatCurrencyDisplay(selectedResource.hourly_rate_rwf)} RWF / hour</strong></span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-slate-400">Total Bookings Today</div>
              <div className="text-lg font-bold text-white">
                {rentals.filter((r) => r.facility_id === selectedResourceId && r.status !== "cancelled").length} Slots
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Hourly Availability Grid & Slots ({new Date(selectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })})
          </h3>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/50"></span>
              <span className="text-slate-400">Open Slot</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-500/30 border border-amber-500/70"></span>
              <span className="text-slate-400">Rented/Booked</span>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-800">
          {TIME_SLOTS.map((slot) => {
            const startHour = parseInt(slot.split(":")[0]);
            const slotStartIso = `${selectedDate}T${slot}:00.000Z`;
            const slotEndIso = `${selectedDate}T${(startHour + 1).toString().padStart(2, "0")}:00:00.000Z`;

            const rental = rentals.find(
              (r) =>
                r.facility_id === selectedResourceId &&
                r.status !== "cancelled" &&
                new Date(r.start_time) < new Date(slotEndIso) &&
                new Date(r.end_time) > new Date(slotStartIso)
            );

            return (
              <div
                key={slot}
                className="grid grid-cols-12 items-center p-3 hover:bg-slate-800/40 transition-colors"
              >
                <div className="col-span-3 sm:col-span-2 text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  {slot} - {(startHour + 1).toString().padStart(2, "0")}:00
                </div>

                <div className="col-span-9 sm:col-span-10">
                  {rental ? (
                    <div className="bg-amber-950/40 border border-amber-500/40 rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-amber-200 flex items-center gap-2">
                          <span>{rental.member_name}</span>
                          <span
                            className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full font-medium uppercase",
                              rental.payment_status === "paid"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                            )}
                          >
                            {rental.payment_status}
                          </span>
                        </div>
                        {rental.notes && (
                          <div className="text-xs text-amber-300/70 mt-0.5">{rental.notes}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-amber-400">
                          {formatCurrencyDisplay(rental.total_fee)} RWF
                        </span>
                        <button
                          onClick={() => handleTogglePaymentStatus(rental.id)}
                          className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                        >
                          Toggle Pay
                        </button>
                        <button
                          onClick={() => handleCancelRental(rental.id)}
                          className="text-xs px-2.5 py-1 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-emerald-950/10 border border-emerald-500/20 hover:border-emerald-500/40 rounded-lg p-2.5 transition-all">
                      <span className="text-xs font-medium text-emerald-400/90 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Slot Available
                      </span>
                      <button
                        onClick={() => openBookingForSlot(slot)}
                        className="text-xs px-3 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-medium transition-colors"
                      >
                        Reserve {formatCurrencyDisplay(selectedResource?.hourly_rate_rwf || 0)} RWF
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Facility Rental Ledger</h3>
            <p className="text-xs text-slate-400">All registered member court, space, and equipment bookings.</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search member or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">Resource</th>
                <th className="p-3">Member</th>
                <th className="p-3">Date & Time</th>
                <th className="p-3">Fee (RWF)</th>
                <th className="p-3">Payment</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredRentals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-500">
                    No rentals registered.
                  </td>
                </tr>
              ) : (
                filteredRentals.map((rental) => {
                  const res = resources.find((r) => r.id === rental.facility_id);
                  return (
                    <tr key={rental.id} className="hover:bg-slate-800/50">
                      <td className="p-3 font-semibold text-white">{res?.name || "Facility"}</td>
                      <td className="p-3 font-medium text-slate-200">{rental.member_name}</td>
                      <td className="p-3">
                        {new Date(rental.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                        {new Date(rental.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="p-3 font-bold text-amber-300">{formatCurrencyDisplay(rental.total_fee)} RWF</td>
                      <td className="p-3">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full font-medium uppercase text-[10px]",
                            rental.payment_status === "paid"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          )}
                        >
                          {rental.payment_status}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full font-medium uppercase text-[10px]",
                            rental.status === "confirmed"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          )}
                        >
                          {rental.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => handleTogglePaymentStatus(rental.id)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                        >
                          Toggle Pay
                        </button>
                        {rental.status !== "cancelled" && (
                          <button
                            onClick={() => handleCancelRental(rental.id)}
                            className="px-2 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 text-[11px]"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" /> Book Facility / Equipment Slot
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRental} className="p-6 space-y-4 text-xs">
              {bookingErrorMsg && (
                <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{bookingErrorMsg}</span>
                </div>
              )}

              {bookingSuccessMsg && (
                <div className="p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{bookingSuccessMsg}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-slate-400 font-medium">Facility Resource</label>
                <select
                  value={modalResourceId}
                  onChange={(e) => setModalResourceId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500 text-sm"
                >
                  {resources.map((res) => (
                    <option key={res.id} value={res.id}>
                      {res.name} — {formatCurrencyDisplay(res.hourly_rate_rwf)} RWF / hr
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-medium">Member Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Jean Paul Ndayishimiye"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">Start Time</label>
                  <select
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500 text-sm"
                  >
                    {TIME_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">Duration (Hours)</label>
                  <select
                    value={durationHours}
                    onChange={(e) => setDurationHours(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500 text-sm"
                  >
                    <option value={1}>1 Hour</option>
                    <option value={2}>2 Hours</option>
                    <option value={3}>3 Hours</option>
                    <option value={4}>4 Hours</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-medium">Payment Status</label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentStatus === "unpaid"}
                      onChange={() => setPaymentStatus("unpaid")}
                      className="accent-amber-500"
                    />
                    Unpaid (Charge Member Tab)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentStatus === "paid"}
                      onChange={() => setPaymentStatus("paid")}
                      className="accent-emerald-500"
                    />
                    Paid Immediately
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-medium">Booking Notes / Gear Requests</label>
                <textarea
                  rows={2}
                  placeholder="Optional notes or equipment needs..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500 text-xs"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Total Fee</div>
                  <div className="text-lg font-bold text-amber-400">
                    {formatCurrencyDisplay(calculateModalTotalFee())} RWF
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg shadow-amber-500/20"
                  >
                    Confirm Booking
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
