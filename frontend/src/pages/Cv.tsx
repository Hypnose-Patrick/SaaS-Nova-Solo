import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { AiResult } from "@/components/ui/AiResult";
import { useUserStore } from "@/stores/useUserStore";
import { useAiGen, MODEL_REASONING } from "@/lib/useAiGen";
import { promptCvGenerate, promptCvImprove, CV_TYPES, type CvType } from "@/lib/lancementPrompts";
import { loadLocal, saveLocal } from "@/lib/local";
import { printHtml, downloadWord } from "@/lib/exportDoc";

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

const ATS_CHECKS = [
  "Format texte simple, sans tableaux complexes",
  "Coordonnées en texte (non en en-tête image)",
  "Sections avec titres standards",
  "Puces simples (•)",
  "Dates au format cohérent",
  "Résultats quantifiés (CHF, %, nombre)",
  "Verbes d'action forts en début de phrase",
  "Structure CAR (Contexte – Action – Résultat)",
];
const ATS_BY_TYPE: Record<CvType, string> = {
  bank: "Mention explicite du projet entrepreneurial",
  client: "Bénéfice client et preuve de valeur visibles",
  linkedin: "Mots-clés métier pour la recherche / visibilité",
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function Cv() {
  const profile = useUserStore((s) => s.profile);
  const { loading, error, gen } = useAiGen();
  const [f, setF] = useState<CvFields>(() => loadLocal<CvFields>("ns_cv_fields", {
    profil: profile?.profil ?? profile?.situation ?? "", skills: "", exp: "", formation: "", langues: "",
  }));
  const [cvType, setCvType] = useState<CvType>(() => loadLocal<CvType>("ns_cv_type", "bank"));
  const [cv, setCv] = useState<string | null>(() => loadLocal<string | null>("ns_cv_result", null));
  const [improvingKey, setImprovingKey] = useState<keyof CvFields | null>(null);

  function patch(p: Partial<CvFields>) {
    const next = { ...f, ...p };
    setF(next);
    saveLocal("ns_cv_fields", next);
  }
  function pickType(t: CvType) {
    setCvType(t);
    saveLocal("ns_cv_type", t);
  }

  async function generate() {
    const r = await gen("communicant", promptCvGenerate(profile, f, cvType), { model: MODEL_REASONING });
    if (r) { setCv(r); saveLocal("ns_cv_result", r); }
  }

  async function improve(key: keyof CvFields, label: string) {
    setImprovingKey(key);
    const r = await gen("communicant", promptCvImprove(profile, label, f[key]));
    setImprovingKey(null);
    if (r) patch({ [key]: r } as Partial<CvFields>);
  }

  const fullName = profile?.name?.trim() || "Votre nom";
  const subtitle = [profile?.situation, profile?.domaine].filter(Boolean).join(" · ");
  const contactLine = [profile?.contact_email || profile?.email, profile?.contact_tel, profile?.ville].filter(Boolean).join("  ·  ");

  function buildDocHtml(): string {
    const block = (title: string, body: string) =>
      body.trim()
        ? `<h2>${escapeHtml(title)}</h2><div class="b">${escapeHtml(body)}</div>`
        : "";
    return (
      `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>CV — ${escapeHtml(fullName)}</title>` +
      `<style>body{font-family:Calibri,Arial,sans-serif;max-width:760px;margin:32px auto;padding:0 24px;color:#1a1a1a;line-height:1.5;font-size:13px}` +
      `.name{font-size:22px;font-weight:800;text-align:center}.sub{text-align:center;color:#4f46e5;font-weight:600;font-size:13px;margin-top:2px}` +
      `.contact{text-align:center;color:#64748b;font-size:11px;margin:4px 0 14px}h2{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#6366f1;border-top:1px solid #e2e8f0;padding-top:8px;margin:12px 0 4px}` +
      `.b{white-space:pre-wrap}@media print{body{margin:0}}</style></head><body>` +
      `<div class="name">${escapeHtml(fullName)}</div>` +
      (subtitle ? `<div class="sub">${escapeHtml(subtitle)}</div>` : "") +
      (contactLine ? `<div class="contact">${escapeHtml(contactLine)}</div>` : "") +
      block("Profil", f.profil) + block("Compétences clés", f.skills) +
      block("Expérience", f.exp) + block("Formation", f.formation) + block("Langues", f.langues) +
      `</body></html>`
    );
  }

  function printCv() { printHtml(buildDocHtml()); }
  function exportWordCv() { downloadWord(`cv-${fullName}`, buildDocHtml()); }

  const previewSection = (title: string, body: string) => (
    <div style={{ marginBottom: "var(--space-3)" }}>
      <div style={{ ...LBL, color: "var(--color-gold-muted)", marginBottom: "var(--space-1)" }}>{title}</div>
      <div style={{ fontSize: "var(--text-sm)", color: body.trim() ? "var(--color-text-secondary)" : "var(--color-text-muted)", whiteSpace: "pre-wrap", lineHeight: "var(--leading-normal)", fontStyle: body.trim() ? "normal" : "italic" }}>
        {body.trim() || "à compléter…"}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <PageHeader title="CV personnalisé" subtitle="CV optimisé ATS — verbes d'action, structure CAR, résultats chiffrés (fr-CH). Trois cibles, aperçu et export PDF." />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-6)", alignItems: "start" }}>
        {/* Colonne configuration */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <Card glass title="Type de CV">
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {CV_TYPES.map((t) => {
                const on = cvType === t.key;
                return (
                  <label key={t.key} onClick={() => pickType(t.key)} style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", padding: "var(--space-3) var(--space-4)", border: on ? "var(--border-gold)" : "var(--border-subtle)", borderRadius: "var(--radius-sm)", cursor: "pointer", background: on ? "var(--color-bg-glass)" : "transparent" }}>
                    <input type="radio" name="cvtype" checked={on} onChange={() => pickType(t.key)} style={{ marginTop: 3, accentColor: "var(--color-gold)" }} />
                    <span>
                      <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text-primary)" }}>{t.label}</span>
                      <span style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: 2 }}>{t.hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </Card>

          <Card glass>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <Field label="Profil / accroche" k="profil" f={f} patch={patch} improve={improve} improvingKey={improvingKey} loading={loading} multiline placeholder="Votre positionnement en 3–4 phrases : expertise, valeur, projet." />
              <Field label="Compétences clés" k="skills" f={f} patch={patch} improve={improve} improvingKey={improvingKey} loading={loading} multiline placeholder="Ex : conduite de projet, accompagnement individuel, prospection B2B…" />
              <Field label="Expériences" k="exp" f={f} patch={patch} improve={improve} improvingKey={improvingKey} loading={loading} multiline placeholder="Intitulé — Organisation, Lieu (années)&#10;• Réalisation chiffrée…" />
              <Field label="Formation" k="formation" f={f} patch={patch} improve={improve} improvingKey={improvingKey} loading={loading} placeholder="Diplômes, certifications, années…" />
              <Field label="Langues" k="langues" f={f} patch={patch} improve={improve} improvingKey={improvingKey} loading={loading} placeholder="Ex : Français (maternelle), Anglais (B2)…" noImprove />
            </div>
            <div style={{ marginTop: "var(--space-4)" }}>
              <Button variant="gold" loading={loading && improvingKey === null} onClick={generate}>
                {cv ? "Régénérer le CV complet" : "Générer le CV complet avec IA"}
              </Button>
            </div>
          </Card>
        </div>

        {/* Colonne aperçu */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", position: "sticky", top: "var(--space-4)" }}>
          <Card glass title="Aperçu" action={
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button size="sm" variant="ghost" onClick={exportWordCv}>Word</Button>
              <Button size="sm" variant="ghost" onClick={printCv}>Imprimer / PDF</Button>
            </div>
          }>
            <div style={{ textAlign: "center", marginBottom: "var(--space-4)" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", color: "var(--color-text-primary)" }}>{fullName}</div>
              {subtitle && <div style={{ fontSize: "var(--text-sm)", color: "var(--color-gold-muted)", fontWeight: 600, marginTop: 2 }}>{subtitle}</div>}
              {contactLine && <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: 4 }}>{contactLine}</div>}
            </div>
            <div style={{ height: 1, background: "var(--border-gold)", margin: "0 0 var(--space-4)" }} />
            {previewSection("Profil", f.profil)}
            {previewSection("Compétences clés", f.skills)}
            {previewSection("Expérience", f.exp)}
            {previewSection("Formation", f.formation)}
            {previewSection("Langues", f.langues)}
          </Card>

          <Card glass title="Checklist ATS">
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {[...ATS_CHECKS, ATS_BY_TYPE[cvType]].map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
                  <span style={{ color: "var(--color-success)" }}>✓</span>
                  <span>{c}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {(loading || error || cv) && improvingKey === null && (
        <Card glass title="CV généré">
          <AiResult content={cv} loading={loading} error={error} />
        </Card>
      )}
    </div>
  );
}

function Field({ label, k, f, patch, improve, improvingKey, loading, multiline, placeholder, noImprove }: {
  label: string; k: keyof CvFields; f: CvFields; patch: (p: Partial<CvFields>) => void;
  improve: (k: keyof CvFields, label: string) => void; improvingKey: keyof CvFields | null;
  loading: boolean; multiline?: boolean; placeholder?: string; noImprove?: boolean;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <label style={LBL}>{label}</label>
        {!noImprove && (
          <Button size="sm" variant="ghost" loading={loading && improvingKey === k} onClick={() => improve(k, `${label} de CV`)} disabled={!f[k].trim()}>
            Améliorer
          </Button>
        )}
      </div>
      <textarea value={f[k]} onChange={(e) => patch({ [k]: e.target.value } as Partial<CvFields>)} placeholder={placeholder} style={{ ...TA, minHeight: multiline ? 96 : 48 }} />
    </div>
  );
}
