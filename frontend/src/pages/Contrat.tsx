import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { AiResult } from "@/components/ui/AiResult";
import { useUserStore } from "@/stores/useUserStore";
import { useAiGen, MODEL_REASONING } from "@/lib/useAiGen";
import { promptContrat } from "@/lib/lancementPrompts";
import { loadLocal, saveLocal, projectKey } from "@/lib/local";
import { printHtml, downloadWord } from "@/lib/exportDoc";
import { ExportGate } from "@/components/ExportGate";
import { useSubscription } from "@/lib/useSubscription";

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

const CONTRAT_KEYS = ["ns_contrat_type", "ns_contrat_duree", "ns_contrat_result"] as const;

// Reprend les anciennes données globales (pré-scoping projet) pour le premier
// projet qui charge ce module après le correctif, puis les efface — sans ça
// tout nouveau projet hériterait sinon du contrat du dernier projet actif.
function migrateLegacyContrat(projectId: string) {
  if (localStorage.getItem(projectKey("ns_contrat_type", projectId)) != null) return;
  if (localStorage.getItem("ns_contrat_type") == null) return;
  for (const base of CONTRAT_KEYS) {
    const v = localStorage.getItem(base);
    if (v != null) localStorage.setItem(projectKey(base, projectId), v);
  }
  CONTRAT_KEYS.forEach((k) => localStorage.removeItem(k));
}

function loadContrat(projectId: string | null | undefined) {
  return {
    type: loadLocal<string>(projectKey("ns_contrat_type", projectId), TYPES[0]),
    duree: loadLocal<string>(projectKey("ns_contrat_duree", projectId), DUREES[0]),
    result: loadLocal<string | null>(projectKey("ns_contrat_result", projectId), null),
  };
}

export function Contrat() {
  const profile = useUserStore((s) => s.profile);
  const projectId = profile?.id ?? null;
  const { loading, error, gen } = useAiGen();
  const { canExport } = useSubscription();

  useEffect(() => { if (projectId) migrateLegacyContrat(projectId); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [type, setType] = useState(() => loadContrat(projectId).type);
  const [duree, setDuree] = useState(() => loadContrat(projectId).duree);
  const [result, setResult] = useState<string | null>(() => loadContrat(projectId).result);

  const [copied, setCopied] = useState(false);
  const prevProjectId = useRef(projectId);

  // Changement de projet actif (sélecteur, sans démonter la page) : recharge
  // le contrat propre à ce projet au lieu de garder celui affiché à l'écran.
  useEffect(() => {
    if (prevProjectId.current === projectId) return;
    prevProjectId.current = projectId;
    if (!projectId) return;
    const d = loadContrat(projectId);
    setType(d.type); setDuree(d.duree); setResult(d.result);
  }, [projectId]);

  async function generate() {
    saveLocal(projectKey("ns_contrat_type", projectId), type);
    saveLocal(projectKey("ns_contrat_duree", projectId), duree);
    const r = await gen("juriste", promptContrat(profile, type, duree), { model: MODEL_REASONING });
    if (r) { setResult(r); saveLocal(projectKey("ns_contrat_result", projectId), r); }
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
    if (!result || !canExport) return;
    const url = URL.createObjectURL(new Blob([result], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileBase}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyText() {
    if (!result || !canExport) return;
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
              <ExportGate previewHtml={buildDocHtml}>
                <Button size="sm" variant="ghost" onClick={copyText}>{copied ? "Copié ✓" : "Copier"}</Button>
                <Button size="sm" variant="ghost" onClick={downloadTxt}>.txt</Button>
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

