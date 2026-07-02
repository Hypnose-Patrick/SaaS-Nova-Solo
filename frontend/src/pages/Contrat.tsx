import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { AiResult } from "@/components/ui/AiResult";
import { useUserStore } from "@/stores/useUserStore";
import { useAiGen, MODEL_REASONING } from "@/lib/useAiGen";
import { promptContrat } from "@/lib/lancementPrompts";
import { loadLocal, saveLocal } from "@/lib/local";
import { printHtml, downloadWord } from "@/lib/exportDoc";
import { ExportGate } from "@/components/ExportGate";

const TYPES = ["Prestation de services", "Mandat de conseil", "Formation / atelier", "Prestation de services récurrente", "Contrat d'entreprise / chantier (art. 363 CO)"];
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function Contrat() {
  const profile = useUserStore((s) => s.profile);
  const { loading, error, gen } = useAiGen();
  const [type, setType] = useState(() => loadLocal("ns_contrat_type", TYPES[0]));
  const [duree, setDuree] = useState(() => loadLocal("ns_contrat_duree", DUREES[0]));
  const [result, setResult] = useState<string | null>(() => loadLocal<string | null>("ns_contrat_result", null));

  const [copied, setCopied] = useState(false);

  async function generate() {
    saveLocal("ns_contrat_type", type);
    saveLocal("ns_contrat_duree", duree);
    const r = await gen("juriste", promptContrat(profile, type, duree), { model: MODEL_REASONING });
    if (r) { setResult(r); saveLocal("ns_contrat_result", r); }
  }

  const fileBase = `contrat_${type.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

  function buildDocHtml(): string {
    const heading = profile?.brand_name || profile?.name || "Contrat de prestation";
    return (
      `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(fileBase)}</title>` +
      `<style>body{font-family:Calibri,Arial,sans-serif;max-width:760px;margin:32px auto;padding:0 24px;color:#1a1a1a;line-height:1.6;font-size:13px}` +
      `h1{font-size:18px;text-align:center;margin:0 0 4px}.meta{text-align:center;color:#555;font-size:12px;margin-bottom:24px}` +
      `pre{white-space:pre-wrap;font-family:inherit;font-size:13px;margin:0}</style></head><body>` +
      `<h1>${escapeHtml(heading)}</h1>` +
      `<div class="meta">${escapeHtml(type)} · ${escapeHtml(duree)}</div>` +
      `<pre>${escapeHtml(result || "")}</pre></body></html>`
    );
  }

  function exportPdf() { if (result) printHtml(buildDocHtml()); }
  function exportWord() { if (result) downloadWord(fileBase, buildDocHtml()); }

  function downloadTxt() {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([result], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileBase}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyText() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* presse-papier indisponible */ }
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
        <Card
          glass
          title="Contrat (modèle indicatif)"
          action={result && !loading ? (
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button size="sm" variant="ghost" onClick={copyText}>{copied ? "Copié ✓" : "Copier"}</Button>
              <Button size="sm" variant="ghost" onClick={downloadTxt}>.txt</Button>
              <ExportGate>
                <Button size="sm" variant="ghost" onClick={exportWord}>Word</Button>
                <Button size="sm" variant="gold" onClick={exportPdf}>Imprimer / PDF</Button>
              </ExportGate>
            </div>
          ) : undefined}
        >
          <AiResult content={result} loading={loading} error={error} />
        </Card>
      )}
    </div>
  );
}

