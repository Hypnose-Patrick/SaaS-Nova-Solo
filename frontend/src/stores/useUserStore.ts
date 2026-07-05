import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { loadLocal, saveLocal } from "@/lib/local";
import type { Account, Profile } from "@/types";

const ACTIVE_PROJECT_KEY = "ns_active_project_id";

interface UserState {
  account: Account | null;
  projects: Profile[];
  profile: Profile | null; // = projet actif, pour compat avec le reste de l'app
  loading: boolean;
  error: string | null;
  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  setActiveProject: (projectId: string) => void;
  createProject: (name?: string) => Promise<{ error?: string }>;
  deleteProject: (projectId: string) => Promise<{ error?: string }>;
  resetProject: (projectId: string) => Promise<{ error?: string }>;
  deleteAccount: () => Promise<{ purgeAt?: string; error?: string }>;
  reset: () => void;
}

async function callFn(fn: string, action: string, payload: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Session expirée — reconnectez-vous.");
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Erreur serveur");
  return data;
}

const callProjectsFn = (action: string, payload: Record<string, unknown> = {}) =>
  callFn("create-project", action, payload);

export const useUserStore = create<UserState>((set, get) => ({
  account: null,
  projects: [],
  profile: null,
  loading: false,
  error: null,

  fetchProfile: async (userId) => {
    set({ loading: true, error: null });
    try {
      // 1. Compte (abonnement/plan/quota) — idempotent, comme l'ancien upsert profile.
      const { data: session } = await supabase.auth.getUser();
      const { data: account, error: accErr } = await supabase
        .from("accounts")
        .upsert({ user_id: userId }, { onConflict: "user_id" })
        .select()
        .single();
      if (accErr) throw accErr;

      // 2. Projets du compte.
      const { data: existingProjects, error: projErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("account_id", account.id)
        .order("created_at", { ascending: true });
      if (projErr) throw projErr;

      let projects = existingProjects ?? [];

      // Premier login : aucun projet encore créé pour ce compte.
      if (projects.length === 0) {
        const { data: created, error: createErr } = await supabase
          .from("profiles")
          .insert({ account_id: account.id, user_id: userId, email: session.user?.email ?? null })
          .select()
          .single();
        if (createErr) throw createErr;
        projects = [created as Profile];
      }

      const savedActiveId = loadLocal<string | null>(ACTIVE_PROJECT_KEY, null);
      const active = projects.find((p) => p.id === savedActiveId) ?? projects[0];

      set({
        account: account as Account,
        projects: projects as Profile[],
        profile: active as Profile,
        loading: false,
      });
    } catch (err) {
      // Ne JAMAIS laisser la page bloquée sur « Chargement… » en silence.
      const msg = err instanceof Error ? err.message : String(err);
      console.error("fetchProfile:", msg);
      set({ loading: false, error: msg });
    }
  },

  updateProfile: async (patch) => {
    const { profile, projects } = get();
    if (!profile) return;
    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", profile.id)
      .select()
      .single();
    if (!error && data) {
      set({
        profile: data as Profile,
        projects: projects.map((p) => (p.id === data.id ? (data as Profile) : p)),
      });
    }
  },

  setActiveProject: (projectId) => {
    const { projects } = get();
    const next = projects.find((p) => p.id === projectId);
    if (!next) return;
    saveLocal(ACTIVE_PROJECT_KEY, projectId);
    set({ profile: next });
  },

  createProject: async (name) => {
    try {
      const { project } = await callProjectsFn("create", { name });
      const projects = [...get().projects, project as Profile];
      saveLocal(ACTIVE_PROJECT_KEY, project.id);
      set({ projects, profile: project as Profile });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },

  deleteProject: async (projectId) => {
    try {
      await callProjectsFn("delete", { projectId });
      const { projects, profile } = get();
      const remaining = projects.filter((p) => p.id !== projectId);
      const nextActive = profile?.id === projectId ? remaining[0] ?? null : profile;
      if (nextActive) saveLocal(ACTIVE_PROJECT_KEY, nextActive.id);
      set({ projects: remaining, profile: nextActive });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },

  resetProject: async (projectId) => {
    try {
      const { project } = await callProjectsFn("reset", { projectId });
      const { projects, profile } = get();
      set({
        projects: projects.map((p) => (p.id === project.id ? (project as Profile) : p)),
        profile: profile?.id === project.id ? (project as Profile) : profile,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },

  deleteAccount: async () => {
    try {
      const { purgeAt } = await callFn("account-delete", "delete");
      return { purgeAt };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },

  reset: () => set({ account: null, projects: [], profile: null, loading: false, error: null }),
}));
