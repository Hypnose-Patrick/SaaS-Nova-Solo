// Edge Function : ai-proxy
// Rôle : relayer les appels IA SANS exposer la clé au navigateur, et SANS
// laisser fuiter de secret dans le contexte transmis au fournisseur.
//
// Sécurité :
//  - JWT Supabase obligatoire (requireUser)
//  - clé du fournisseur lue côté serveur (Deno.env) — jamais du body
//  - contexte + messages passés par sanitize() avant envoi
//  - modèle validé contre une liste blanche
//
// Secrets attendus (supabase secrets set ...) :
//   OPENROUTER_API_KEY  et/ou  ANTHROPIC_API_KEY
//   AI_DEFAULT_PROVIDER (openrouter|anthropic, défaut openrouter)

import { handleOptions, json } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { adminClient } from "../_shared/admin.ts";
import { decryptSecret } from "../_shared/crypto.ts";
import { sanitize, sanitizeText } from "../_shared/sanitize.ts";
import { assertActiveEntitlement, EntitlementError } from "../_shared/entitlement.ts";
import { systemFor } from "./agents.ts";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AiRequest {
  agent?: string;
  messages?: ChatMessage[];
  context?: unknown;
  provider?: "openrouter" | "anthropic";
  model?: string;
  stream?: boolean;
}

// Listes blanches : le client ne peut demander qu'un modèle autorisé.
const ALLOWED_MODELS: Record<string, Set<string>> = {
  openrouter: new Set([
    "anthropic/claude-sonnet-4.6",
    "anthropic/claude-haiku-4.5",
    "openai/gpt-4o-mini",
    "google/gemini-flash-1.5",
  ]),
  anthropic: new Set([
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
  ]),
};

const DEFAULT_MODEL: Record<string, string> = {
  openrouter: "anthropic/claude-haiku-4.5",
  anthropic: "claude-haiku-4-5-20251001",
};

function pickModel(provider: string, requested?: string): string {
  if (requested && ALLOWED_MODELS[provider]?.has(requested)) return requested;
  return DEFAULT_MODEL[provider];
}

async function callOpenRouter(
  model: string,
  system: string,
  messages: ChatMessage[],
): Promise<string> {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) throw new Error("CONFIG: OPENROUTER_API_KEY absente");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Title": "Nova Solo",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      max_tokens: 1500,
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`PROVIDER openrouter ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

async function callOpenRouterStream(
  model: string,
  system: string,
  messages: ChatMessage[],
): Promise<Response> {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) throw new Error("CONFIG: OPENROUTER_API_KEY absente");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Title": "Nova Solo",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      max_tokens: 1500,
      temperature: 0.7,
      stream: true,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`PROVIDER openrouter ${res.status}: ${detail.slice(0, 300)}`);
  }
  return new Response(res.body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

async function callAnthropic(
  model: string,
  system: string,
  messages: ChatMessage[],
): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("CONFIG: ANTHROPIC_API_KEY absente");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      system,
      messages,
      max_tokens: 1500,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`PROVIDER anthropic ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  return data?.content?.[0]?.text ?? "";
}

// --- BYOK : appel au fournisseur de l'abonné avec SA clé (déchiffrée serveur) ---

// Endpoint compatible OpenAI (OpenAI · OpenRouter · Groq · Together · …).
async function callOpenAICompatible(
  baseUrl: string,
  model: string,
  key: string,
  system: string,
  messages: ChatMessage[],
): Promise<string> {
  const url = baseUrl.replace(/\/+$/, "") + "/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Title": "Nova Solo",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      max_tokens: 1500,
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`PROVIDER byok ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

// Anthropic direct avec la clé de l'abonné.
async function callAnthropicByok(
  baseUrl: string,
  model: string,
  key: string,
  system: string,
  messages: ChatMessage[],
): Promise<string> {
  const url = baseUrl.replace(/\/+$/, "") + "/v1/messages";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, system, messages, max_tokens: 1500 }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`PROVIDER byok ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  return data?.content?.[0]?.text ?? "";
}

interface AiConfigRow {
  mode: string;
  provider: string | null;
  base_url: string | null;
  model: string | null;
  key_ciphertext: string | null;
  key_iv: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    const user = await requireUser(req); // 401 si non authentifié

    // Licence : refuse si abonnement inactif ou expiré (402).
    await assertActiveEntitlement(user.id);

    const body = (await req.json()) as AiRequest;
    const provider = body.provider ??
      (Deno.env.get("AI_DEFAULT_PROVIDER") as "openrouter" | "anthropic") ??
      "openrouter";

    if (!ALLOWED_MODELS[provider]) {
      return json({ error: `Fournisseur inconnu: ${provider}` }, 400);
    }

    const model = pickModel(provider, body.model);
    const system = systemFor(body.agent ?? "nova");

    // --- Filtrage défensif des secrets ---
    const safeMessages: ChatMessage[] = (body.messages ?? []).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: sanitizeText(String(m.content ?? "")),
    }));

    // Le contexte métier est injecté comme premier message utilisateur, nettoyé.
    if (body.context !== undefined && body.context !== null) {
      const safeContext = sanitize(body.context);
      safeMessages.unshift({
        role: "user",
        content: "Contexte métier (données nettoyées) :\n" +
          JSON.stringify(safeContext),
      });
    }

    if (safeMessages.length === 0) {
      return json({ error: "Aucun message fourni" }, 400);
    }

    // --- BYOK : si l'abonné a configuré son propre fournisseur distant, on
    // route vers SA clé (déchiffrée serveur), pas la clé plateforme. ---
    const { data: cfg } = await adminClient()
      .from("user_ai_config")
      .select("mode,provider,base_url,model,key_ciphertext,key_iv")
      .eq("user_id", user.id)
      .maybeSingle();
    const config = cfg as AiConfigRow | null;

    // Édition Solo (CHF 9/mois) = BYOK obligatoire : l'abonné paie son propre
    // fournisseur IA, pas de bascule silencieuse sur l'IA managée plateforme.
    const { data: profileRow } = await adminClient()
      .from("profiles")
      .select("plan")
      .eq("user_id", user.id)
      .maybeSingle();
    const hasByokConfig = config?.mode === "byok_remote" &&
      !!config.key_ciphertext && !!config.key_iv;
    if (profileRow?.plan === "solo" && !hasByokConfig && config?.mode !== "byok_local") {
      return json({
        error: "Configurez votre clé IA dans Réglages pour utiliser l'IA — offre Solo (BYOK).",
        code: "byok_required",
      }, 402);
    }

    if (config?.mode === "byok_remote" && config.key_ciphertext && config.key_iv) {
      const userKey = await decryptSecret({
        ciphertext: config.key_ciphertext,
        iv: config.key_iv,
      });
      const userModel = config.model ?? "gpt-4o-mini";
      const byokContent = config.provider === "anthropic"
        ? await callAnthropicByok(
            config.base_url ?? "https://api.anthropic.com",
            userModel,
            userKey,
            system,
            safeMessages,
          )
        : await callOpenAICompatible(
            config.base_url ?? "",
            userModel,
            userKey,
            system,
            safeMessages,
          );
      return json({
        content: byokContent,
        provider: config.provider,
        model: userModel,
        agent: body.agent ?? "nova",
        byok: true,
      });
    }

    // Streaming SSE — uniquement OpenRouter (Anthropic direct non supporté en streaming ici)
    if (body.stream && provider === "openrouter") {
      return await callOpenRouterStream(model, system, safeMessages);
    }

    const content = provider === "anthropic"
      ? await callAnthropic(model, system, safeMessages)
      : await callOpenRouter(model, system, safeMessages);

    return json({ content, provider, model, agent: body.agent ?? "nova" });
  } catch (err) {
    if (err instanceof EntitlementError) {
      return json({ error: "Licence inactive ou expirée", code: err.reason }, 402);
    }
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith("UNAUTHENTICATED") ? 401 : 500;
    // Le détail complet (peut inclure jusqu'à 300 car. de la réponse brute du
    // fournisseur IA) reste dans les logs serveur uniquement — jamais renvoyé au client.
    console.error("[ai-proxy]", msg);
    return json({ error: msg.split(":")[0] }, status);
  }
});
