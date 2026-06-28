// Edge Function : ai-config
// Rôle : lire / écrire / réinitialiser la configuration du moteur IA d'un abonné
// (édition BYOK). La clé du fournisseur est chiffrée avant stockage et n'est
// JAMAIS renvoyée au client (seul key_last4 pour l'affichage).
//
// Sécurité :
//  - JWT Supabase obligatoire (requireUser)
//  - accès à user_ai_config via service_role uniquement (table en RLS deny)
//  - clé chiffrée AES-GCM (crypto.ts, secret AI_CONFIG_ENC_KEY)
//
// API (POST only, conforme aux CORS partagés) :
//   { action: "get" }                            -> { config }
//   { action: "reset" }                          -> { config: managed }
//   { action: "save", mode, provider?, base_url?, model?, key? } -> { config }

import { handleOptions, json } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { adminClient } from "../_shared/admin.ts";
import { encryptSecret } from "../_shared/crypto.ts";

interface SafeConfig {
  mode: string;
  provider: string | null;
  base_url: string | null;
  model: string | null;
  key_last4: string | null;
}

const DEFAULT_CONFIG: SafeConfig = {
  mode: "managed",
  provider: null,
  base_url: null,
  model: null,
  key_last4: null,
};

const VALID_MODES = new Set(["managed", "byok_remote", "byok_local"]);
const VALID_PROVIDERS = new Set(["openai", "anthropic"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    const user = await requireUser(req);
    const db = adminClient();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "get");

    // --- GET : renvoie la conf sans aucun secret ---
    if (action === "get") {
      const { data } = await db
        .from("user_ai_config")
        .select("mode,provider,base_url,model,key_last4")
        .eq("user_id", user.id)
        .maybeSingle();
      return json({ config: (data as SafeConfig) ?? DEFAULT_CONFIG });
    }

    // --- RESET : repasse en managé (efface toute conf BYOK) ---
    if (action === "reset") {
      await db.from("user_ai_config").delete().eq("user_id", user.id);
      return json({ config: DEFAULT_CONFIG });
    }

    // --- SAVE ---
    if (action === "save") {
      const mode = String(body.mode ?? "managed");
      if (!VALID_MODES.has(mode)) return json({ error: "Mode invalide" }, 400);

      // Managé : aucune conf BYOK conservée.
      if (mode === "managed") {
        await db.from("user_ai_config").delete().eq("user_id", user.id);
        return json({ config: DEFAULT_CONFIG });
      }

      const provider = body.provider ? String(body.provider) : null;
      const base_url = body.base_url ? String(body.base_url).trim() : null;
      const model = body.model ? String(body.model).trim() : null;
      const key = body.key ? String(body.key).trim() : "";

      if (mode === "byok_remote") {
        if (!provider || !VALID_PROVIDERS.has(provider)) {
          return json({ error: "Fournisseur invalide" }, 400);
        }
        if (provider === "openai" && !base_url) {
          return json({ error: "URL de base requise pour un fournisseur compatible OpenAI" }, 400);
        }
        if (!model) return json({ error: "Modèle requis" }, 400);
      }

      const row: Record<string, unknown> = {
        user_id: user.id,
        mode,
        provider,
        base_url,
        model,
        updated_at: new Date().toISOString(),
      };

      if (key) {
        // Nouvelle clé fournie : on (re)chiffre.
        const enc = await encryptSecret(key);
        row.key_ciphertext = enc.ciphertext;
        row.key_iv = enc.iv;
        row.key_last4 = key.slice(-4);
      } else if (mode === "byok_remote") {
        // Pas de nouvelle clé : on conserve l'existante (upsert remplace la ligne,
        // donc on recopie explicitement les champs chiffrés déjà stockés).
        const { data: existing } = await db
          .from("user_ai_config")
          .select("key_ciphertext,key_iv,key_last4")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!existing?.key_ciphertext) {
          return json({ error: "Clé API requise" }, 400);
        }
        row.key_ciphertext = existing.key_ciphertext;
        row.key_iv = existing.key_iv;
        row.key_last4 = existing.key_last4;
      } else {
        // byok_local : aucun secret stocké.
        row.key_ciphertext = null;
        row.key_iv = null;
        row.key_last4 = null;
      }

      const { error } = await db
        .from("user_ai_config")
        .upsert(row, { onConflict: "user_id" });
      if (error) return json({ error: "Échec d'enregistrement", detail: error.message }, 500);

      return json({
        config: {
          mode,
          provider,
          base_url,
          model,
          key_last4: (row.key_last4 as string | null) ?? null,
        } satisfies SafeConfig,
      });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith("UNAUTHENTICATED") ? 401 : 500;
    return json({ error: msg.split(":")[0], detail: msg }, status);
  }
});
