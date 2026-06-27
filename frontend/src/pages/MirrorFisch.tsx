import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { AiResult } from "@/components/ui/AiResult";
import { useAiGen } from "@/lib/useAiGen";
import { promptMirrorFisch } from "@/lib/lancementPrompts";
import { loadLocal, saveLocal } from "@/lib/local";

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

      {(loading || error || result) && (
        <Card glass title="Réaction simulée">
          <AiResult content={result} loading={loading} error={error} />
        </Card>
      )}
    </div>
  );
}
