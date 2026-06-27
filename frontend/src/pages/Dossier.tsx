import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { AiResult } from "@/components/ui/AiResult";
import { useUserStore } from "@/stores/useUserStore";
import { useAppStore } from "@/stores/useAppStore";
import { useAiGen, MODEL_REASONING } from "@/lib/useAiGen";
import { promptDossier } from "@/lib/lancementPrompts";
import { loadLocal, saveLocal } from "@/lib/local";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function Dossier() {
  const profile = useUserStore((s) => s.profile);
  const { bmc, fetchBmc } = useAppStore();
  const { loading, error, gen } = useAiGen();
  const [dossier, setDossier] = useState<string | null>(() => loadLocal<string | null>("ns_dossier_result", null));

  useEffect(() => {
    if (profile?.id) fetchBmc(profile.id);
  }, [profile?.id]);

  const bmcResume = bmc.filter((b) => b.content).map((b) => `${b.block_key} : ${b.content}`).join("\n") || "—";
  const pricing = loadLocal<string | null>("ns_pricing_result", null) ?? "—";

  async function generate() {
    const r = await gen("communicant", promptDossier(profile, bmcResume, pricing), { model: MODEL_REASONING });
    if (r) { setDossier(r); saveLocal("ns_dossier_result", r); }
  }

  function exportPdf() {
    if (!dossier) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const title = profile?.brand_name || "Dossier de présentation";
    w.document.write(
      `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
      `<style>body{font-family:Georgia,'Times New Roman',serif;max-width:720px;margin:40px auto;padding:0 24px;color:#1a1a1a;line-height:1.6;white-space:pre-wrap}h1{font-size:24px;margin-bottom:4px}.sub{color:#777;margin-bottom:28px}@media print{body{margin:0}}</style>` +
      `</head><body><h1>${escapeHtml(title)}</h1><div class="sub">${escapeHtml(profile?.name ?? "")}${profile?.ville ? " · " + escapeHtml(profile.ville) : ""}</div>${escapeHtml(dossier)}</body></html>`,
    );
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: 820 }}>
      <PageHeader title="Dossier de présentation" subtitle="Dossier commercial structuré 4MAT + neuromarketing, à partir de votre BMC et de votre pricing. Exportable en PDF." />

      <Card glass>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", margin: "0 0 var(--space-4) 0" }}>
          S'appuie sur votre Business Model Canvas{bmc.some((b) => b.content) ? " ✓" : " (à remplir)"} et votre Offre & Pricing.
        </p>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <Button variant="gold" loading={loading} onClick={generate}>
            {dossier ? "Régénérer le dossier" : "Générer le dossier"}
          </Button>
          {dossier && <Button variant="ghost" onClick={exportPdf}>Exporter en PDF</Button>}
        </div>
      </Card>

      {(loading || error || dossier) && (
        <Card glass title="Dossier de présentation">
          <AiResult content={dossier} loading={loading} error={error} />
        </Card>
      )}
    </div>
  );
}
