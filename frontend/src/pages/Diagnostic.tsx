import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useUserStore } from "@/stores/useUserStore";
import { useAppStore } from "@/stores/useAppStore";
import { callAI } from "@/lib/ai";
import type { AgentKey } from "@/types";
import { parseLooseJson, loadLocal, saveLocal } from "@/lib/local";
import { promptCascadeBmc, promptCascadeBp, promptCascadeCv, promptCascadePricingOffer } from "@/lib/lancementPrompts";

type CascadeKey = "bmc" | "bp" | "cv" | "pricing";
type CascadeStatus = "idle" | "loading" | "done" | "error";
interface CvFields { profil: string; skills: string; exp: string; formation: string; langues: string }
const CASCADE_META: { key: CascadeKey; label: string; to: string }[] = [
  { key: "bmc", label: "Business Model Canvas", to: "/bmc" },
  { key: "bp", label: "Business Plan", to: "/business-plan" },
  { key: "cv", label: "CV personnalisé", to: "/cv" },
  { key: "pricing", label: "Offre & Pricing", to: "/pricing" },
];

interface DiagResult {
  forces:  string[];
  freins:  string[];
  cap:     string;
  actions: string[];
}

const TEXTAREA: React.CSSProperties = {
  width: "100%",
  minHeight: 100,
  background: "var(--color-bg-input)",
  border: "var(--border-subtle)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text-primary)",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  lineHeight: "var(--leading-normal)",
  padding: "var(--space-3) var(--space-4)",
  resize: "vertical",
  outline: "none",
  boxSizing: "border-box" as const,
  marginTop: "var(--space-2)",
};

const QLABEL: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--text-base)",
  fontWeight: 400,
  color: "var(--color-text-primary)",
  marginBottom: "var(--space-1)",
};

const QHINT: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-text-muted)",
  marginBottom: "var(--space-2)",
};

function parseDiag(raw: string): DiagResult | null {
  const clean = raw.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");
  try {
    const parsed = JSON.parse(clean);
    if (
      Array.isArray(parsed.forces) &&
      Array.isArray(parsed.freins) &&
      typeof parsed.cap === "string" &&
      Array.isArray(parsed.actions)
    ) {
      return parsed as DiagResult;
    }
  } catch {
    // not parseable — fall back to null
  }
  return null;
}

export function Diagnostic() {
  const profile = useUserStore((s) => s.profile);
  const { updateProfile } = useUserStore();
  const { upsertBmcBlock } = useAppStore();

  const [q1, setQ1] = useState(profile?.situation ?? "");
  const [q2, setQ2] = useState("");
  const [q3, setQ3] = useState(profile?.profil ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagResult | null>(null);
  const [rawFallback, setRawFallback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"form" | "result">("form");
  const [cascade, setCascade] = useState<Record<CascadeKey, CascadeStatus>>({ bmc: "idle", bp: "idle", cv: "idle", pricing: "idle" });

  function diagText(): string {
    return [
      `SITUATION : ${q1}`,
      `BLOCAGES : ${q2}`,
      `VISION 12 MOIS : ${q3}`,
      result ? `CAP : ${result.cap}` : "",
      result ? `FORCES : ${result.forces.join(" · ")}` : "",
      result ? `FREINS : ${result.freins.join(" · ")}` : "",
    ].filter(Boolean).join("\n");
  }

  async function genJson<T>(agent: AgentKey, prompt: string): Promise<T | null> {
    try {
      const r = await callAI({ agent, messages: [{ role: "user", content: prompt }] });
      return parseLooseJson<T>(r.content);
    } catch { return null; }
  }

  async function fillBmcLike(prompt: string, keys: string[]): Promise<boolean> {
    if (!profile?.id) return false;
    const data = await genJson<Record<string, string>>("nova", prompt);
    if (!data) return false;
    const id = profile.id;
    await Promise.all(keys.filter((k) => data[k]).map((k) => upsertBmcBlock({ profile_id: id, block_key: k, content: String(data[k]) })));
    return keys.some((k) => data[k]);
  }

  async function fillCv(): Promise<boolean> {
    const data = await genJson<Partial<CvFields>>("communicant", promptCascadeCv(profile, diagText()));
    if (!data) return false;
    const cur = loadLocal<CvFields>("ns_cv_fields", { profil: "", skills: "", exp: "", formation: "", langues: "Français (langue maternelle), Anglais (B2), Allemand (B1)" });
    saveLocal("ns_cv_fields", { ...cur, profil: data.profil ?? cur.profil, skills: data.skills ?? cur.skills, exp: data.exp ?? cur.exp, formation: data.formation ?? cur.formation });
    return true;
  }

  async function fillPricing(): Promise<boolean> {
    try {
      const r = await callAI({ agent: "financier", messages: [{ role: "user", content: promptCascadePricingOffer(profile, diagText()) }] });
      if (r.content?.trim()) { saveLocal("ns_pricing_offre", r.content.trim()); return true; }
      return false;
    } catch { return false; }
  }

  async function runCascade() {
    setCascade({ bmc: "loading", bp: "loading", cv: "loading", pricing: "loading" });
    const tasks: [CascadeKey, Promise<boolean>][] = [
      ["bmc", fillBmcLike(promptCascadeBmc(profile, diagText()), ["partenaires", "activites", "valeur", "relations", "segments", "ressources", "canaux", "couts", "revenus"])],
      ["bp", fillBmcLike(promptCascadeBp(profile, diagText()), ["bp_executive", "bp_offer", "bp_market", "bp_commercial", "bp_financials", "bp_roadmap"])],
      ["cv", fillCv()],
      ["pricing", fillPricing()],
    ];
    await Promise.all(tasks.map(async ([k, pr]) => {
      try { const ok = await pr; setCascade((c) => ({ ...c, [k]: ok ? "done" : "error" })); }
      catch { setCascade((c) => ({ ...c, [k]: "error" })); }
    }));
  }

  const cascadeBusy = Object.values(cascade).some((s) => s === "loading");

  async function generate() {
    if (!q1.trim() || !q2.trim() || !q3.trim()) {
      setError("Merci de répondre aux 3 questions avant de générer le diagnostic.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const raw = await callAI({
        agent: "nova",
        messages: [{
          role: "user",
          content: `Tu es Nova, coach stratège pour indépendants suisse-romands.\n\nSITUATION ACTUELLE : ${q1}\nBLOCAGES IDENTIFIÉS : ${q2}\nVISION 12 MOIS : ${q3}\n\nGénère un diagnostic systémique en JSON strict (aucun texte avant ni après) :\n{"forces":["...","...","..."],"freins":["...","...","..."],"cap":"reformulation inspirante de la vision en 1 phrase percutante","actions":["action concrète cette semaine","action concrète cette semaine","action concrète cette semaine"]}`,
        }],
      });

      const parsed = parseDiag(raw.content);
      if (parsed) {
        setResult(parsed);
        setRawFallback(null);
      } else {
        setResult(null);
        setRawFallback(raw.content);
      }

      // Persist Q1 + Q3 to profile
      await updateProfile({ situation: q1 || null, profil: q3 || null });

      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur IA. Vérifiez que le proxy est déployé.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: 760 }}>
      {/* Header */}
      <div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 400, color: "var(--color-text-primary)", margin: 0 }}>
          Diagnostic systémique
        </h2>
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", marginTop: "var(--space-1)" }}>
          3 questions. Une vision claire de vos forces, freins et prochaines actions.
        </p>
      </div>

      {phase === "form" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          {/* Q1 */}
          <Card glass>
            <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)", marginBottom: "var(--space-1)" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", color: "rgba(197,165,114,0.25)", lineHeight: 1 }}>01</span>
              <p style={QLABEL}>Où en êtes-vous professionnellement aujourd'hui ?</p>
            </div>
            <p style={QHINT}>
              Décrivez votre situation concrète — activité, statut, revenus actuels, durée, ce qui fonctionne ou non.
            </p>
            <textarea
              value={q1}
              onChange={(e) => setQ1(e.target.value)}
              placeholder="Ex : Indépendante depuis 8 mois dans le coaching professionnel. J'ai quelques clients mais les revenus sont irréguliers. J'hésite sur mon positionnement…"
              style={TEXTAREA}
            />
          </Card>

          {/* Q2 */}
          <Card glass>
            <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)", marginBottom: "var(--space-1)" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", color: "rgba(197,165,114,0.25)", lineHeight: 1 }}>02</span>
              <p style={QLABEL}>Qu'est-ce qui vous retient d'avancer ?</p>
            </div>
            <p style={QHINT}>
              Obstacles réels ou perçus, peurs, manques de compétences, ressources, clarté, réseau, temps…
            </p>
            <textarea
              value={q2}
              onChange={(e) => setQ2(e.target.value)}
              placeholder="Ex : Je ne sais pas fixer mes tarifs. J'ai peur du rejet. Je manque de visibilité et je ne sais pas comment prospecter sans me sentir intrusive…"
              style={TEXTAREA}
            />
          </Card>

          {/* Q3 */}
          <Card glass>
            <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)", marginBottom: "var(--space-1)" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", color: "rgba(197,165,114,0.25)", lineHeight: 1 }}>03</span>
              <p style={QLABEL}>Où voulez-vous être dans 12 mois ?</p>
            </div>
            <p style={QHINT}>
              Soyez précis : revenus, nombre de clients, mode de travail, sentiment, liberté, impact souhaité.
            </p>
            <textarea
              value={q3}
              onChange={(e) => setQ3(e.target.value)}
              placeholder="Ex : Générer CHF 6 000/mois avec 8 clients fidèles, travailler 4 jours/semaine, avoir un positionnement clair et me sentir sereine dans ma démarche commerciale…"
              style={TEXTAREA}
            />
          </Card>

          {error && (
            <p style={{ fontSize: "var(--text-sm)", color: "var(--color-danger)", margin: 0 }}>{error}</p>
          )}

          <Button variant="gold" loading={loading} onClick={generate}>
            {loading ? "Analyse en cours…" : "Générer le diagnostic systémique"}
          </Button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          {/* Bouton retour */}
          <Button size="sm" variant="ghost" onClick={() => setPhase("form")} style={{ alignSelf: "flex-start" }}>
            ← Reprendre les questions
          </Button>

          {rawFallback ? (
            /* Fallback : réponse brute non-JSON */
            <Card glass>
              <p style={{ fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "var(--space-3)" }}>
                Analyse Nova
              </p>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: "var(--leading-normal)", whiteSpace: "pre-wrap" }}>
                {rawFallback}
              </p>
            </Card>
          ) : result ? (
            <>
              {/* Cap — vision reformulée */}
              <div style={{
                background: "linear-gradient(135deg, rgba(197,165,114,0.12), rgba(197,165,114,0.04))",
                border: "1px solid rgba(197,165,114,0.25)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-6)",
                textAlign: "center",
              }}>
                <p style={{ fontSize: "var(--text-xs)", fontWeight: 600, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-gold)", margin: "0 0 var(--space-3) 0" }}>
                  Votre cap
                </p>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", color: "var(--color-text-primary)", lineHeight: "var(--leading-normal)", margin: 0 }}>
                  {result.cap}
                </p>
              </div>

              {/* Forces + Freins */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
                <Card glass>
                  <p style={{ fontSize: "var(--text-xs)", fontWeight: 600, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-success)", margin: "0 0 var(--space-3) 0" }}>
                    Forces
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    {result.forces.map((f, i) => (
                      <div key={i} style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-sm)", color: "rgba(34,197,94,0.35)", lineHeight: "1.6", flexShrink: 0 }}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: "var(--leading-normal)" }}>
                          {f}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card glass>
                  <p style={{ fontSize: "var(--text-xs)", fontWeight: 600, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-danger)", margin: "0 0 var(--space-3) 0" }}>
                    Freins
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    {result.freins.map((f, i) => (
                      <div key={i} style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-sm)", color: "rgba(239,68,68,0.35)", lineHeight: "1.6", flexShrink: 0 }}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: "var(--leading-normal)" }}>
                          {f}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Actions prioritaires */}
              <Card glass>
                <p style={{ fontSize: "var(--text-xs)", fontWeight: 600, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-gold)", margin: "0 0 var(--space-4) 0" }}>
                  Actions prioritaires — cette semaine
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  {result.actions.map((a, i) => (
                    <div key={i} style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-start", padding: "var(--space-3)", background: "var(--color-bg-primary)", borderRadius: "var(--radius-sm)", border: "var(--border-subtle)" }}>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", color: "rgba(197,165,114,0.2)", lineHeight: 1, flexShrink: 0, paddingTop: 2 }}>
                        {i + 1}
                      </span>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)", lineHeight: "var(--leading-normal)", fontWeight: 500 }}>
                        {a}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : null}

          {/* Cascade — pré-remplissage des modules */}
          {(result || rawFallback) && (
            <Card glass>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                <div style={{ maxWidth: 460 }}>
                  <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-base)", color: "var(--color-text-primary)" }}>✦ Pré-remplir mes modules</p>
                  <p style={{ margin: "var(--space-1) 0 0", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                    À partir de ce diagnostic, je rédige un premier jet de ton <strong>BMC</strong>, ton <strong>Business Plan</strong>, ton <strong>CV</strong> et ton <strong>offre</strong>. Tu affines ensuite dans chaque module.
                  </p>
                </div>
                <Button variant="gold" loading={cascadeBusy} onClick={runCascade}>
                  {Object.values(cascade).some((s) => s === "done") ? "Relancer le pré-remplissage" : "Pré-remplir les 4 modules"}
                </Button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {CASCADE_META.map((m) => {
                  const st = cascade[m.key];
                  const icon = st === "done" ? "✓" : st === "loading" ? "⏳" : st === "error" ? "⚠" : "○";
                  const color = st === "done" ? "var(--color-success)" : st === "error" ? "var(--color-danger)" : st === "loading" ? "var(--color-gold)" : "var(--color-text-muted)";
                  return (
                    <div key={m.key} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", fontSize: "var(--text-sm)" }}>
                      <span style={{ color, width: 16, textAlign: "center" }}>{icon}</span>
                      <span style={{ color: "var(--color-text-secondary)", flex: 1 }}>{m.label}</span>
                      {st === "done" && <Link to={m.to} style={{ color: "var(--color-gold)", fontSize: "var(--text-xs)" }}>Ouvrir →</Link>}
                      {st === "error" && <span style={{ color: "var(--color-danger)", fontSize: "var(--text-xs)" }}>échec — réessayer</span>}
                    </div>
                  );
                })}
              </div>
              {!profile?.id && (
                <p style={{ fontSize: "var(--text-xs)", color: "var(--color-warning)", margin: "var(--space-3) 0 0" }}>
                  ⚠️ BMC et Business Plan nécessitent d'être connecté (profil chargé). CV et Offre fonctionnent hors-ligne.
                </p>
              )}
            </Card>
          )}

          {/* Régénérer */}
          <div style={{ display: "flex", gap: "var(--space-3)", paddingTop: "var(--space-2)" }}>
            <Button size="sm" variant="ghost" loading={loading} onClick={generate}>
              Régénérer l'analyse
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
