import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { AiResult } from "@/components/ui/AiResult";
import { useAiGen } from "@/lib/useAiGen";
import { promptMirrorFisch } from "@/lib/lancementPrompts";
import { loadLocal, saveLocal } from "@/lib/local";

// Extrait les KPI de la réaction simulée : « 24% » de conversion, « 67/100 » d'engagement.
function parseScores(text: string | null): { conv: number | null; eng: number | null } {
  if (!text) return { conv: null, eng: null };
  const engM = text.match(/(\d{1,3})\s*\/\s*100/);
  const eng = engM ? Math.min(100, Number(engM[1])) : null;
  // Pour la conversion, on prend le premier « N% » qui n'est pas le score /100.
  const convM = text.replace(/\d{1,3}\s*\/\s*100/g, "").match(/(\d{1,3})\s*%/);
  const conv = convM ? Math.min(100, Number(convM[1])) : null;
  return { conv, eng };
}

// Couleur selon paliers [bas, haut] : <bas = danger, <haut = gold, >=haut = success.
function scoreColor(value: number, [low, high]: [number, number]): string {
  if (value >= high) return "var(--color-success)";
  if (value >= low) return "var(--color-gold)";
  return "var(--color-danger)";
}

function ScoreBlock({ label, value, unit, thresholds }: {
  label: string; value: number | null; unit: string; thresholds: [number, number];
}) {
  const color = value != null ? scoreColor(value, thresholds) : "var(--color-text-muted)";
  return (
    <div style={{ background: "var(--color-bg-surface)", border: "var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "var(--space-5) var(--space-6)", boxShadow: "var(--shadow-sm)" }}>
      <span style={{ fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-1)", marginTop: "var(--space-2)" }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 400, color, lineHeight: 1 }}>
          {value != null ? value : "?"}
        </span>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>{unit}</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "var(--color-bg-input)", overflow: "hidden", marginTop: "var(--space-3)" }}>
        <div style={{ height: "100%", width: `${value ?? 0}%`, background: color, borderRadius: 999, transition: "width var(--transition-base)" }} />
      </div>
    </div>
  );
}

const PERSONAS = [
  "Cadre RH en reconversion (40 ans)",
  "Demandeur d'emploi ORP sceptique",
  "Dirigeant de PME pressé",
  "Indépendant débutant prudent",
  "Acheteur public / institutionnel",
];

const TA: React.CSSProperties = {
  width: "100%", minHeight: 100, marginTop: "var(--space-2)",
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

export function MirrorFisch() {
  const { loading, error, gen } = useAiGen();
  const [persona, setPersona] = useState(() => loadLocal("ns_mf_persona", PERSONAS[0]));
  const [message, setMessage] = useState(() => loadLocal("ns_mf_message", ""));
  const [result, setResult] = useState<string | null>(() => loadLocal<string | null>("ns_mf_result", null));
  const scores = useMemo(() => parseScores(result), [result]);

  async function simulate() {
    saveLocal("ns_mf_persona", persona);
    saveLocal("ns_mf_message", message);
    const r = await gen("communicant", promptMirrorFisch(persona, message));
    if (r) { setResult(r); saveLocal("ns_mf_result", r); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: 820 }}>
      <PageHeader title="MirrorFisch — Test d'audience" subtitle="Simulez la réaction d'un persona à votre message marketing : probabilité de conversion, engagement, ajustements." />

      <Card glass>
        <label style={LBL}>Persona cible</label>
        <select
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
          style={{ width: "100%", marginTop: "var(--space-2)", background: "var(--color-bg-input)", border: "var(--border-subtle)", borderRadius: "var(--radius-sm)", color: "var(--color-text-primary)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", padding: "var(--space-3) var(--space-4)", outline: "none" }}
        >
          {PERSONAS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <div style={{ marginTop: "var(--space-4)" }}>
          <label style={LBL}>Votre message marketing</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Collez ici votre post, accroche, email ou argumentaire…" style={TA} />
        </div>

        <div style={{ marginTop: "var(--space-4)" }}>
          <Button variant="gold" loading={loading} onClick={simulate} disabled={!message.trim()}>
            {result ? "Re-simuler" : "Simuler la réaction"}
          </Button>
        </div>
      </Card>

      {result && !loading && (scores.conv != null || scores.eng != null) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
          <ScoreBlock label="Probabilité de conversion" value={scores.conv} unit="%" thresholds={[25, 50]} />
          <ScoreBlock label="Score d'engagement" value={scores.eng} unit="/100" thresholds={[34, 67]} />
        </div>
      )}

      {(loading || error || result) && (
        <Card glass title="Réaction simulée">
          <AiResult content={result} loading={loading} error={error} />
        </Card>
      )}
    </div>
  );
}
