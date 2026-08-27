import { supabase } from "../supabase";
import type {
  Profile,
  Membership,
  MembershipHold,
  FamilyLink,
  CheckIn,
} from "@/types/database";

export interface MemberProfileData {
  profile: Profile | null;
  memberships: Membership[];
  holds: MembershipHold[];
  familyLinks: FamilyLink[];
  checkIns: CheckIn[];
}

export type CreateHoldInput = Omit<MembershipHold, 'id' | 'created_at' | 'updated_at'>;
export type UpdateHoldInput = Partial<Pick<MembershipHold, 'start_date' | 'end_date' | 'reason' | 'status' | 'approved_by'>>;

export async function fetchMemberDetails(profileId: string): Promise<MemberProfileData> {
  const [profileRes, membershipsRes, holdsRes, familyRes, checkInsRes] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", profileId).single(),
      supabase.from("memberships").select("*").eq("profile_id", profileId),
      supabase
        .from("membership_holds")
        .select("*, memberships!inner(profile_id)")
        .eq("memberships.profile_id", profileId),
      supabase
        .from("family_links")
        .select(
          "*, master:profiles!master_account_id(*), dependent:profiles!dependent_account_id(*)"
        )
        .or(
          `master_account_id.eq.${profileId},dependent_account_id.eq.${profileId}`
        ),
      supabase
        .from("check_ins")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  if (profileRes.error) throw profileRes.error;

  return {
    profile: (profileRes.data as Profile) || null,
    memberships: (membershipsRes.data as Membership[]) || [],
    holds: (holdsRes.data as MembershipHold[]) || [],
    familyLinks: (familyRes.data as FamilyLink[]) || [],
    checkIns: (checkInsRes.data as CheckIn[]) || [],
  };
}

export async function createMembershipHold(holdData: CreateHoldInput): Promise<MembershipHold> {
  const { data, error } = await supabase
    .from("membership_holds")
    .insert(holdData)
    .select()
    .single();

  if (error) throw error;
  return data as MembershipHold;
}

export async function updateMembershipHold(
  holdId: string,
  updateData: UpdateHoldInput
): Promise<MembershipHold> {
  const { data, error } = await supabase
    .from("membership_holds")
    .update(updateData)
    .eq("id", holdId)
    .select()
    .single();

  if (error) throw error;
  return data as MembershipHold;
}

export async function deleteMembershipHold(holdId: string): Promise<boolean> {
  const { error } = await supabase
    .from("membership_holds")
    .delete()
    .eq("id", holdId);

  if (error) throw error;
  return true;
}

export interface GuestPass {
  id: string;
  tenant_id: string;
  host_member_id: string;
  guest_name: string | null;
  guest_phone: string | null;
  guest_email: string | null;
  pass_code: string;
  status: "active" | "redeemed" | "expired" | "revoked";
  photo_url: string | null;
  waiver_signed: boolean;
  waiver_signature_url: string | null;
  created_at: string;
  expires_at: string;
  redeemed_at: string | null;
  converted_lead_id: string | null;
}

export interface GuestPassResponse {
  success: boolean;
  allowance: number;
  used: number;
  remaining: number;
  passes: GuestPass[];
}

import { apiFetch } from "../api-client";
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export async function fetchMemberGuestPasses(memberId: string, tenantId: string): Promise<GuestPassResponse> {
  return apiFetch<GuestPassResponse>(`${BACKEND_URL}/api/members/${memberId}/guest-passes?tenant_id=${tenantId}`);
}

export async function issueMemberGuestPass(memberId: string, payload: {
  tenant_id: string;
  guest_name?: string;
  guest_phone?: string;
  guest_email?: string;
}): Promise<{ success: boolean; pass: GuestPass }> {
  return apiFetch<{ success: boolean; pass: GuestPass }>(`${BACKEND_URL}/api/members/${memberId}/guest-passes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
