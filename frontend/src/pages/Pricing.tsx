import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { AiResult } from "@/components/ui/AiResult";
import { useUserStore } from "@/stores/useUserStore";
import { useAiGen, MODEL_REASONING } from "@/lib/useAiGen";
import { promptPricing } from "@/lib/lancementPrompts";
import { activitePreset } from "@/lib/activite";
import { loadLocal, saveLocal, projectKey } from "@/lib/local";
import type { Profile } from "@/types";

const TEXTAREA: React.CSSProperties = {
  width: "100%", minHeight: 110, marginTop: "var(--space-2)",
  background: "var(--color-bg-input)", border: "var(--border-subtle)",
  borderRadius: "var(--radius-sm)", color: "var(--color-text-primary)",
  fontFamily: "var(--font-body)", fontSize: "var(--text-sm)",
  lineHeight: "var(--leading-normal)", padding: "var(--space-3) var(--space-4)",
  resize: "vertical", outline: "none", boxSizing: "border-box",
};
const LBL: React.CSSProperties = {
  fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)",
  textTransform: "uppercase", color: "var(--color-text-muted)",
};
const NUM: React.CSSProperties = {
  width: "100%", marginTop: "var(--space-2)",
  background: "var(--color-bg-input)", border: "var(--border-subtle)",
  borderRadius: "var(--radius-sm)", color: "var(--color-text-primary)",
  fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)",
  padding: "var(--space-3) var(--space-4)", outline: "none", boxSizing: "border-box",
};

function chf(n: number): string {
  const r = Math.round(n);
  const s = Math.abs(r).toLocaleString("fr-CH").replace(/[\u00A0\u202F]/g, "’");
  return `${r < 0 ? "−" : ""}${s} CHF`;
}

// Calculateur de rentabilité — saisie persistée par abonné (jamais de chiffres en dur).
interface CalcState { tarif: string; clients: string; charges: string; materiel: string }
const MVP_STEPS = [
  "Définir UNE offre simple et concrète (ex. « séance découverte »)",
  "Identifier 2–3 clients pilotes dans votre réseau",
  "Livrer la prestation et collecter un témoignage écrit",
  "Mesurer : le client a-t-il obtenu un résultat concret ?",
  "Ajuster l'offre et fixer le prix définitif",
];

const PRICING_KEYS = ["ns_pricing_offre", "ns_pricing_result", "ns_pricing_calc", "ns_pricing_mvp"] as const;

// Reprend les anciennes données globales (pré-scoping projet) pour le premier
// projet qui charge ce module après le correctif, puis les efface — sans ça
// tout nouveau projet hériterait sinon des données du dernier projet actif.
function migrateLegacyPricing(projectId: string) {
  if (localStorage.getItem(projectKey("ns_pricing_offre", projectId)) != null) return;
  if (localStorage.getItem("ns_pricing_offre") == null) return;
  for (const base of PRICING_KEYS) {
    const v = localStorage.getItem(base);
    if (v != null) localStorage.setItem(projectKey(base, projectId), v);
  }
  PRICING_KEYS.forEach((k) => localStorage.removeItem(k));
}

function loadPricing(projectId: string | null | undefined, profile: Profile | null | undefined) {
  return {
    offre: loadLocal(projectKey("ns_pricing_offre", projectId), profile?.domaine ?? ""),
    result: loadLocal<string | null>(projectKey("ns_pricing_result", projectId), null),
    calc: loadLocal<CalcState>(projectKey("ns_pricing_calc", projectId), {
      tarif: profile?.pricing_tarif ? String(profile.pricing_tarif) : "",
      clients: profile?.pricing_clients ? String(profile.pricing_clients) : "",
      charges: profile?.charges_fixes ? String(profile.charges_fixes) : "",
      materiel: "",
    }),
    mvp: loadLocal<boolean[]>(projectKey("ns_pricing_mvp", projectId), MVP_STEPS.map(() => false)),
  };
}

export function Pricing() {
  const profile = useUserStore((s) => s.profile);
  const projectId = profile?.id ?? null;
  const preset = activitePreset(profile);
  const { loading, error, gen } = useAiGen();

  useEffect(() => { if (projectId) migrateLegacyPricing(projectId); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [offre, setOffre] = useState(() => loadPricing(projectId, profile).offre);
  const [result, setResult] = useState<string | null>(() => loadPricing(projectId, profile).result);
  const [calc, setCalc] = useState<CalcState>(() => loadPricing(projectId, profile).calc);
  const [mvp, setMvp] = useState<boolean[]>(() => loadPricing(projectId, profile).mvp);
  const prevProjectId = useRef(projectId);

  // Changement de projet actif (sélecteur, sans démonter la page) : recharge
  // les données propres à ce projet au lieu de garder celles affichées à l'écran.
  useEffect(() => {
    if (prevProjectId.current === projectId) return;
    prevProjectId.current = projectId;
    if (!projectId) return;
    const d = loadPricing(projectId, profile);
    setOffre(d.offre); setResult(d.result); setCalc(d.calc); setMvp(d.mvp);
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  function patchCalc(p: Partial<CalcState>) {
    const next = { ...calc, ...p };
    setCalc(next);
    saveLocal(projectKey("ns_pricing_calc", projectId), next);
  }
  function toggleMvp(i: number) {
    const next = mvp.map((v, j) => (j === i ? !v : v));
    setMvp(next);
    saveLocal(projectKey("ns_pricing_mvp", projectId), next);
  }

  const tarif = Number(calc.tarif) || 0;
  const clients = Number(calc.clients) || 0;
  const charges = Number(calc.charges) || 0;
  const materiel = preset.hasMateriel ? Number(calc.materiel) || 0 : 0;
  const ca = tarif * clients;
  const avs = ca * 0.1; // AVS/AI/APG ~10% pour indépendant
  const net = ca - materiel - charges - avs;
  const breakeven = tarif > 0 ? Math.ceil(charges / tarif) : 0;
  const hasCalc = tarif > 0 && clients > 0;

  async function generate() {
    saveLocal(projectKey("ns_pricing_offre", projectId), offre);
    const r = await gen("financier", promptPricing(profile, offre), { model: MODEL_REASONING });
    if (r) { setResult(r); saveLocal(projectKey("ns_pricing_result", projectId), r); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: 820 }}>
      <PageHeader title="Offre & Pricing" subtitle="Packagez votre offre, calculez votre seuil de rentabilité et fixez vos prix — TVA suisse et seuil 100'000 CHF." />

      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start", padding: "var(--space-4)", background: "var(--color-bg-glass)", border: "var(--border-subtle)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
        <span style={{ color: "var(--color-info)" }}>ⓘ</span>
        <span><strong style={{ color: "var(--color-text-primary)" }}>TVA :</strong> en Suisse, l'assujettissement TVA devient obligatoire au-delà de 100'000 CHF de chiffre d'affaires annuel (taux normal 8.1 %). En dessous, vous en êtes exempté — surveillez le seuil à l'approche.</span>
      </div>

      {/* Calculateur de rentabilité */}
      <Card glass title="Calculateur de rentabilité">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-6)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div><label style={LBL}>Tarif moyen par {preset.unite} (CHF)</label>
              <input type="number" inputMode="numeric" value={calc.tarif} onChange={(e) => patchCalc({ tarif: e.target.value })} placeholder="0" style={NUM} /></div>
            <div><label style={LBL}>{preset.volumeLabel}</label>
              <input type="number" inputMode="numeric" value={calc.clients} onChange={(e) => patchCalc({ clients: e.target.value })} placeholder="0" style={NUM} /></div>
            {preset.hasMateriel && (
              <div><label style={LBL}>Coût matériel / marchandises (CHF)</label>
                <input type="number" inputMode="numeric" value={calc.materiel} onChange={(e) => patchCalc({ materiel: e.target.value })} placeholder="0" style={NUM} /></div>
            )}
            <div><label style={LBL}>Charges fixes mensuelles (CHF)</label>
              <input type="number" inputMode="numeric" value={calc.charges} onChange={(e) => patchCalc({ charges: e.target.value })} placeholder="0" style={NUM} /></div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", background: "var(--color-bg-surface)", border: "var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "var(--space-4)" }}>
            {!hasCalc ? (
              <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: "auto 0" }}>
                Renseignez votre tarif et le nombre de clients visés pour estimer votre revenu net mensuel.
              </p>
            ) : (
              <>
                <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--color-text-primary)", marginBottom: "var(--space-2)" }}>Résultat mensuel estimé</div>
                <Line label="CA brut" value={chf(ca)} />
                {preset.hasMateriel && <Line label="Matériel / marchandises" value={`−${chf(materiel).replace("−", "")}`} color="var(--color-danger)" />}
                {preset.hasMateriel && <Line label="Marge brute" value={chf(ca - materiel)} />}
                <Line label="Charges fixes" value={`−${chf(charges).replace("−", "")}`} color="var(--color-danger)" />
                <Line label="AVS/AI/APG (~10 %)" value={`−${chf(avs).replace("−", "")}`} color="var(--color-warning)" />
                <div style={{ height: 1, background: "var(--border-subtle)", margin: "var(--space-2) 0" }} />
                <Line label="Revenu net estimé" value={chf(net)} color={net > 0 ? "var(--color-success)" : "var(--color-danger)"} bold />
                <p style={{ fontSize: "var(--text-xs)", color: net > 0 ? "var(--color-success)" : "var(--color-warning)", margin: "var(--space-2) 0 0 0", lineHeight: "var(--leading-normal)" }}>
                  {net > 0
                    ? `Rentable avec ${clients} ${preset.unite}(s)/mois.`
                    : "Déficitaire — augmentez le tarif ou réduisez les charges."}
                  {charges > 0 && tarif > 0 && ` Seuil d'équilibre : ${breakeven} ${preset.unite}(s)/mois.`}
                </p>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* MVP — prototype d'offre testable */}
      <Card glass title="MVP — prototype d'offre testable">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-6)" }}>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: "var(--leading-relaxed)" }}>
            <p style={{ marginTop: 0 }}>Avant de figer vos prix, validez l'offre sur le terrain avec un service minimal mais réel, livré à 2–3 clients pilotes en échange d'un retour honnête.</p>
            <p style={{ marginBottom: 0 }}>
              <strong style={{ color: "var(--color-text-primary)" }}>Horaire</strong> : simple, mais plafonne vos revenus.<br />
              <strong style={{ color: "var(--color-text-primary)" }}>Forfait</strong> : prévisible pour le client, meilleure rentabilité.<br />
              <strong style={{ color: "var(--color-text-primary)" }}>Value-based</strong> : vous facturez la valeur générée, pas le temps.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div style={LBL}>Checklist MVP</div>
            {MVP_STEPS.map((step, i) => (
              <label key={i} style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: mvp[i] ? "var(--color-text-muted)" : "var(--color-text-secondary)", cursor: "pointer", textDecoration: mvp[i] ? "line-through" : "none" }}>
                <input type="checkbox" checked={mvp[i]} onChange={() => toggleMvp(i)} style={{ marginTop: 3, accentColor: "var(--color-gold)" }} />
                <span>{step}</span>
              </label>
            ))}
          </div>
        </div>
      </Card>

      {/* Grille tarifaire IA */}
      <Card glass title="Grille tarifaire IA">
        <label style={LBL}>Décrivez votre offre</label>
        <textarea value={offre} onChange={(e) => setOffre(e.target.value)} placeholder="Ex : parcours d'accompagnement en 8 séances individuelles, sur 3 mois…" style={TEXTAREA} />
        <div style={{ marginTop: "var(--space-4)" }}>
          <Button variant="gold" loading={loading} onClick={generate} disabled={!offre.trim()}>
            {result ? "Régénérer la grille tarifaire" : "Proposer une grille tarifaire"}
          </Button>
        </div>
      </Card>

      {(loading || error || result) && (
        <Card glass title="Grille tarifaire recommandée">
          <AiResult content={result} loading={loading} error={error} />
        </Card>
      )}
    </div>
  );
}

function Line({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-sm)", color: color ?? "var(--color-text-secondary)" }}>
      <span>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontWeight: bold ? 700 : 500 }}>{value}</span>
    </div>
  );
}
