// Notifications Telegram — chaque abonné branche SON propre bot (BYO).
// Le token du bot (secret) transite une fois vers telegram-config qui le chiffre ;
// il n'est jamais relu (write-only, seul token_last4 revient). L'envoi passe par
// telegram-send qui déchiffre le token côté serveur.

import { supabase } from "./supabase";

export interface TelegramConfig {
  linked: boolean;
  chat_id: string | null;
  token_last4: string | null;
}

const CONFIG_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-config`;
const SEND_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-send`;

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Non authentifié — connexion requise");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function cfgCall(body: Record<string, unknown>): Promise<TelegramConfig> {
  const res = await fetch(CONFIG_URL, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Erreur telegram-config ${res.status}`);
  return data.config as TelegramConfig;
}

export const getTelegramConfig = (): Promise<TelegramConfig> => cfgCall({ action: "get" });

export const saveTelegramConfig = (input: {
  chat_id?: string | null;
  bot_token?: string | null;
}): Promise<TelegramConfig> => cfgCall({ action: "save", ...input });

export const resetTelegramConfig = (): Promise<TelegramConfig> => cfgCall({ action: "reset" });

// Envoie un message via le bot personnel de l'abonné. Lève une Error parlante.
export async function sendTelegram(text: string): Promise<void> {
  const res = await fetch(SEND_URL, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ text }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 409) throw new Error("Aucun bot Telegram lié. Renseignez votre bot et votre chat_id ci-dessus.");
    throw new Error(body.detail ?? body.error ?? `Échec Telegram ${res.status}`);
  }
}
