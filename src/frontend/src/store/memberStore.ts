import { create } from "zustand";
import {
  fetchMemberDetails,
  createMembershipHold,
  updateMembershipHold,
  deleteMembershipHold,
  CreateHoldInput,
  UpdateHoldInput,
} from "../lib/api/members";
import type {
  Profile,
  Membership,
  MembershipHold,
  FamilyLink,
  CheckIn,
} from "@/types/database";

interface MemberState {
  profile: Profile | null;
  memberships: Membership[];
  holds: MembershipHold[];
  familyLinks: FamilyLink[];
  checkIns: CheckIn[];
  loading: boolean;
  error: string | null;
  fetchMemberData: (profileId: string) => Promise<void>;
  createHoldRequest: (holdData: CreateHoldInput) => Promise<void>;
  updateHold: (holdId: string, updateData: UpdateHoldInput) => Promise<void>;
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch member details';
      set({ error: message, loading: false });
    }
  },
  createHoldRequest: async (holdData: CreateHoldInput) => {
    set({ loading: true, error: null });
    try {
      const data = await createMembershipHold(holdData);
      set((state) => ({
        holds: [...state.holds, data],
        loading: false,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create hold request';
      set({ error: message, loading: false });
      throw err;
    }
  },
  updateHold: async (holdId: string, updateData: UpdateHoldInput) => {
    set({ loading: true, error: null });
    try {
      const data = await updateMembershipHold(holdId, updateData);
      set((state) => ({
        holds: state.holds.map((h) => (h.id === holdId ? data : h)),
        loading: false,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update hold';
      set({ error: message, loading: false });
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete hold';
      set({ error: message, loading: false });
      throw err;
    }
  },
}));
