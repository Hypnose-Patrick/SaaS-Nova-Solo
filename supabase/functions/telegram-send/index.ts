// Edge Function : telegram-send
// Rôle : envoyer une notification via le bot Telegram PERSONNEL de l'abonné (BYO).
// Le token du bot de l'abonné est lu depuis user_telegram_config (chiffré) et
// déchiffré côté serveur — jamais exposé au navigateur. Le bot de l'abonné ne
// peut écrire qu'au chat_id qu'il a lui-même enregistré.
//
// Aucune dépendance à un bot de plateforme : chaque abonné apporte son propre bot.

import { handleOptions, json } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { adminClient } from "../_shared/admin.ts";
import { decryptSecret } from "../_shared/crypto.ts";

interface SendRequest {
  text?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    const user = await requireUser(req);

    const { text } = (await req.json()) as SendRequest;
    if (!text || !text.trim()) return json({ error: "Champ 'text' requis" }, 400);
    if (text.length > 4000) return json({ error: "Message trop long (max 4000)" }, 400);

    // Bot personnel de l'abonné (token chiffré) + son chat_id.
    const db = adminClient();
    const { data: cfg } = await db
      .from("user_telegram_config")
      .select("bot_token_ciphertext,bot_token_iv,chat_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!cfg?.bot_token_ciphertext || !cfg?.bot_token_iv || !cfg?.chat_id) {
      return json(
        { error: "Aucun bot Telegram lié", detail: "Configurez votre bot et votre chat_id dans les Réglages." },
        409,
      );
    }

    const botToken = await decryptSecret({
      ciphertext: cfg.bot_token_ciphertext,
      iv: cfg.bot_token_iv,
    });

    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: cfg.chat_id,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      },
    );

    const tgData = await tgRes.json();
    if (!tgData.ok) {
      return json({ error: "Échec Telegram", detail: tgData.description }, 502);
    }

    return json({ sent: true, message_id: tgData.result?.message_id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith("UNAUTHENTICATED") ? 401 : 500;
    return json({ error: msg.split(":")[0], detail: msg }, status);
  }
});
