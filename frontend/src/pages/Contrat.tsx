import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { AiResult } from "@/components/ui/AiResult";
import { useUserStore } from "@/stores/useUserStore";
import { useAiGen, MODEL_REASONING } from "@/lib/useAiGen";
import { promptContrat } from "@/lib/lancementPrompts";
import { loadLocal, saveLocal } from "@/lib/local";

const TYPES = ["Prestation de coaching", "Mandat de conseil", "Formation / atelier", "Prestation de services récurrente"];
const DUREES = ["Ponctuel (one-shot)", "3 mois", "6 mois", "12 mois reconductible"];

const SEL: React.CSSProperties = {
  width: "100%", marginTop: "var(--space-2)", background: "var(--color-bg-input)",
  border: "var(--border-subtle)", borderRadius: "var(--radius-sm)", color: "var(--color-text-primary)",
  fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", padding: "var(--space-3) var(--space-4)", outline: "none",
};
const LBL: React.CSSProperties = {
  fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)",
  textTransform: "uppercase", color: "var(--color-text-muted)",
};

export function Contrat() {
  const profile = useUserStore((s) => s.profile);
  const { loading, error, gen } = useAiGen();
  const [type, setType] = useState(() => loadLocal("ns_contrat_type", TYPES[0]));
  const [duree, setDuree] = useState(() => loadLocal("ns_contrat_duree", DUREES[0]));
  const [result, setResult] = useState<string | null>(() => loadLocal<string | null>("ns_contrat_result", null));

  async function generate() {
    saveLocal("ns_contrat_type", type);
    saveLocal("ns_contrat_duree", duree);
    const r = await gen("juriste", promptContrat(profile, type, duree), { model: MODEL_REASONING });
    if (r) { setResult(r); saveLocal("ns_contrat_result", r); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: 820 }}>
      <PageHeader title="Contrat de prestation" subtitle="Modèle de contrat ancré dans le droit suisse des obligations (CO). À faire valider par un avocat." />

      <Card glass>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
          <div>
            <label style={LBL}>Type de prestation</label>
            <select value={type} onChange={(e) => setType(e.target.value)} style={SEL}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={LBL}>Durée</label>
            <select value={duree} onChange={(e) => setDuree(e.target.value)} style={SEL}>
              {DUREES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: "var(--space-4)" }}>
          <Button variant="gold" loading={loading} onClick={generate}>
            {result ? "Régénérer le contrat" : "Générer le contrat"}
          </Button>
        </div>
      </Card>

      {(loading || error || result) && (
        <Card glass title="Contrat (modèle indicatif)">
          <AiResult content={result} loading={loading} error={error} />
        </Card>
      )}
    </div>
  );
}
