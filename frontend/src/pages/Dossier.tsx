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
import { fillTemplate } from "@/lib/fillTemplate";
import { ExportGate } from "@/components/ExportGate";
import dossierTemplateHtml from "@/lib/templates/dossier.html?raw";

const LBL: React.CSSProperties = {
  fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)",
  textTransform: "uppercase", color: "var(--color-text-muted)",
};

function mdToHtml(raw: string): string {
  const bold = (s: string) =>
    s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/_(.+?)_/g, "<em>$1</em>");
  const lines = raw.split("\n");
  let html = "", para: string[] = [], inList = false;
  const flushPara = () => { if (para.length) { html += "<p>" + para.map(bold).join("<br>") + "</p>"; para = []; } };
  const flushList = () => { if (inList) { html += "</ul>"; inList = false; } };
  for (const raw_line of lines) {
    const l = raw_line.replace(/\r$/, "").trimEnd();
    if      (l.startsWith("### ")) { flushPara(); flushList(); html += "<h3>" + bold(l.slice(4)) + "</h3>"; }
    else if (l.startsWith("## "))  { flushPara(); flushList(); html += "<h2>" + bold(l.slice(3)) + "</h2>"; }
    else if (l.startsWith("# "))   { flushPara(); flushList(); html += "<h1>" + bold(l.slice(2)) + "</h1>"; }
    else if (l.startsWith("> "))   { flushPara(); flushList(); html += "<blockquote>" + bold(l.slice(2)) + "</blockquote>"; }
    else if (l.startsWith("---") || l.startsWith("***")) { flushPara(); flushList(); html += "<hr>"; }
    else if (/^[-*•] /.test(l))    { flushPara(); if (!inList) { html += "<ul>"; inList = true; } html += "<li>" + bold(l.slice(2)) + "</li>"; }
    else if (/^\d+\. /.test(l))    { flushPara(); if (!inList) { html += "<ul>"; inList = true; } html += "<li>" + bold(l.replace(/^\d+\. /, "")) + "</li>"; }
    else if (l.trim() === "")      { flushPara(); flushList(); }
    else                           { flushList(); para.push(l); }
  }
  flushPara(); flushList();
  return html;
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
    const contentHtml = dossier ? mdToHtml(dossier) : "";
    let html = fillTemplate(dossierTemplateHtml, {
      LOGO_URL:        profile?.logo_url      ?? "",
      ACCENT_COLOR:    profile?.accent_color  ?? "#8b6f47",
      BRAND_NAME:      profile?.brand_name    ?? profile?.name ?? "",
      NAME:            profile?.name          ?? "",
      EMAIL:           profile?.contact_email ?? profile?.email ?? "",
      TEL:             profile?.contact_tel   ?? "",
      VILLE:           profile?.ville         ?? "",
      WEBSITE:         profile?.website       ?? "",
      TEMPLATE_LABEL:  tplLabel,
      RECIP_NOM:       recip.nom,
      RECIP_FONCTION:  recip.fonction,
      RECIP_ORG:       recip.org,
      CONTENT:         "",
    });
    if (contentHtml) {
      html = html.replace(
        '<div class="content-area" id="content-area"></div>',
        `<div class="content-area" id="content-area">${contentHtml}</div>`,
      );
    }
    return html;
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

