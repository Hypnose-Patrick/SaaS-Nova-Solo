import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";

interface UserState {
  profile: Profile | null;
  loading: boolean;
  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  reset: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  profile: null,
  loading: false,

  fetchProfile: async (userId) => {
    set({ loading: true });
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("fetchProfile:", error.message);
      set({ loading: false });
      return;
    }

    if (!data) {
      // Premier login : créer le profil
      const { data: session } = await supabase.auth.getUser();
      const { data: created } = await supabase
        .from("profiles")
        .insert({ user_id: userId, email: session.user?.email ?? null })
        .select()
        .single();
      set({ profile: created ?? null, loading: false });
    } else {
      set({ profile: data as Profile, loading: false });
    }
  },

  updateProfile: async (patch) => {
    const { profile } = get();
    if (!profile) return;
    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", profile.id)
      .select()
      .single();
    if (!error && data) set({ profile: data as Profile });
  },

  reset: () => set({ profile: null, loading: false }),
}));
