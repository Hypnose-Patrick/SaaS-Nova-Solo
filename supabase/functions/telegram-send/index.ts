// Edge Function : telegram-send
// Rôle : envoyer une notification Telegram via le bot de plateforme,
// sans jamais exposer le bot token au navigateur.
//
// Modèle : un seul bot Nova Solo (@NovaSoloBot). Chaque utilisateur démarre
// une conversation avec le bot et enregistre son telegram_chat_id (non secret)
// dans messaging_settings. La fonction résout ce chat_id côté serveur pour
// l'utilisateur authentifié — impossible d'envoyer à un chat tiers arbitraire.
//
// Secret attendu : TELEGRAM_BOT_TOKEN (supabase secrets set ...)

import { handleOptions, json } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { adminClient } from "../_shared/admin.ts";

interface SendRequest {
  text?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    const user = await requireUser(req);

    const { text } = (await req.json()) as SendRequest;
    if (!text || !text.trim()) {
      return json({ error: "Champ 'text' requis" }, 400);
    }
    if (text.length > 4000) {
      return json({ error: "Message trop long (max 4000)" }, 400);
    }

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) return json({ error: "CONFIG" }, 500);

    // Résolution du chat_id pour CET utilisateur uniquement.
    const db = adminClient();
    const { data: profile } = await db
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) return json({ error: "Profil introuvable" }, 404);

    const { data: settings } = await db
      .from("messaging_settings")
      .select("telegram_chat_id")
      .eq("profile_id", profile.id)
      .maybeSingle();

    const chatId = settings?.telegram_chat_id;
    if (!chatId) {
      return json(
        { error: "Aucun chat Telegram lié. Démarrez @NovaSoloBot puis enregistrez votre chat_id." },
        409,
      );
    }

    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
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
    return json({ error: msg.split(":")[0] }, status);
  }
});
