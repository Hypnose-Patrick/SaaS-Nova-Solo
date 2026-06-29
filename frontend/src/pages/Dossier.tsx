import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { AiResult } from "@/components/ui/AiResult";
import { useUserStore } from "@/stores/useUserStore";
import { useAppStore } from "@/stores/useAppStore";
import { useAiGen, MODEL_REASONING } from "@/lib/useAiGen";
import { promptDossier, DOSSIER_TEMPLATES, type DossierTemplate, type DossierRecipient } from "@/lib/lancementPrompts";
import { loadLocal, saveLocal } from "@/lib/local";
import { printHtml, downloadWord, slugify } from "@/lib/exportDoc";
import { ExportGate } from "@/components/ExportGate";

const LBL: React.CSSProperties = {
  fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)",
  textTransform: "uppercase", color: "var(--color-text-muted)",
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function Dossier() {
  const profile = useUserStore((s) => s.profile);
  const { bmc, fetchBmc } = useAppStore();
  const { loading, error, gen } = useAiGen();
  const [dossier, setDossier] = useState<string | null>(() => loadLocal<string | null>("ns_dossier_result", null));
  const [template, setTemplate] = useState<DossierTemplate>(() => loadLocal<DossierTemplate>("ns_dossier_template", "client"));
  const [recip, setRecip] = useState<DossierRecipient>(() => loadLocal<DossierRecipient>("ns_dossier_recip", { nom: "", fonction: "", org: "" }));

  useEffect(() => {
    if (profile?.id) fetchBmc(profile.id);
  }, [profile?.id]);

  function pickTemplate(t: DossierTemplate) {
    setTemplate(t);
    saveLocal("ns_dossier_template", t);
  }
  function patchRecip(p: Partial<DossierRecipient>) {
    const next = { ...recip, ...p };
    setRecip(next);
    saveLocal("ns_dossier_recip", next);
  }

  const bmcResume = bmc.filter((b) => b.content).map((b) => `${b.block_key} : ${b.content}`).join("\n") || "—";
  const pricing = loadLocal<string | null>("ns_pricing_result", null) ?? "—";
  const tplLabel = DOSSIER_TEMPLATES.find((t) => t.key === template)?.label ?? "Dossier";

  async function generate() {
    const r = await gen("communicant", promptDossier(profile, bmcResume, pricing, template, recip), { model: MODEL_REASONING });
    if (r) { setDossier(r); saveLocal("ns_dossier_result", r); }
  }

  function buildDocHtml(): string {
    const title = profile?.brand_name || tplLabel;
    const recipLine = [recip.nom, recip.fonction, recip.org].filter(Boolean).join(" · ");
    return (
      `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
      `<style>body{font-family:Georgia,'Times New Roman',serif;max-width:720px;margin:40px auto;padding:0 24px;color:#1a1a1a;line-height:1.6;white-space:pre-wrap}h1{font-size:24px;margin-bottom:4px}.sub{color:#777;margin-bottom:6px}.recip{color:#555;font-size:13px;margin-bottom:28px}@media print{body{margin:0}}</style>` +
      `</head><body><h1>${escapeHtml(title)}</h1><div class="sub">${escapeHtml(profile?.name ?? "")}${profile?.ville ? " · " + escapeHtml(profile.ville) : ""} — ${escapeHtml(tplLabel)}</div>` +
      (recipLine ? `<div class="recip">À l'attention de : ${escapeHtml(recipLine)}</div>` : "") +
      `${escapeHtml(dossier || "")}</body></html>`
    );
  }

  function exportPdf() { if (dossier) printHtml(buildDocHtml()); }
  function exportWord() { if (dossier) downloadWord(`dossier-${slugify(tplLabel)}`, buildDocHtml()); }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: 820 }}>
      <PageHeader title="Dossier de présentation" subtitle="Dossier structuré 4MAT + neuromarketing (AIDA · Cialdini), adapté à votre cible — à partir de votre BMC et de votre pricing. Exportable en PDF." />

      <Card glass title="Cible du dossier">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
          {DOSSIER_TEMPLATES.map((t) => {
            const on = template === t.key;
            return (
              <label key={t.key} onClick={() => pickTemplate(t.key)} style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", padding: "var(--space-3) var(--space-4)", border: on ? "var(--border-gold)" : "var(--border-subtle)", borderRadius: "var(--radius-sm)", cursor: "pointer", background: on ? "var(--color-bg-glass)" : "transparent" }}>
                <input type="radio" name="dossier-tpl" checked={on} onChange={() => pickTemplate(t.key)} style={{ marginTop: 3, accentColor: "var(--color-gold)" }} />
                <span>
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text-primary)" }}>{t.label}</span>
                  <span style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: 2 }}>{t.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </Card>

      <Card glass title="Destinataire (optionnel)">
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", margin: "0 0 var(--space-4) 0" }}>
          Personnalise la page de couverture du dossier.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)" }}>
          <Input label="Nom" value={recip.nom} onChange={(e) => patchRecip({ nom: e.target.value })} placeholder="Ex. Marie Dupont" />
          <Input label="Fonction" value={recip.fonction} onChange={(e) => patchRecip({ fonction: e.target.value })} placeholder="Ex. Directrice financement" />
          <Input label="Organisation" value={recip.org} onChange={(e) => patchRecip({ org: e.target.value })} placeholder="Ex. Banque, ORP…" />
        </div>
      </Card>

      <Card glass>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", margin: "0 0 var(--space-4) 0" }}>
          S'appuie sur votre Business Model Canvas{bmc.some((b) => b.content) ? " ✓" : " (à remplir)"} et votre Offre & Pricing.
        </p>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <Button variant="gold" loading={loading} onClick={generate}>
            {dossier ? "Régénérer le dossier" : `Générer — ${tplLabel}`}
          </Button>
          {dossier && (
            <ExportGate>
              <Button variant="ghost" onClick={exportWord}>Word</Button>
              <Button variant="ghost" onClick={exportPdf}>Exporter en PDF</Button>
            </ExportGate>
          )}
        </div>
      </Card>

      {(loading || error || dossier) && (
        <Card glass title={`Dossier — ${tplLabel}`}>
          <AiResult content={dossier} loading={loading} error={error} />
        </Card>
      )}
    </div>
  );
}

