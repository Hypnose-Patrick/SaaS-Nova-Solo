// Configuration du moteur IA de l'abonné (BYOK) — passe par l'Edge Function
// ai-config. La clé du fournisseur n'est jamais relue ici (write-only) :
// seul key_last4 revient pour l'affichage.

import { supabase } from "./supabase";

export type AiMode = "managed" | "byok_remote" | "byok_local";

export interface AiConfig {
  mode: AiMode;
  provider: "openai" | "anthropic" | null;
  base_url: string | null;
  model: string | null;
  key_last4: string | null;
}

export interface SaveAiConfigInput {
  mode: AiMode;
  provider?: "openai" | "anthropic" | null;
  base_url?: string | null;
  model?: string | null;
  key?: string | null; // omis ou vide => conserve la clé existante
}

const CONFIG_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-config`;

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Non authentifié — connexion requise");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function call(body: Record<string, unknown>): Promise<AiConfig> {
  const res = await fetch(CONFIG_URL, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Erreur ai-config ${res.status}`);
  return data.config as AiConfig;
}

export const getAiConfig = (): Promise<AiConfig> => call({ action: "get" });

export const saveAiConfig = (input: SaveAiConfigInput): Promise<AiConfig> =>
  call({ action: "save", ...input });

export const resetAiConfig = (): Promise<AiConfig> => call({ action: "reset" });
