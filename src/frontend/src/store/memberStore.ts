
import { create } from "zustand";
import { supabase } from "../lib/supabase";

interface MemberState {
  profile: any | null;
  memberships: any[];
  holds: any[];
  familyLinks: any[];
  checkIns: any[];
  loading: boolean;
  error: string | null;
  fetchMemberData: (profileId: string) => Promise<void>;
  createHoldRequest: (holdData: any) => Promise<void>;
  updateHold: (holdId: string, updateData: any) => Promise<void>;
  deleteHold: (holdId: string) => Promise<void>;
}

export const useMemberStore = create<MemberState>((set) => ({
  profile: null,
  memberships: [],
  holds: [],
  familyLinks: [],
  checkIns: [],
  loading: false,
  error: null,
  fetchMemberData: async (profileId: string) => {
    set({ loading: true, error: null });
    try {
      const [profileRes, membershipsRes, holdsRes, familyRes, checkInsRes] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", profileId).single(),
          supabase.from("memberships").select("*").eq("profile_id", profileId),
          // we'll get holds through memberships or a separate query if needed.
          // For now, let's just query holds that might belong to any of their memberships
          supabase
            .from("membership_holds")
            .select("*, memberships!inner(profile_id)")
            .eq("memberships.profile_id", profileId),
          supabase
            .from("family_links")
            .select(
              "*, master:profiles!master_account_id(*), dependent:profiles!dependent_account_id(*)",
            )
            .or(
              `master_account_id.eq.${profileId},dependent_account_id.eq.${profileId}`,
            ),
          supabase
            .from("check_ins")
            .select("*")
            .eq("profile_id", profileId)
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

      if (profileRes.error) throw profileRes.error;

      set({
        profile: profileRes.data,
        memberships: membershipsRes.data || [],
        holds: holdsRes.data || [],
        familyLinks: familyRes.data || [],
        checkIns: checkInsRes.data || [],
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },
  createHoldRequest: async (holdData: any) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("membership_holds")
        .insert(holdData)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        holds: [...state.holds, data],
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },
  updateHold: async (holdId: string, updateData: any) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("membership_holds")
        .update(updateData)
        .eq("id", holdId)
        .select()
        .single();

      if (error) throw error;

      set((state) => ({
        holds: state.holds.map((h) => (h.id === holdId ? data : h)),
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },
  deleteHold: async (holdId: string) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from("membership_holds")
        .delete()
        .eq("id", holdId);

      if (error) throw error;

      set((state) => ({
        holds: state.holds.filter((h) => h.id !== holdId),
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },
}));
