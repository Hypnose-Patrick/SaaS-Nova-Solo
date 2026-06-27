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
import { sanitize, sanitizeText } from "../_shared/sanitize.ts";
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    await requireUser(req); // 401 si non authentifié

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

    const content = provider === "anthropic"
      ? await callAnthropic(model, system, safeMessages)
      : await callOpenRouter(model, system, safeMessages);

    return json({ content, provider, model, agent: body.agent ?? "nova" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith("UNAUTHENTICATED") ? 401 : 500;
    // On ne renvoie jamais la stack ni les valeurs de secrets.
    return json({ error: msg.split(":")[0], detail: msg }, status);
  }
});
