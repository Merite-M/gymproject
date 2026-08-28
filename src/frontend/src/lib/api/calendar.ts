import { apiFetch } from "../api-client";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export async function fetchCalendarPolicies(tenantId: string) {
  return apiFetch<{ success: boolean; policies: any }>(`${BACKEND_URL}/api/calendar/policies?tenant_id=${tenantId}`);
}

export async function updateCalendarPolicies(payload: any) {
  return apiFetch<{ success: boolean; policies: any }>(`${BACKEND_URL}/api/calendar/policies`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function fetchWaitlists(tenantId: string) {
  return apiFetch<{ success: boolean; waitlists: any[] }>(`${BACKEND_URL}/api/calendar/waitlists?tenant_id=${tenantId}`);
}

export async function updateSchedule(id: string, payload: any) {
  return apiFetch<{ success: boolean; schedule: any }>(`${BACKEND_URL}/api/calendar/schedule/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
