// Edge Function : n8n-config
// Rôle : lire / écrire / réinitialiser les webhooks n8n personnels d'un abonné
// (recherche d'entreprise + envoi de dossier/mail). Les URLs ne sont pas
// secrètes (renvoyées telles quelles) ; le jeton d'authentification optionnel
// (header partagé) est chiffré avant stockage et n'est JAMAIS renvoyé au
// client (seul *_secret_last4 pour l'affichage).
//
// Sécurité :
//  - JWT Supabase obligatoire (requireUser)
//  - licence active obligatoire (assertActiveEntitlement)
//  - accès à user_n8n_config via service_role uniquement (table en RLS deny)
//  - secret chiffré AES-GCM (crypto.ts, secret AI_CONFIG_ENC_KEY)
//
// API (POST only) :
//   { action: "get" }                                                -> { config }
//   { action: "reset" }                                               -> { config vide }
//   { action: "save", research_url?, research_secret?, send_url?, send_secret? } -> { config }

import { handleOptions, json } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { adminClient } from "../_shared/admin.ts";
import { encryptSecret } from "../_shared/crypto.ts";
import { assertActiveEntitlement, EntitlementError } from "../_shared/entitlement.ts";

interface SafeConfig {
  research_url: string | null;
  research_secret_last4: string | null;
  send_url: string | null;
  send_secret_last4: string | null;
}

const EMPTY: SafeConfig = {
  research_url: null,
  research_secret_last4: null,
  send_url: null,
  send_secret_last4: null,
};

function isValidUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    const user = await requireUser(req);
    // Licence : refuse si abonnement inactif ou expiré (402).
    await assertActiveEntitlement(user.id);
    const db = adminClient();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "get");

    if (action === "get") {
      const { data } = await db
        .from("user_n8n_config")
        .select("research_url,research_secret_last4,send_url,send_secret_last4")
        .eq("user_id", user.id)
        .maybeSingle();
      return json({ config: (data as SafeConfig) ?? EMPTY });
    }

    if (action === "reset") {
      await db.from("user_n8n_config").delete().eq("user_id", user.id);
      return json({ config: EMPTY });
    }

    if (action === "save") {
      const researchUrl = body.research_url ? String(body.research_url).trim() : null;
      const sendUrl = body.send_url ? String(body.send_url).trim() : null;
      const researchSecret = body.research_secret ? String(body.research_secret).trim() : "";
      const sendSecret = body.send_secret ? String(body.send_secret).trim() : "";

      if (researchUrl && !isValidUrl(researchUrl)) {
        return json({ error: "URL de recherche invalide" }, 400);
      }
      if (sendUrl && !isValidUrl(sendUrl)) {
        return json({ error: "URL d'envoi invalide" }, 400);
      }

      const { data: existing } = await db
        .from("user_n8n_config")
        .select("research_secret_ciphertext,research_secret_iv,research_secret_last4,send_secret_ciphertext,send_secret_iv,send_secret_last4")
        .eq("user_id", user.id)
        .maybeSingle();

      const row: Record<string, unknown> = {
        user_id: user.id,
        research_url: researchUrl,
        send_url: sendUrl,
        updated_at: new Date().toISOString(),
      };

      if (researchSecret) {
        const enc = await encryptSecret(researchSecret);
        row.research_secret_ciphertext = enc.ciphertext;
        row.research_secret_iv = enc.iv;
        row.research_secret_last4 = researchSecret.slice(-4);
      } else {
        row.research_secret_ciphertext = existing?.research_secret_ciphertext ?? null;
        row.research_secret_iv = existing?.research_secret_iv ?? null;
        row.research_secret_last4 = existing?.research_secret_last4 ?? null;
      }

      if (sendSecret) {
        const enc = await encryptSecret(sendSecret);
        row.send_secret_ciphertext = enc.ciphertext;
        row.send_secret_iv = enc.iv;
        row.send_secret_last4 = sendSecret.slice(-4);
      } else {
        row.send_secret_ciphertext = existing?.send_secret_ciphertext ?? null;
        row.send_secret_iv = existing?.send_secret_iv ?? null;
        row.send_secret_last4 = existing?.send_secret_last4 ?? null;
      }

      const { error } = await db
        .from("user_n8n_config")
        .upsert(row, { onConflict: "user_id" });
      if (error) return json({ error: "Échec d'enregistrement", detail: error.message }, 500);

      return json({
        config: {
          research_url: researchUrl,
          research_secret_last4: (row.research_secret_last4 as string | null) ?? null,
          send_url: sendUrl,
          send_secret_last4: (row.send_secret_last4 as string | null) ?? null,
        } satisfies SafeConfig,
      });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (err) {
    if (err instanceof EntitlementError) {
      return json({ error: "Licence inactive ou expirée", code: err.reason }, 402);
    }
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith("UNAUTHENTICATED") ? 401 : 500;
    return json({ error: msg.split(":")[0], detail: msg }, status);
  }
});
