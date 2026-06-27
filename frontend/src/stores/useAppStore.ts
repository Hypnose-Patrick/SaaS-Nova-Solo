import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { BmcBlock, Prospect, CalendarEvent, ComptaEntry } from "@/types";

interface AppState {
  bmc: BmcBlock[];
  prospects: Prospect[];
  events: CalendarEvent[];
  compta: ComptaEntry[];
  loadingBmc: boolean;
  loadingProspects: boolean;
  fetchBmc: (profileId: string) => Promise<void>;
  upsertBmcBlock: (block: Partial<BmcBlock> & { profile_id: string; block_key: string }) => Promise<void>;
  fetchProspects: (profileId: string) => Promise<void>;
  moveProspect: (id: string, column: Prospect["column_key"]) => Promise<void>;
  fetchCompta: (profileId: string) => Promise<void>;
  fetchEvents: (profileId: string) => Promise<void>;
  reset: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  bmc: [],
  prospects: [],
  events: [],
  compta: [],
  loadingBmc: false,
  loadingProspects: false,

  fetchBmc: async (profileId) => {
    set({ loadingBmc: true });
    const { data } = await supabase
      .from("bmc")
      .select("*")
      .eq("profile_id", profileId);
    set({ bmc: (data ?? []) as BmcBlock[], loadingBmc: false });
  },

  upsertBmcBlock: async (block) => {
    const { data, error } = await supabase
      .from("bmc")
      .upsert(block, { onConflict: "profile_id,block_key" })
      .select()
      .single();
    if (error || !data) return;
    set((s) => ({
      bmc: s.bmc.some((b) => b.block_key === block.block_key)
        ? s.bmc.map((b) => (b.block_key === block.block_key ? (data as BmcBlock) : b))
        : [...s.bmc, data as BmcBlock],
    }));
  },

  fetchProspects: async (profileId) => {
    set({ loadingProspects: true });
    const { data } = await supabase
      .from("prospects")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });
    set({ prospects: (data ?? []) as Prospect[], loadingProspects: false });
  },

  moveProspect: async (id, column) => {
    await supabase.from("prospects").update({ column_key: column }).eq("id", id);
    set((s) => ({
      prospects: s.prospects.map((p) =>
        p.id === id ? { ...p, column_key: column } : p,
      ),
    }));
  },

  fetchCompta: async (profileId) => {
    const { data } = await supabase
      .from("compta_entries")
      .select("*")
      .eq("profile_id", profileId)
      .order("date", { ascending: false });
    set({ compta: (data ?? []) as ComptaEntry[] });
  },

  fetchEvents: async (profileId) => {
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("profile_id", profileId)
      .order("date", { ascending: true });
    set({ events: (data ?? []) as CalendarEvent[] });
  },

  reset: () => set({ bmc: [], prospects: [], events: [], compta: [] }),
}));
