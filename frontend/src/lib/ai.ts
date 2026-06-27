// Service IA — appelle ai-proxy (Edge Function) avec le JWT de l'utilisateur.
// Jamais de clé API en clair côté client.

import { supabase } from "./supabase";
import type { AgentKey, AiProxyRequest, AiProxyResponse } from "@/types";

const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-proxy`;

async function getBearerHeader(): Promise<{ Authorization: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Non authentifié — connexion requise");
  return { Authorization: `Bearer ${token}` };
}

// Appel principal : messages + contexte métier optionnel.
export async function callAI(payload: AiProxyRequest): Promise<AiProxyResponse> {
  const authHeader = await getBearerHeader();
  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `Erreur proxy IA ${res.status}`);
  }
  return res.json() as Promise<AiProxyResponse>;
}

// Raccourci pour une question rapide à un agent.
export async function askAgent(
  agent: AgentKey,
  userMessage: string,
  context?: unknown,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
): Promise<string> {
  const result = await callAI({
    agent,
    messages: [...history, { role: "user", content: userMessage }],
    context,
  });
  return result.content;
}

// Challenge BMC d'un bloc par le Stratège.
export async function challengeBmcBlock(
  blockKey: string,
  content: string,
): Promise<string> {
  return askAgent(
    "strategist",
    `Challenge ce bloc BMC "${blockKey}" : ${content}. Identifie les présupposés fragiles, pose 2 questions déstabilisantes et propose une reformulation plus solide.`,
  );
}

// Génération de recherche prospect (SONCAS + angle de vente).
export async function researchProspect(
  prospectName: string,
  company: string | null,
  profileContext: unknown,
): Promise<string> {
  return askAgent(
    "commercial",
    `Prépare un dossier de prospection pour ${prospectName}${company ? ` (${company})` : ""}. Identifie le profil SONCAS probable, propose un angle de vente, et rédige un premier message de prise de contact.`,
    profileContext,
  );
}

// Extraction OCR — appelle ocr-receipt.
export async function ocrReceipt(storagePath: string): Promise<unknown> {
  const authHeader = await getBearerHeader();
  const ocrUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-receipt`;
  const res = await fetch(ocrUrl, {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ storage_path: storagePath }),
  });
  if (!res.ok) throw new Error(`OCR échoué ${res.status}`);
  const data = await res.json();
  return data.data;
}
