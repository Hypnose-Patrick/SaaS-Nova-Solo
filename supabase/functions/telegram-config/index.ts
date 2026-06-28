// Edge Function : telegram-config
// Rôle : lire / écrire / réinitialiser le bot Telegram PERSONNEL d'un abonné (BYO).
// Le token du bot est chiffré avant stockage et n'est JAMAIS renvoyé au client
// (seul bot_token_last4 pour l'affichage).
//
// Sécurité :
//  - JWT Supabase obligatoire (requireUser)
//  - accès à user_telegram_config via service_role uniquement (table RLS deny)
//  - token chiffré AES-GCM (crypto.ts, secret AI_CONFIG_ENC_KEY)
//
// API (POST only) :
//   { action: "get" }                              -> { config }
//   { action: "reset" }                            -> { config vide }
//   { action: "save", chat_id?, bot_token? }       -> { config }

import { handleOptions, json } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { adminClient } from "../_shared/admin.ts";
import { encryptSecret } from "../_shared/crypto.ts";

interface SafeTg {
  linked: boolean;
  chat_id: string | null;
  token_last4: string | null;
}

const EMPTY: SafeTg = { linked: false, chat_id: null, token_last4: null };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    const user = await requireUser(req);
    const db = adminClient();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "get");

    if (action === "get") {
      const { data } = await db
        .from("user_telegram_config")
        .select("bot_token_ciphertext,bot_token_last4,chat_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) return json({ config: EMPTY });
      return json({
        config: {
          linked: Boolean(data.bot_token_ciphertext && data.chat_id),
          chat_id: data.chat_id ?? null,
          token_last4: data.bot_token_last4 ?? null,
        } satisfies SafeTg,
      });
    }

    if (action === "reset") {
      await db.from("user_telegram_config").delete().eq("user_id", user.id);
      return json({ config: EMPTY });
    }

    if (action === "save") {
      const chatId = body.chat_id != null ? String(body.chat_id).trim() || null : undefined;
      const botToken = body.bot_token ? String(body.bot_token).trim() : "";

      const { data: existing } = await db
        .from("user_telegram_config")
        .select("bot_token_ciphertext,bot_token_iv,bot_token_last4,chat_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const row: Record<string, unknown> = {
        user_id: user.id,
        updated_at: new Date().toISOString(),
        // chat_id fourni => on l'utilise ; sinon on conserve l'existant.
        chat_id: chatId !== undefined ? chatId : (existing?.chat_id ?? null),
      };

      if (botToken) {
        const enc = await encryptSecret(botToken);
        row.bot_token_ciphertext = enc.ciphertext;
        row.bot_token_iv = enc.iv;
        row.bot_token_last4 = botToken.slice(-4);
      } else {
        // Pas de nouveau token : on conserve l'existant.
        row.bot_token_ciphertext = existing?.bot_token_ciphertext ?? null;
        row.bot_token_iv = existing?.bot_token_iv ?? null;
        row.bot_token_last4 = existing?.bot_token_last4 ?? null;
      }

      const { error } = await db
        .from("user_telegram_config")
        .upsert(row, { onConflict: "user_id" });
      if (error) return json({ error: "Échec d'enregistrement", detail: error.message }, 500);

      return json({
        config: {
          linked: Boolean(row.bot_token_ciphertext && row.chat_id),
          chat_id: (row.chat_id as string | null) ?? null,
          token_last4: (row.bot_token_last4 as string | null) ?? null,
        } satisfies SafeTg,
      });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith("UNAUTHENTICATED") ? 401 : 500;
    return json({ error: msg.split(":")[0], detail: msg }, status);
  }
});
