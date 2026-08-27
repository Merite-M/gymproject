import { apiFetch } from "../api-client";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export interface OccupancyData {
  current: number;
  max: number;
  percentage: number;
  policy: string;
  threshold_status: "normal" | "warning" | "critical" | "full";
  auto_checkout_minutes: number;
}

export interface OccupancyResponse {
  success: boolean;
  occupancy: OccupancyData;
}

export interface CheckInPayload {
  tenant_id: string;
  profile_id: string;
  access_method?: string;
}

export interface CheckInResponse {
  success: boolean;
  message?: string;
  error?: string;
  reason?: string;
}

export interface CheckOutPayload {
  tenant_id: string;
  profile_id: string;
  checkout_method?: string;
}

export interface CheckOutResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export async function fetchOccupancy(tenantId: string): Promise<OccupancyResponse> {
  return apiFetch<OccupancyResponse>(`${BACKEND_URL}/api/iot/occupancy?tenant_id=${tenantId}`);
}

export async function checkInMember(payload: CheckInPayload): Promise<CheckInResponse> {
  return apiFetch<CheckInResponse>(`${BACKEND_URL}/api/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function checkOutMember(payload: CheckOutPayload): Promise<CheckOutResponse> {
  return apiFetch<CheckOutResponse>(`${BACKEND_URL}/api/iot/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
