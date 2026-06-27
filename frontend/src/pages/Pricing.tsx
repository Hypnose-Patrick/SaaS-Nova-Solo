import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { AiResult } from "@/components/ui/AiResult";
import { useUserStore } from "@/stores/useUserStore";
import { useAiGen, MODEL_REASONING } from "@/lib/useAiGen";
import { promptPricing } from "@/lib/lancementPrompts";
import { loadLocal, saveLocal } from "@/lib/local";

const TEXTAREA: React.CSSProperties = {
  width: "100%", minHeight: 110, marginTop: "var(--space-2)",
  background: "var(--color-bg-input)", border: "var(--border-subtle)",
  borderRadius: "var(--radius-sm)", color: "var(--color-text-primary)",
  fontFamily: "var(--font-body)", fontSize: "var(--text-sm)",
  lineHeight: "var(--leading-normal)", padding: "var(--space-3) var(--space-4)",
  resize: "vertical", outline: "none", boxSizing: "border-box",
};

export function Pricing() {
  const profile = useUserStore((s) => s.profile);
  const { loading, error, gen } = useAiGen();
  const [offre, setOffre] = useState(() => loadLocal("ns_pricing_offre", profile?.domaine ?? ""));
  const [result, setResult] = useState<string | null>(() => loadLocal<string | null>("ns_pricing_result", null));

  async function generate() {
    saveLocal("ns_pricing_offre", offre);
    const r = await gen("financier", promptPricing(profile, offre), { model: MODEL_REASONING });
    if (r) { setResult(r); saveLocal("ns_pricing_result", r); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: 820 }}>
      <PageHeader title="Offre & Pricing" subtitle="Packagez votre offre et fixez vos prix — paliers, valeur perçue, TVA suisse et seuil 100'000 CHF." />

      <Card glass>
        <label style={{ fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
          Décrivez votre offre
        </label>
        <textarea value={offre} onChange={(e) => setOffre(e.target.value)} placeholder="Ex : parcours de coaching reconversion en 8 séances individuelles…" style={TEXTAREA} />
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
