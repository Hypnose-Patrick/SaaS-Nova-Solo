import { useState } from "react";
import { callAI } from "@/lib/ai";
import type { AgentKey } from "@/types";

// Modèles autorisés par ai-proxy (allowlist OpenRouter). On reste sur OpenRouter
// pour le coût : haiku par défaut (rapide/bon marché), sonnet pour le raisonnement.
export const MODEL_REASONING = "anthropic/claude-3.5-sonnet";

interface GenOpts {
  model?: string;
  context?: unknown;
}

/** Hook standard d'appel IA via le proxy : loading / error + fonction gen(). */
export function useAiGen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function gen(agent: AgentKey, prompt: string, opts: GenOpts = {}): Promise<string | null> {
    setLoading(true);
    setError(null);
    try {
      const r = await callAI({
        agent,
        messages: [{ role: "user", content: prompt }],
        context: opts.context,
        model: opts.model,
      });
      return r.content;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur IA. Vérifiez que le proxy est déployé.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { loading, error, gen, setError };
}
