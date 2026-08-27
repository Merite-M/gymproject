import { create } from "zustand";
import {
  fetchMemberDetails,
  createMembershipHold,
  updateMembershipHold,
  deleteMembershipHold,
} from "../lib/api/members";

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
      const data = await fetchMemberDetails(profileId);
      set({
        profile: data.profile,
        memberships: data.memberships,
        holds: data.holds,
        familyLinks: data.familyLinks,
        checkIns: data.checkIns,
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },
  createHoldRequest: async (holdData: any) => {
    set({ loading: true, error: null });
    try {
      const data = await createMembershipHold(holdData);
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
      const data = await updateMembershipHold(holdId, updateData);
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
      await deleteMembershipHold(holdId);
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
