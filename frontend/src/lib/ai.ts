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

// Streaming SSE : appelle ai-proxy avec stream:true et émet les tokens via onChunk.
// Retourne le texte complet accumulé.
export async function callAIStream(
  payload: import("@/types").AiProxyRequest & { stream: true },
  onChunk: (accumulated: string) => void,
): Promise<string> {
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
  if (!res.body) throw new Error("Pas de stream dans la réponse");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return accumulated;
      try {
        const obj = JSON.parse(data);
        const delta: string = obj?.choices?.[0]?.delta?.content ?? "";
        if (delta) { accumulated += delta; onChunk(accumulated); }
      } catch { /* ignore malformed SSE lines */ }
    }
  }
  return accumulated;
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

// Gabarits de mail de prise de contact (structure VOUS-MOI-NOUS).
export const PROSPECT_EMAIL_TEMPLATES = [
  { key: "direct", label: "Approche directe (120–140 mots)" },
  { key: "institutionnel", label: "Relais institutionnel (80–100 mots)" },
  { key: "relance", label: "Relance rebond (60–80 mots)" },
  { key: "spontanee", label: "Candidature spontanée (200–260 mots)" },
] as const;

export type ProspectEmailTemplate = (typeof PROSPECT_EMAIL_TEMPLATES)[number]["key"];

const PROSPECT_EMAIL_BRIEF: Record<ProspectEmailTemplate, string> = {
  direct: "Approche directe et concise (120–140 mots).",
  institutionnel: "Relais institutionnel, ton sobre et factuel (80–100 mots).",
  relance: "Relance rebond, courte et non insistante (60–80 mots).",
  spontanee: "Candidature spontanée argumentée (200–260 mots).",
};

// Mail de prise de contact (commercial) — structure VOUS-MOI-NOUS.
export async function prospectEmail(
  prospectName: string,
  company: string | null,
  soncas: string | null,
  template: ProspectEmailTemplate,
  profileContext: unknown,
): Promise<string> {
  return askAgent(
    "commercial",
    `Rédige un e-mail de prise de contact à ${prospectName}${company ? ` (${company})` : ""} pour décrocher un premier échange. ${PROSPECT_EMAIL_BRIEF[template]} Structure VOUS-MOI-NOUS : ouvre sur le besoin du destinataire (VOUS), présente brièvement la valeur (MOI), propose une collaboration concrète (NOUS).${soncas ? ` Adapte le levier à la motivation d'achat dominante « ${soncas} » (SONCAS).` : ""} Fr-CH, sans anglicisme, objet inclus, un seul appel à l'action clair. N'invente aucun fait sur l'entreprise. Réponds uniquement avec l'objet et le corps du mail.`,
    profileContext,
  );
}

// Guide de traitement des objections (commercial) — adapté au profil SONCAS.
export async function prospectObjections(
  prospectName: string,
  company: string | null,
  soncas: string | null,
  profileContext: unknown,
): Promise<string> {
  return askAgent(
    "commercial",
    `Prépare un guide de traitement des objections pour l'entretien avec ${prospectName}${company ? ` (${company})` : ""}. ` +
      `Liste les 4 à 5 objections les plus probables (prix, temps, confiance, besoin réel, timing) ` +
      `et, pour chacune : une reformulation empathique, une réponse argumentée, puis une question de relance. ` +
      `${soncas ? `Adapte le ton au levier de motivation dominant « ${soncas} » (SONCAS). ` : ""}` +
      `Fr-CH, concret, sans jargon. N'invente aucun fait sur le prospect ni son entreprise.`,
    profileContext,
  );
}

// Mini-dossier de proposition personnalisé pour un prospect (commercial).
export async function prospectDossier(
  prospectName: string,
  company: string | null,
  soncas: string | null,
  estValue: number,
  profileContext: unknown,
): Promise<string> {
  return askAgent(
    "commercial",
    `Rédige un dossier de proposition commerciale concis et structuré destiné à ${prospectName}${company ? ` (${company})` : ""}. ` +
      `Structure : 1) Contexte & enjeu perçu, 2) Proposition de valeur, 3) Modalités (déroulé, livrables), ` +
      `4) Investissement${estValue > 0 ? ` (ordre de grandeur ~${Math.round(estValue)} CHF)` : ""}, 5) Prochaine étape. ` +
      `${soncas ? `Mets en avant le levier « ${soncas} » (SONCAS). ` : ""}` +
      `Fr-CH, ton professionnel et chaleureux. Appuie-toi uniquement sur les informations du profil fourni, ` +
      `n'invente aucun fait sur le prospect.`,
    profileContext,
  );
}

// ── Simulation Swarm — panel de personas qui débattent d'une décision ──
// Orchestration multi-agents : génération du panel → vote de chaque persona →
// synthèse Nova. Personas dérivés du profil de l'abonné, aucun défaut personnel.

export interface SwarmPersona {
  name: string;   // ex. « Prénom, âge, trait caractéristique »
  profil: string; // 1 phrase : situation + rapport à la décision
}

export type SwarmVote = "oui" | "non" | "nuance";

export interface SwarmVerdict {
  vote: SwarmVote;
  argument: string;  // 2–3 phrases du point de vue du persona
  objection: string; // principale réserve, 1 phrase
}

export type SwarmPersonaVerdict = SwarmPersona & SwarmVerdict;

function firstJson(raw: string): string | null {
  const m = raw.match(/[[{][\s\S]*[\]}]/);
  return m ? m[0] : null;
}

// Phase 1 — génère un panel de personas-clients variés pour le marché du profil.
export async function swarmPanel(
  question: string,
  count: number,
  profileContext: unknown,
): Promise<SwarmPersona[]> {
  const raw = await askAgent(
    "strategist",
    `Génère un panel de ${count} personas-clients réalistes, distincts et représentatifs ` +
      `du marché correspondant au profil fourni (Suisse romande). Ils serviront à tester la décision : ` +
      `« ${question} ». Varie âges, situations, budgets et postures (enthousiaste, prudent, sceptique, contraint). ` +
      `Réponds UNIQUEMENT par un tableau JSON strict, sans texte autour : ` +
      `[{"name":"Prénom, âge, trait","profil":"une phrase sur sa situation et son rapport à la décision"}]. ` +
      `N'invente aucun fait sur l'utilisateur ; appuie-toi sur le marché de son activité.`,
    profileContext,
  );
  const json = firstJson(raw);
  if (!json) return [];
  try {
    const arr = JSON.parse(json) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((o) => {
        const p = o as Partial<SwarmPersona>;
        return {
          name: typeof p.name === "string" ? p.name.trim() : "",
          profil: typeof p.profil === "string" ? p.profil.trim() : "",
        };
      })
      .filter((p) => p.name)
      .slice(0, count);
  } catch {
    return [];
  }
}

function normalizeVote(v: unknown): SwarmVote {
  const s = String(v ?? "").toLowerCase();
  if (/(^|[^a-z])oui|favorable|^yes/.test(s)) return "oui";
  if (/non|contre|défavorable|refus/.test(s)) return "non";
  return "nuance";
}

// Phase 2 — un persona vote et argumente sur la décision (appel par persona).
export async function swarmVerdict(
  persona: SwarmPersona,
  question: string,
  profileContext: unknown,
): Promise<SwarmVerdict> {
  const raw = await askAgent(
    "commercial",
    `Incarne ce persona-client : ${persona.name} — ${persona.profil}. ` +
      `Réagis à la décision suivante du point de vue de CE persona : « ${question} ». ` +
      `Donne ton vote (oui / non / nuancé), un argument honnête en 2–3 phrases, et ta principale réserve. ` +
      `Reste réaliste et critique, n'enjolive pas. ` +
      `Réponds UNIQUEMENT par un objet JSON strict : ` +
      `{"vote":"oui|non|nuance","argument":"...","objection":"..."}.`,
    profileContext,
  );
  const fallback: SwarmVerdict = { vote: "nuance", argument: raw.trim().slice(0, 400), objection: "" };
  const json = firstJson(raw);
  if (!json) return fallback;
  try {
    const o = JSON.parse(json) as Partial<SwarmVerdict>;
    return {
      vote: normalizeVote(o.vote),
      argument: typeof o.argument === "string" && o.argument ? o.argument.trim() : fallback.argument,
      objection: typeof o.objection === "string" ? o.objection.trim() : "",
    };
  } catch {
    return fallback;
  }
}

// Phase 3 — Nova synthétise les votes en 2–3 actions concrètes.
export async function swarmRecommendation(
  question: string,
  verdicts: SwarmPersonaVerdict[],
  profileContext: unknown,
): Promise<string> {
  const digest = verdicts
    .map((v) => `- ${v.name} [${v.vote}] : ${v.objection || v.argument}`)
    .join("\n");
  return askAgent(
    "nova",
    `Une simulation « swarm » vient de tester la décision « ${question} » auprès d'un panel de personas. ` +
      `Voici leurs votes et réserves :\n${digest}\n\n` +
      `Synthétise les 3 points de friction majeurs, puis recommande 2 à 3 actions concrètes et activables ` +
      `pour lever ces freins. Sois direct et opérationnel. N'invente aucun chiffre.`,
    profileContext,
  );
}

// Extraction de reçu / quittance par IA à partir du texte collé.
// Renvoie des champs structurés pour préremplir une écriture comptable.
export interface ReceiptExtraction {
  montant: number | null;
  date: string | null;
  fournisseur: string | null;
  tva: number | null;
  categorie: string | null;
  type: "revenu" | "depense";
}

export async function extractReceipt(
  rawText: string,
  categories: string[],
  profileContext: unknown,
): Promise<ReceiptExtraction> {
  const raw = await askAgent(
    "financier",
    `Tu es un assistant comptable suisse. Extrais les données de ce reçu / cette quittance. ` +
      `Détermine : montant TTC en CHF (nombre), date au format YYYY-MM-DD, fournisseur / émetteur, ` +
      `taux de TVA applicable (8.1, 3.8, 2.6 ou null), catégorie comptable parmi exactement [${categories.join(", ")}], ` +
      `et type ("depense" pour un achat, "revenu" pour une recette). ` +
      `Reçu : """${rawText}""". ` +
      `Réponds UNIQUEMENT par un objet JSON strict, sans texte autour : ` +
      `{"montant":0,"date":"YYYY-MM-DD","fournisseur":"","tva":null,"categorie":"","type":"depense"}. ` +
      `Utilise null pour toute valeur que tu ne peux pas déterminer.`,
    profileContext,
  );
  const fallback: ReceiptExtraction = {
    montant: null, date: null, fournisseur: null, tva: null, categorie: null, type: "depense",
  };
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const o = JSON.parse(match[0]) as Partial<ReceiptExtraction>;
    return {
      montant: typeof o.montant === "number" ? o.montant : null,
      date: typeof o.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.date) ? o.date : null,
      fournisseur: typeof o.fournisseur === "string" && o.fournisseur ? o.fournisseur : null,
      tva: typeof o.tva === "number" ? o.tva : null,
      categorie: typeof o.categorie === "string" && categories.includes(o.categorie) ? o.categorie : null,
      type: o.type === "revenu" ? "revenu" : "depense",
    };
  } catch {
    return fallback;
  }
}

// Une transaction extraite d'un relevé bancaire.
export interface StatementTx {
  date: string;        // YYYY-MM-DD
  description: string;
  amount: number;      // CHF signé : >0 = crédit/recette, <0 = débit/dépense
}

// Extrait TOUTES les transactions d'un relevé bancaire (texte brut d'un PDF/CSV).
// Robuste à la diversité des banques (l'agent financier interprète la mise en page).
// Renvoie un tableau possiblement vide.
export async function extractStatement(
  rawText: string,
  profileContext?: unknown,
): Promise<StatementTx[]> {
  const clipped = rawText.length > 14000 ? rawText.slice(0, 14000) : rawText;
  const raw = await askAgent(
    "financier",
    `Tu es un assistant comptable suisse. Voici le TEXTE BRUT d'un relevé bancaire. ` +
      `Extrais CHAQUE transaction. Pour chacune : date (YYYY-MM-DD), description courte ` +
      `(libellé / contrepartie), et montant en CHF en NOMBRE SIGNÉ : positif pour un crédit/entrée, ` +
      `négatif pour un débit/sortie. Ignore les lignes de solde, totaux, en-têtes et reports. ` +
      `Relevé : """${clipped}""". ` +
      `Réponds UNIQUEMENT par un tableau JSON strict, sans texte autour : ` +
      `[{"date":"YYYY-MM-DD","description":"","amount":0}]. Tableau vide [] si aucune transaction.`,
    profileContext,
  );
  try {
    const js = firstJson(raw);
    if (!js) return [];
    const arr = JSON.parse(js) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((o): StatementTx | null => {
        const r = (o ?? {}) as Record<string, unknown>;
        const date = typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : null;
        const amount = typeof r.amount === "number" ? r.amount : Number(r.amount);
        if (!date || !isFinite(amount) || amount === 0) return null;
        return { date, description: typeof r.description === "string" ? r.description : "", amount };
      })
      .filter((x): x is StatementTx => x !== null);
  } catch {
    return [];
  }
}

// Résultat d'extraction renvoyé par l'Edge Function ocr-receipt (vision IA).
export interface ReceiptOcr {
  fournisseur: string | null;
  date: string | null;            // YYYY-MM-DD
  montant_ttc: number | null;
  tva_taux: number | null;
  tva_montant: number | null;
  categorie: string | null;
  devise: string;
  confiance: number;
}

// Extraction OCR depuis une VRAIE image — appelle ocr-receipt (bucket privé).
export async function ocrReceipt(storagePath: string): Promise<ReceiptOcr> {
  const authHeader = await getBearerHeader();
  const ocrUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-receipt`;
  const res = await fetch(ocrUrl, {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ storage_path: storagePath }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? err.error ?? `OCR échoué ${res.status}`);
  }
  const data = await res.json();
  return data.data as ReceiptOcr;
}
