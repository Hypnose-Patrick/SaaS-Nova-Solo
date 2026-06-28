import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";

interface UserState {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  reset: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  profile: null,
  loading: false,
  error: null,

  fetchProfile: async (userId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;

      if (data) {
        set({ profile: data as Profile, loading: false });
        return;
      }

      // Premier login : créer le profil. upsert(onConflict user_id) est
      // idempotent — App.tsx peut appeler fetchProfile deux fois au démarrage
      // (getSession + onAuthStateChange) sans créer de doublon ni planter.
      const { data: session } = await supabase.auth.getUser();
      const { data: created, error: upErr } = await supabase
        .from("profiles")
        .upsert(
          { user_id: userId, email: session.user?.email ?? null },
          { onConflict: "user_id" },
        )
        .select()
        .single();
      if (upErr) throw upErr;
      set({ profile: created as Profile, loading: false });
    } catch (err) {
      // Ne JAMAIS laisser la page bloquée sur « Chargement… » en silence.
      const msg = err instanceof Error ? err.message : String(err);
      console.error("fetchProfile:", msg);
      set({ loading: false, error: msg });
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

  reset: () => set({ profile: null, loading: false, error: null }),
}));
