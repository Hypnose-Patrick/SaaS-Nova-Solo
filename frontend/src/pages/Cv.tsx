import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { AiResult } from "@/components/ui/AiResult";
import { useUserStore } from "@/stores/useUserStore";
import { useAiGen, MODEL_REASONING } from "@/lib/useAiGen";
import { promptCvGenerate, promptCvImprove } from "@/lib/lancementPrompts";
import { loadLocal, saveLocal } from "@/lib/local";

const TA: React.CSSProperties = {
  width: "100%", minHeight: 72, marginTop: "var(--space-2)",
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

interface CvFields { profil: string; skills: string; exp: string; formation: string; langues: string }

export function Cv() {
  const profile = useUserStore((s) => s.profile);
  const { loading, error, gen } = useAiGen();
  const [f, setF] = useState<CvFields>(() => loadLocal<CvFields>("ns_cv_fields", {
    profil: profile?.situation ?? "", skills: "", exp: "", formation: "",
    langues: "Français (langue maternelle), Anglais (B2), Allemand (B1)",
  }));
  const [cv, setCv] = useState<string | null>(() => loadLocal<string | null>("ns_cv_result", null));
  const [improving, setImproving] = useState(false);

  function patch(p: Partial<CvFields>) {
    const next = { ...f, ...p };
    setF(next);
    saveLocal("ns_cv_fields", next);
  }

  async function generate() {
    const r = await gen("communicant", promptCvGenerate(profile, f), { model: MODEL_REASONING });
    if (r) { setCv(r); saveLocal("ns_cv_result", r); }
  }

  async function improveProfil() {
    setImproving(true);
    const r = await gen("communicant", promptCvImprove(profile, "profil de CV", f.profil));
    setImproving(false);
    if (r) patch({ profil: r });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: 820 }}>
      <PageHeader title="CV Personnalisé" subtitle="CV optimisé ATS, verbes d'action, structure CAR, résultats chiffrés (fr-CH)." />

      <Card glass>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={LBL}>Profil / accroche</label>
              <Button size="sm" variant="ghost" loading={improving} onClick={improveProfil} disabled={!f.profil.trim()}>
                Améliorer
              </Button>
            </div>
            <textarea value={f.profil} onChange={(e) => patch({ profil: e.target.value })} style={TA} />
          </div>
          <div><label style={LBL}>Compétences clés</label>
            <textarea value={f.skills} onChange={(e) => patch({ skills: e.target.value })} placeholder="Gestion de projet, conduite du changement, recrutement…" style={TA} /></div>
          <div><label style={LBL}>Expériences</label>
            <textarea value={f.exp} onChange={(e) => patch({ exp: e.target.value })} placeholder="Cheffe de projet RH, Elca SA (2018-2026)…" style={TA} /></div>
          <div><label style={LBL}>Formation</label>
            <textarea value={f.formation} onChange={(e) => patch({ formation: e.target.value })} placeholder="Master RH, Université de Lausanne…" style={TA} /></div>
          <div><label style={LBL}>Langues</label>
            <textarea value={f.langues} onChange={(e) => patch({ langues: e.target.value })} style={{ ...TA, minHeight: 48 }} /></div>
        </div>
        <div style={{ marginTop: "var(--space-4)" }}>
          <Button variant="gold" loading={loading && !improving} onClick={generate}>
            {cv ? "Régénérer le CV" : "Générer le CV complet"}
          </Button>
        </div>
      </Card>

      {(loading || error || cv) && (
        <Card glass title="CV généré">
          <AiResult content={cv} loading={loading && !improving} error={error} />
        </Card>
      )}
    </div>
  );
}
