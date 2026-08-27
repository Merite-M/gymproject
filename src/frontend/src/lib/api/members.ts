import { supabase } from "../supabase";

export interface MemberProfileData {
  profile: any | null;
  memberships: any[];
  holds: any[];
  familyLinks: any[];
  checkIns: any[];
}

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
    profile: profileRes.data,
    memberships: membershipsRes.data || [],
    holds: holdsRes.data || [],
    familyLinks: familyRes.data || [],
    checkIns: checkInsRes.data || [],
  };
}

export async function createMembershipHold(holdData: any) {
  const { data, error } = await supabase
    .from("membership_holds")
    .insert(holdData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMembershipHold(holdId: string, updateData: any) {
  const { data, error } = await supabase
    .from("membership_holds")
    .update(updateData)
    .eq("id", holdId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMembershipHold(holdId: string) {
  const { error } = await supabase
    .from("membership_holds")
    .delete()
    .eq("id", holdId);

  if (error) throw error;
  return true;
}
