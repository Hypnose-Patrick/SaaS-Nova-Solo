// Configuration des webhooks n8n personnels de l'abonné (BYO) — passe par
// l'Edge Function n8n-config. Les secrets d'authentification (headers) ne sont
// jamais relus ici (write-only) : seul *_secret_last4 revient pour l'affichage.

import { supabase } from "./supabase";

export interface N8nConfig {
  research_url: string | null;
  research_secret_last4: string | null;
  send_url: string | null;
  send_secret_last4: string | null;
}

export interface SaveN8nConfigInput {
  research_url?: string | null;
  research_secret?: string | null; // omis ou vide => conserve le secret existant
  send_url?: string | null;
  send_secret?: string | null;     // omis ou vide => conserve le secret existant
}

const CONFIG_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/n8n-config`;
const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/n8n-proxy`;

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Non authentifié — connexion requise");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function call(body: Record<string, unknown>): Promise<N8nConfig> {
  const res = await fetch(CONFIG_URL, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Erreur n8n-config ${res.status}`);
  return data.config as N8nConfig;
}

export const getN8nConfig = (): Promise<N8nConfig> => call({ action: "get" });

export const saveN8nConfig = (input: SaveN8nConfigInput): Promise<N8nConfig> =>
  call({ action: "save", ...input });

export const resetN8nConfig = (): Promise<N8nConfig> => call({ action: "reset" });

// Renvoie null si l'abonné n'a configuré aucun webhook n8n pour ce kind —
// permet à l'appelant de retomber sur le comportement par défaut (IA classique,
// brouillon mailto…) sans traiter ça comme une erreur.
export async function callN8n(kind: "research" | "send", payload: unknown): Promise<unknown | null> {
  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ kind, payload }),
  });
  if (res.status === 409) return null; // webhook non configuré — pas une erreur
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Erreur n8n-proxy ${res.status}`);
  return data.data;
}
