// Edge Function : n8n-proxy
// Rôle : relayer un appel vers le webhook n8n PERSONNEL de l'abonné (BYO) sans
// jamais exposer son jeton d'authentification au navigateur — le secret est lu
// chiffré depuis user_n8n_config, déchiffré côté serveur, et injecté en header
// Authorization vers le webhook de l'abonné. Aucune dépendance à un n8n
// plateforme : chaque abonné apporte ses propres workflows.
//
// API (POST only) :
//   { kind: "research", payload: { entreprise, website? } } -> { data }
//   { kind: "send", payload: object }                       -> { sent: true }

import { handleOptions, json } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { adminClient } from "../_shared/admin.ts";
import { decryptSecret } from "../_shared/crypto.ts";
import { assertActiveEntitlement, EntitlementError } from "../_shared/entitlement.ts";

interface ProxyRequest {
  kind?: "research" | "send";
  payload?: unknown;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    const user = await requireUser(req);
    // Licence : refuse si abonnement inactif ou expiré (402).
    await assertActiveEntitlement(user.id);

    const { kind, payload } = (await req.json()) as ProxyRequest;
    if (kind !== "research" && kind !== "send") {
      return json({ error: "Paramètre 'kind' invalide (research|send)" }, 400);
    }

    const db = adminClient();
    const { data: cfg } = await db
      .from("user_n8n_config")
      .select("research_url,research_secret_ciphertext,research_secret_iv,send_url,send_secret_ciphertext,send_secret_iv")
      .eq("user_id", user.id)
      .maybeSingle();

    const url = kind === "research" ? cfg?.research_url : cfg?.send_url;
    if (!url) {
      return json(
        { error: `Aucun webhook n8n de ${kind === "research" ? "recherche" : "envoi"} configuré`, detail: "Configurez-le dans Réglages." },
        409,
      );
    }

    const secretCiphertext = kind === "research" ? cfg?.research_secret_ciphertext : cfg?.send_secret_ciphertext;
    const secretIv = kind === "research" ? cfg?.research_secret_iv : cfg?.send_secret_iv;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (secretCiphertext && secretIv) {
      const secret = await decryptSecret({ ciphertext: secretCiphertext, iv: secretIv });
      headers["Authorization"] = `Bearer ${secret}`;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload ?? {}),
    });

    const text = await res.text();
    if (!res.ok) {
      return json({ error: "Échec du webhook n8n", detail: text.slice(0, 300) }, 502);
    }

    let data: unknown = text;
    try { data = JSON.parse(text); } catch { /* réponse non-JSON, renvoyée telle quelle */ }

    return json({ sent: true, data });
  } catch (err) {
    if (err instanceof EntitlementError) {
      return json({ error: "Licence inactive ou expirée", code: err.reason }, 402);
    }
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith("UNAUTHENTICATED") ? 401 : 500;
    return json({ error: msg.split(":")[0], detail: msg }, status);
  }
});
