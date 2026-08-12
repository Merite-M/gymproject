export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const TENANT_ID =
  process.env.NEXT_PUBLIC_TENANT_ID || "00000000-0000-0000-0000-000000000000";

export interface Category {
  id: string;
  name: string;
  color: string | null;
}

export interface GymClass {
  id: string;
  name: string;
  duration_minutes: number;
  default_capacity: number;
  category: Category | null;
}

export interface Facility {
  id: string;
  name: string;
  capacity: number;
}

export interface Trainer {
  id: string;
  full_name: string;
  specialties: string[];
}

export interface EquipmentPool {
  id: string;
  name: string;
  total_units: number;
}

export interface OffPeakWindow {
  id: string;
  label: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  access_mode: "locked" | "premium_only";
}

export interface Resources {
  categories: Category[];
  facilities: Facility[];
  trainers: Trainer[];
  classes: GymClass[];
  equipment: EquipmentPool[];
  off_peak_windows: OffPeakWindow[];
}

export interface Session {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  status: "scheduled" | "cancelled" | "completed";
  notes: string | null;
  class: { id: string; name: string; category: Category | null } | null;
  trainer: { id: string; full_name: string } | null;
  facility: { id: string; name: string; capacity: number } | null;
  booked_count: number;
  waitlist_count: number;
  seats_left: number;
  is_overflow: boolean;
}

export interface Member {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export interface Booking {
  id: string;
  profile_id: string;
  status: "booked" | "attended" | "no_show" | "cancelled";
  source: string;
  booked_at: string;
  member: Member | null;
}

export interface WaitlistEntry {
  id: string;
  profile_id: string;
  position: number;
  joined_at: string;
  member: Member | null;
}

export interface Conflict {
  type: "trainer" | "room" | "capacity" | "equipment" | "class" | "race";
  message: string;
  conflicting_schedule_id?: string;
}

export interface Suggestions {
  trainers?: { id: string; full_name: string; qualified: boolean }[];
  facilities?: { id: string; name: string; capacity: number }[];
  time_slots?: { starts_at: string; ends_at: string }[];
}

export interface ConflictResponse {
  error: string;
  conflicts: Conflict[];
  suggestions: Suggestions;
}

export class ConflictError extends Error {
  conflicts: Conflict[];
  suggestions: Suggestions;

  constructor(payload: ConflictResponse) {
    super(payload.error);
    this.name = "ConflictError";
    this.conflicts = payload.conflicts || [];
    this.suggestions = payload.suggestions || {};
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${API_URL}/api/calendar${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  const payload = await res.json().catch(() => ({}));

  if (res.status === 409 && (payload as ConflictResponse).conflicts) {
    throw new ConflictError(payload as ConflictResponse);
  }

  if (!res.ok) {
    throw new Error((payload as { error?: string }).error || res.statusText);
  }

  return payload as T;
};

export const fetchResources = () =>
  request<Resources>(`/resources?tenant_id=${TENANT_ID}`);

export const fetchSessions = (from: Date, to: Date, facilityId?: string) => {
  const params = new URLSearchParams({
    tenant_id: TENANT_ID,
    from: from.toISOString(),
    to: to.toISOString(),
  });
  if (facilityId) params.set("facility_id", facilityId);
  return request<Session[]>(`/schedule?${params.toString()}`);
};

export interface SchedulePayload {
  class_id: string;
  trainer_id?: string | null;
  facility_id?: string | null;
  starts_at: string;
  ends_at: string;
  capacity: number;
  equipment?: { equipment_id: string; units: number }[];
}

export const createSession = (payload: SchedulePayload) =>
  request<Session>("/schedule", {
    method: "POST",
    body: JSON.stringify({ tenant_id: TENANT_ID, ...payload }),
  });

export const fetchRoster = (scheduleId: string) =>
  request<{ bookings: Booking[]; waitlist: WaitlistEntry[] }>(
    `/schedule/${scheduleId}/roster?tenant_id=${TENANT_ID}`,
  );

export const cancelBooking = (bookingId: string) =>
  request<{ booking: Booking; promoted: Booking | null }>(
    `/bookings/${bookingId}/cancel`,
    { method: "POST", body: JSON.stringify({ tenant_id: TENANT_ID }) },
  );

export const setAttendance = (bookingId: string, status: string) =>
  request<Booking>(`/bookings/${bookingId}/attendance`, {
    method: "POST",
    body: JSON.stringify({ tenant_id: TENANT_ID, status }),
  });

export const bookMember = (scheduleId: string, profileId: string) =>
  request<{ waitlisted: boolean; position?: number }>("/bookings", {
    method: "POST",
    body: JSON.stringify({
      tenant_id: TENANT_ID,
      schedule_id: scheduleId,
      profile_id: profileId,
      source: "staff",
    }),
  });

export const startOfWeek = (date: Date) => {
  const result = new Date(date);
  const day = (result.getDay() + 6) % 7; // Monday-first
  result.setDate(result.getDate() - day);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const formatHour = (hour: number) => {
  const suffix = hour < 12 ? "A" : "P";
  const base = hour % 12 === 0 ? 12 : hour % 12;
  return `${base.toString().padStart(2, "0")}:00${suffix}`;
};

export const isWithinOffPeak = (
  windows: OffPeakWindow[],
  day: Date,
  hour: number,
) =>
  windows.find((w) => {
    if (w.day_of_week !== day.getDay()) return false;
    const start = Number(w.start_time.slice(0, 2));
    const end = Number(w.end_time.slice(0, 2));
    return hour >= start && hour < end;
  }) || null;
