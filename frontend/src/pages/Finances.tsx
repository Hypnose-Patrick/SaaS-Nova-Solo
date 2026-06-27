import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { KpiCard } from "@/components/ui/KpiCard";
import { AiResult } from "@/components/ui/AiResult";
import { useUserStore } from "@/stores/useUserStore";
import { useAppStore } from "@/stores/useAppStore";
import { useAiGen, MODEL_REASONING } from "@/lib/useAiGen";
import { promptFinanceAnalyse } from "@/lib/lancementPrompts";
import { loadLocal, saveLocal } from "@/lib/local";
import type { Profile } from "@/types";

// ── Modèle prévisionnel (repris du Nova Solo v1, FINANCE_SEED) ────────────────
interface FinMonth { m: string; period: string; ca: number; charges: number; draw?: number }
interface OpexLine { poste: string; montant: number }
interface FinModel {
  scenario: "A" | "B";
  startCash: number;
  capitalInjection: number;
  injectionMonth: number; // 1-indexé
  scenarios: Record<"A" | "B", { label: string; months: FinMonth[] }>;
  opexRI: OpexLine[];
  opexSarl: OpexLine[];
  financement: OpexLine[];
}

const FINANCE_SEED: FinModel = {
  scenario: "A",
  startCash: 5000,
  capitalInjection: 67000, // LPP 50'000 + prêt 20'000 − frais constitution 3'000
  injectionMonth: 8, // M8 = janv. 2027 = constitution Sàrl
  scenarios: {
    A: { label: "Volontariste", months: [
      { m: "M1", period: "Juin 2026", ca: 500, charges: 1650 }, { m: "M2", period: "Juil 2026", ca: 1200, charges: 1650 },
      { m: "M3", period: "Août 2026", ca: 2800, charges: 1650 }, { m: "M4", period: "Sept 2026", ca: 6000, charges: 1650 },
      { m: "M5", period: "Oct 2026", ca: 13500, charges: 1650 }, { m: "M6", period: "Nov 2026", ca: 17500, charges: 1650, draw: 5000 },
      { m: "M7", period: "Déc 2026", ca: 20500, charges: 1650, draw: 5000 }, { m: "M8", period: "Jan 2027", ca: 23000, charges: 9750 },
      { m: "M9", period: "Fév 2027", ca: 25500, charges: 9750 }, { m: "M10", period: "Mar 2027", ca: 27500, charges: 9750 },
      { m: "M11", period: "Avr 2027", ca: 29000, charges: 9750 }, { m: "M12", period: "Mai 2027", ca: 30500, charges: 9750 },
    ] },
    B: { label: "Prudent", months: [
      { m: "M1", period: "Juin 2026", ca: 300, charges: 1650 }, { m: "M2", period: "Juil 2026", ca: 700, charges: 1650 },
      { m: "M3", period: "Août 2026", ca: 1200, charges: 1650 }, { m: "M4", period: "Sept 2026", ca: 2500, charges: 1650 },
      { m: "M5", period: "Oct 2026", ca: 5500, charges: 1650 }, { m: "M6", period: "Nov 2026", ca: 7500, charges: 1650, draw: 5000 },
      { m: "M7", period: "Déc 2026", ca: 9000, charges: 1650, draw: 5000 }, { m: "M8", period: "Jan 2027", ca: 10500, charges: 9750 },
      { m: "M9", period: "Fév 2027", ca: 12000, charges: 9750 }, { m: "M10", period: "Mar 2027", ca: 13500, charges: 9750 },
      { m: "M11", period: "Avr 2027", ca: 15000, charges: 9750 }, { m: "M12", period: "Mai 2027", ca: 16500, charges: 9750 },
    ] },
  },
  opexRI: [
    { poste: "Loyer / quote-part bureau", montant: 350 }, { poste: "Assurance maladie (LAMal)", montant: 450 },
    { poste: "Assurance RC professionnelle", montant: 50 }, { poste: "Téléphonie & internet", montant: 80 },
    { poste: "Hébergement, IA & outils SaaS", montant: 150 }, { poste: "Comptabilité / fiduciaire", montant: 120 },
    { poste: "Frais bancaires", montant: 20 }, { poste: "Déplacements & véhicule", montant: 150 },
    { poste: "Marketing & communication", montant: 130 }, { poste: "Divers / imprévus", montant: 150 },
  ],
  opexSarl: [
    { poste: "Salaire brut gérant", montant: 6000 }, { poste: "Charges sociales patronales (~15%)", montant: 900 },
    { poste: "Loyer bureau", montant: 600 }, { poste: "Assurances pro (RC, perte de gain)", montant: 200 },
    { poste: "Hébergement, IA & outils SaaS", montant: 450 }, { poste: "Comptabilité / fiduciaire", montant: 300 },
    { poste: "Marketing & acquisition", montant: 500 }, { poste: "Téléphonie & internet", montant: 120 },
    { poste: "Déplacements & véhicule", montant: 350 }, { poste: "Frais bancaires & divers", montant: 330 },
  ],
  financement: [
    { poste: "Retrait LPP (net injecté dans la Sàrl)", montant: 50000 },
    { poste: "Prêt familial", montant: 20000 },
    { poste: "Frais de constitution (notaire, RC, FOSC)", montant: -3000 },
  ],
};

const CANON: Record<"RI" | "Sarl", number> = { RI: 1650, Sarl: 9750 };
const FIN_KEY = "ns_finance";

// Pré-remplit le modèle depuis les données réelles du profil utilisateur
// (capital, charges fixes). Les valeurs canoniques ne servent que de filet
// quand un champ n'est pas renseigné. Tout reste éditable ensuite.
function seedModel(profile: Profile | null): FinModel {
  const seed: FinModel = JSON.parse(JSON.stringify(FINANCE_SEED));
  if (!profile) return seed;
  const capital = Number(profile.capital) || 0;
  const charges = Number(profile.charges_fixes) || 0;
  if (capital > 0) seed.startCash = capital;
  if (charges > 0) {
    // applique les charges fixes réelles à la phase d'amorçage (avant l'injection M8)
    (["A", "B"] as const).forEach((sc) => {
      seed.scenarios[sc].months.forEach((m, i) => {
        if (i < seed.injectionMonth - 1) m.charges = charges;
      });
    });
  }
  return seed;
}
function profileSeeded(profile: Profile | null): boolean {
  return !!profile && ((Number(profile.capital) || 0) > 0 || (Number(profile.charges_fixes) || 0) > 0);
}

// ── Helpers de calcul ─────────────────────────────────────────────────────────
function chf(n: number): string {
  const r = Math.round(Number(n) || 0);
  const neg = r < 0;
  const s = Math.abs(r).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return (neg ? "−" : "") + s;
}

interface FinRow { m: string; period: string; ca: number; charges: number; ebitda: number; draw: number; injection: number; treso: number }

function financeCompute(f: FinModel): FinRow[] {
  const rows: FinRow[] = [];
  let cash = Number(f.startCash) || 0;
  f.scenarios[f.scenario].months.forEach((mo, i) => {
    const ca = Number(mo.ca) || 0, ch = Number(mo.charges) || 0, eb = ca - ch, dr = Number(mo.draw) || 0;
    const inj = (i + 1) === Number(f.injectionMonth) ? (Number(f.capitalInjection) || 0) : 0;
    cash += eb + inj - dr;
    rows.push({ m: mo.m, period: mo.period, ca, charges: ch, ebitda: eb, draw: dr, injection: inj, treso: cash });
  });
  return rows;
}

function financeKpis(rows: FinRow[]) {
  const caTot = rows.reduce((s, r) => s + r.ca, 0);
  const chTot = rows.reduce((s, r) => s + r.charges, 0);
  const drawTot = rows.reduce((s, r) => s + r.draw, 0);
  const be = rows.find((r) => r.ebitda >= 0);
  return {
    caTot, chTot, drawTot, ebTot: caTot - chTot,
    tresoMin: Math.min(...rows.map((r) => r.treso)),
    tresoMax: Math.max(...rows.map((r) => r.treso)),
    be: be ? `${be.m} · ${be.period}` : "—",
  };
}

// ── CSV (export / import) — port v1 ───────────────────────────────────────────
function csvField(v: unknown): string {
  let s = String(v == null ? "" : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function buildCsv(f: FinModel, rows: FinRow[]): string {
  const sep = ";"; const L: string[] = [];
  L.push(`Budget previsionnel - Scenario ${f.scenario}`);
  L.push(["Mois", "Periode", "CA", "Charges", "Prelevements", "EBITDA", "Tresorerie"].map(csvField).join(sep));
  rows.forEach((r) => L.push([r.m, r.period, r.ca, r.charges, r.draw, r.ebitda, r.treso].map(csvField).join(sep)));
  L.push("");
  L.push("Budget exploitation - Raison Individuelle (CHF/mois)");
  L.push(["Poste", "Montant"].join(sep));
  f.opexRI.forEach((l) => L.push([csvField(l.poste), Number(l.montant) || 0].join(sep)));
  L.push("");
  L.push("Budget exploitation - Sarl (CHF/mois)");
  L.push(["Poste", "Montant"].join(sep));
  f.opexSarl.forEach((l) => L.push([csvField(l.poste), Number(l.montant) || 0].join(sep)));
  return L.join("\r\n");
}
function csvSplit(line: string, sep: string): string[] {
  const out: string[] = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === sep && !q) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur); return out;
}
function csvNum(s: string | undefined): number | null {
  if (s == null) return null;
  const t = String(s).replace(/['\s ]/g, "").replace("−", "-").replace(",", ".");
  if (t === "" || t === "-") return null;
  const n = Number(t); return isNaN(n) ? null : Math.round(n);
}

// ── Graphe SVG combiné (CA + charges en barres, trésorerie en ligne) ──────────
function FinChart({ rows }: { rows: FinRow[] }) {
  const W = 720, H = 240, padL = 8, padR = 8, padT = 14, padB = 30;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const groupW = plotW / rows.length;
  const maxBar = Math.max(...rows.flatMap((r) => [r.ca, r.charges]), 1);
  const hi = Math.max(maxBar, ...rows.map((r) => r.treso), 1);
  const lo = Math.min(0, ...rows.map((r) => r.treso));
  const y = (v: number) => padT + plotH * (hi - v) / (hi - lo || 1);
  const base = y(0);
  const barW = groupW * 0.3;
  const line = rows.map((r, i) => `${(padL + groupW * i + groupW / 2).toFixed(1)},${y(r.treso).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 240 }} preserveAspectRatio="xMidYMid meet">
      <line x1={padL} y1={base} x2={W - padR} y2={base} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
      {rows.map((r, i) => {
        const cx = padL + groupW * i;
        const caH = Math.abs(y(r.ca) - base), chH = Math.abs(y(r.charges) - base);
        return (
          <g key={r.m}>
            <rect x={cx + groupW / 2 - barW - 1} y={base - caH} width={barW} height={caH} rx={2} fill="var(--color-gold)" opacity={0.9} />
            <rect x={cx + groupW / 2 + 1} y={base - chH} width={barW} height={chH} rx={2} fill="rgba(239,68,68,0.55)" />
            <text x={cx + groupW / 2} y={H - 10} textAnchor="middle" fontSize={9} fill="var(--color-text-muted)">{r.m}</text>
          </g>
        );
      })}
      <polyline points={line} fill="none" stroke="var(--color-success)" strokeWidth={2} />
      {rows.map((r, i) => (
        <circle key={r.m} cx={padL + groupW * i + groupW / 2} cy={y(r.treso)} r={2.5} fill="var(--color-success)" />
      ))}
    </svg>
  );
}

// ── Champ numérique éditable (thème sombre) ───────────────────────────────────
function NumCell({ value, onChange, w = 88 }: { value: number; onChange: (v: number) => void; w?: number }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      style={{
        width: w, background: "var(--color-bg-input)", border: "var(--border-subtle)",
        borderRadius: "var(--radius-xs)", color: "var(--color-text-primary)", fontFamily: "var(--font-mono)",
        fontSize: "var(--text-xs)", padding: "4px 6px", textAlign: "right", outline: "none",
      }}
    />
  );
}

const thStyle: React.CSSProperties = { fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-text-muted)", padding: "6px 8px", textAlign: "left", borderBottom: "var(--border-subtle)" };
const tdStyle: React.CSSProperties = { fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", padding: "5px 8px", borderBottom: "var(--border-subtle)", whiteSpace: "nowrap" };
const numTd: React.CSSProperties = { ...tdStyle, textAlign: "right", fontFamily: "var(--font-mono)" };

export function Finances() {
  const profile = useUserStore((s) => s.profile);
  const { compta, fetchCompta } = useAppStore();
  const { loading: aiLoading, error: aiError, gen } = useAiGen();

  const [fin, setFin] = useState<FinModel>(() => loadLocal<FinModel>(FIN_KEY, seedModel(useUserStore.getState().profile)));
  const [analyse, setAnalyse] = useState<string | null>(() => loadLocal<string | null>("ns_finance_analyse", null));
  const [sarlCA, setSarlCA] = useState("");

  useEffect(() => {
    if (profile?.id) fetchCompta(profile.id);
  }, [profile?.id]);

  // Pré-remplissage depuis le profil : seulement si aucun budget n'a encore été
  // saisi (on n'écrase jamais les données de l'utilisateur déjà enregistrées).
  useEffect(() => {
    if (profile && localStorage.getItem(FIN_KEY) == null) setFin(seedModel(profile));
  }, [profile?.id]);

  function update(mut: (f: FinModel) => void) {
    setFin((prev) => {
      const next: FinModel = JSON.parse(JSON.stringify(prev));
      mut(next);
      saveLocal(FIN_KEY, next);
      return next;
    });
  }

  const rows = useMemo(() => financeCompute(fin), [fin]);
  const k = useMemo(() => financeKpis(rows), [rows]);

  const opexRITot = fin.opexRI.reduce((s, l) => s + (Number(l.montant) || 0), 0);
  const opexSarlTot = fin.opexSarl.reduce((s, l) => s + (Number(l.montant) || 0), 0);
  const financementTot = fin.financement.reduce((s, l) => s + (Number(l.montant) || 0), 0);

  // ── Actions ──
  function setScenario(s: "A" | "B") { update((f) => { f.scenario = s; }); }
  function editMonth(i: number, field: "ca" | "charges" | "draw", v: number) {
    update((f) => { const mo = f.scenarios[f.scenario].months[i]; if (mo) mo[field] = v; });
  }
  function editOpex(phase: "RI" | "Sarl", i: number, field: "poste" | "montant", v: string | number) {
    update((f) => {
      const arr = phase === "RI" ? f.opexRI : f.opexSarl;
      const l = arr[i]; if (!l) return;
      if (field === "poste") l.poste = String(v); else l.montant = Number(v) || 0;
    });
  }
  function addOpex(phase: "RI" | "Sarl") { update((f) => { (phase === "RI" ? f.opexRI : f.opexSarl).push({ poste: "Nouveau poste", montant: 0 }); }); }
  function delOpex(phase: "RI" | "Sarl", i: number) { update((f) => { (phase === "RI" ? f.opexRI : f.opexSarl).splice(i, 1); }); }

  function resetCanon() {
    if (!confirm("Réinitialiser le budget ? Tes modifications seront perdues et les valeurs repartiront de ton profil (capital, charges fixes).")) return;
    const seed = seedModel(profile);
    saveLocal(FIN_KEY, seed); setFin(seed);
  }

  function exportCsv() {
    try {
      const blob = new Blob(["﻿" + buildCsv(fin, rows)], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = "budget-previsionnel.csv"; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 120);
    } catch { alert("Export impossible — le navigateur a bloqué le téléchargement."); }
  }

  function importCsv(input: HTMLInputElement) {
    const file = input.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = String(e.target?.result || "").replace(/^﻿/, "");
        const lines = text.split(/\r?\n/);
        const hdr = lines.find((l) => /(^|;|,)\s*Mois\b/i.test(l) || /Poste\s*[;,]\s*Montant/i.test(l)) || lines[0] || "";
        const sep = hdr.split(";").length >= hdr.split(",").length ? ";" : ",";
        let section = "", nPrev = 0; const riNew: OpexLine[] = [], sarlNew: OpexLine[] = [];
        const next: FinModel = JSON.parse(JSON.stringify(fin));
        const by: Record<string, FinMonth> = {};
        next.scenarios[next.scenario].months.forEach((m) => { by[m.m] = m; });
        lines.forEach((l) => {
          if (!l.trim()) return;
          if (/budget\s+pr[ée]visionnel/i.test(l)) { section = "prev"; return; }
          if (/exploitation.*(raison\s+individuelle|\bRI\b)/i.test(l)) { section = "opexRI"; return; }
          if (/exploitation.*s[aà]rl/i.test(l)) { section = "opexSarl"; return; }
          const c = csvSplit(l, sep); if (!c.length) return;
          const a = (c[0] || "").trim();
          if (/^mois$/i.test(a) || /^poste$/i.test(a)) return;
          const code = a.toUpperCase();
          if (/^M([1-9]|1[0-2])$/.test(code) && by[code]) {
            const ca = csvNum(c[2]), ch = csvNum(c[3]), dr = csvNum(c[4]);
            if (ca != null) by[code].ca = ca; if (ch != null) by[code].charges = ch; if (dr != null) by[code].draw = dr;
            nPrev++; return;
          }
          if (section === "opexRI" || section === "opexSarl") {
            const montant = csvNum(c[1]);
            if (a && montant != null && !/^total/i.test(a)) (section === "opexRI" ? riNew : sarlNew).push({ poste: a, montant });
          }
        });
        const applied: string[] = [];
        if (nPrev > 0) applied.push(`${nPrev} mois`);
        if (riNew.length) { next.opexRI = riNew; applied.push(`${riNew.length} postes RI`); }
        if (sarlNew.length) { next.opexSarl = sarlNew; applied.push(`${sarlNew.length} postes Sàrl`); }
        if (applied.length) { saveLocal(FIN_KEY, next); setFin(next); alert("Budget importé : " + applied.join(" · ") + " mis à jour."); }
        else alert("Rien à importer. Exporte d'abord un modèle CSV pour retrouver le format (sections + en-têtes).");
      } catch { alert("Fichier illisible. Exporte d'abord un modèle CSV pour le format."); }
      input.value = "";
    };
    reader.readAsText(file);
  }

  async function analyseIA() {
    const resume = `Scénario ${fin.scenario} (${fin.scenarios[fin.scenario].label}). CA An1 ${chf(k.caTot)} CHF, charges ${chf(k.chTot)} CHF, EBITDA ${chf(k.ebTot)} CHF. Trésorerie : plancher ${chf(k.tresoMin)} CHF, pic ${chf(k.tresoMax)} CHF. 1er mois EBITDA positif : ${k.be}. Capital injecté M8 (janv. 2027) : ${chf(fin.capitalInjection)} CHF. Détail : ${rows.map((r) => `${r.m} CA ${chf(r.ca)}/ch ${chf(r.charges)}→tréso ${chf(r.treso)}`).join(" ; ")}.`;
    const r = await gen("financier", promptFinanceAnalyse(profile, resume), { model: MODEL_REASONING });
    if (r) { setAnalyse(r); saveLocal("ns_finance_analyse", r); }
  }

  // ── Calculateur RI → Sàrl ──
  const sarlCalc = useMemo(() => {
    const ca = parseFloat(sarlCA) || 0;
    if (ca <= 0) return null;
    const chargesRI = ca * 0.10;
    const impotRI = (ca - chargesRI) * 0.25;
    const beneficeSarl = ca * 0.85;
    const impotSarl = beneficeSarl * 0.13;
    const seuil = ca >= 120000;
    return { ca, chargesRI, impotRI, impotSarl, seuil, gain: Math.round((impotRI - impotSarl) / 1000) };
  }, [sarlCA]);

  // ── Réalisé (comptabilité) — strip de bas de page ──
  const currentYear = new Date().getFullYear();
  const realised = useMemo(() => {
    const ye = compta.filter((e) => e.date.startsWith(String(currentYear)));
    const rev = ye.filter((e) => e.type === "revenu").reduce((s, e) => s + e.amount, 0);
    const dep = ye.filter((e) => e.type === "depense").reduce((s, e) => s + e.amount, 0);
    return { rev, dep, benef: rev - dep, count: ye.length };
  }, [compta, currentYear]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 400, color: "var(--color-text-primary)", margin: 0 }}>
          Finances &amp; Administration
        </h2>
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", marginTop: "var(--space-1)" }}>
          Budget prévisionnel &amp; d'exploitation, plan de trésorerie, charges sociales, TVA suisse.
        </p>
      </div>

      {/* KPIs prévisionnel */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-4)" }}>
        <KpiCard label="CA cumulé · An 1" value={`${chf(k.caTot)} CHF`} trendValue="12 mois (juin 26 → mai 27)" trend="up" />
        <KpiCard label="Charges cumulées" value={`${chf(k.chTot)} CHF`} trendValue="1'650 → 9'750 / mois" trend="flat" />
        <KpiCard label="Résultat (EBITDA)" value={`${k.ebTot >= 0 ? "+" : ""}${chf(k.ebTot)} CHF`} trendValue={k.ebTot >= 0 ? "Excédent" : "Déficit"} trend={k.ebTot >= 0 ? "up" : "down"} />
        <KpiCard label="Trésorerie · pic" value={`${chf(k.tresoMax)} CHF`} trendValue={`plancher ${chf(k.tresoMin)} CHF`} trend={k.tresoMin >= 0 ? "up" : "down"} />
      </div>

      {/* Compte bancaire professionnel */}
      <Card>
        <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 var(--space-1)" }}>🏦 Compte bancaire professionnel</p>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: "0 0 var(--space-4)" }}>
          En Suisse, séparer les comptes privé et pro est indispensable dès le 1<sup>er</sup> CHF de revenu indépendant.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-3)" }}>
          {[
            { t: "🏛️ Banques traditionnelles", d: "PostFinance, UBS, Raiffeisen, banques cantonales — frais 20–50 CHF/mois. Crédibilité maximale pour les relations B2B." },
            { t: "💻 Néobanques", d: "Neon, Yuh, Wise, Relay — gratuit à 10 CHF/mois. Idéal pour démarrer. Wise : parfait si clients hors Suisse (CHF + EUR)." },
            { t: "⚠️ À retenir", d: "Pour une Sàrl : compte bancaire obligatoire AVANT l'inscription au RC (capital minimum 20'000 CHF à libérer)." },
          ].map((c) => (
            <div key={c.t} style={{ background: "var(--color-bg-input)", border: "var(--border-subtle)", borderRadius: "var(--radius-xs)", padding: "var(--space-3)" }}>
              <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--color-text-secondary)", marginBottom: 4 }}>{c.t}</div>
              <div style={{ fontSize: "11px", color: "var(--color-text-muted)", lineHeight: 1.5 }}>{c.d}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Budget prévisionnel 12 mois */}
      <Card>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 var(--space-1)" }}>📈 Budget prévisionnel &amp; plan de trésorerie — 12 mois</p>
            <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: 0, lineHeight: 1.5 }}>
              Juin 2026 → mai 2027 · capital {chf(fin.capitalInjection)} CHF injecté à la constitution (M8). Cellules CA, charges &amp; prélèvements éditables.
            </p>
            {profileSeeded(profile) && (
              <p style={{ fontSize: "10px", color: "var(--color-gold-muted)", margin: "4px 0 0", lineHeight: 1.4 }}>
                ✦ Trésorerie de départ ({chf(fin.startCash)} CHF) et charges fixes d'amorçage reprises de ton profil — ajustables.
              </p>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
            <div style={{ display: "inline-flex", border: "var(--border-subtle)", borderRadius: "var(--radius-xs)", overflow: "hidden" }}>
              {(["A", "B"] as const).map((s) => (
                <button key={s} onClick={() => setScenario(s)} style={{
                  padding: "6px 10px", fontSize: "11px", cursor: "pointer", border: "none",
                  background: fin.scenario === s ? "var(--color-gold)" : "transparent",
                  color: fin.scenario === s ? "#1a1a1a" : "var(--color-text-secondary)", fontWeight: 600,
                }}>{s} · {fin.scenarios[s].label}</button>
              ))}
            </div>
            <Button size="sm" variant="gold" loading={aiLoading} onClick={analyseIA}>✦ Analyser (IA)</Button>
            <Button size="sm" variant="ghost" onClick={exportCsv}>⬇ Excel / Sheets</Button>
            <label style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "var(--radius-xs)", padding: "var(--space-2) var(--space-4)", textTransform: "uppercase", letterSpacing: "var(--tracking-wider)", fontWeight: 500 }}>
              ⬆ Importer<input type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => importCsv(e.target)} />
            </label>
            <Button size="sm" variant="ghost" onClick={resetCanon}>↺ Canonique</Button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead>
              <tr>
                <th style={thStyle}>Mois</th><th style={thStyle}>Période</th>
                <th style={{ ...thStyle, textAlign: "right" }}>CA</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Charges</th>
                <th style={{ ...thStyle, textAlign: "right" }}>EBITDA</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Prélèv.</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Trésorerie</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.m} style={r.injection ? { background: "rgba(197,165,114,0.06)" } : undefined}>
                  <td style={tdStyle}>{r.m}</td>
                  <td style={tdStyle}>{r.period}{r.injection ? <span title="Capital injecté à la constitution" style={{ color: "var(--color-gold)", marginLeft: 4 }}>＋capital</span> : null}</td>
                  <td style={numTd}><NumCell value={fin.scenarios[fin.scenario].months[i].ca} onChange={(v) => editMonth(i, "ca", v)} /></td>
                  <td style={numTd}><NumCell value={fin.scenarios[fin.scenario].months[i].charges} onChange={(v) => editMonth(i, "charges", v)} /></td>
                  <td style={{ ...numTd, color: r.ebitda >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>{r.ebitda >= 0 ? "+" : ""}{chf(r.ebitda)}</td>
                  <td style={numTd}><NumCell value={fin.scenarios[fin.scenario].months[i].draw ?? 0} onChange={(v) => editMonth(i, "draw", v)} w={72} /></td>
                  <td style={{ ...numTd, color: r.treso < 0 ? "var(--color-danger)" : "var(--color-text-primary)" }}>{chf(r.treso)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: "var(--border-active)" }}>
                <td style={{ ...tdStyle, fontWeight: 700 }} colSpan={2}>Total / An 1</td>
                <td style={{ ...numTd, fontWeight: 700 }}>{chf(k.caTot)}</td>
                <td style={{ ...numTd, fontWeight: 700 }}>{chf(k.chTot)}</td>
                <td style={{ ...numTd, fontWeight: 700, color: k.ebTot >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>{k.ebTot >= 0 ? "+" : ""}{chf(k.ebTot)}</td>
                <td style={{ ...numTd, fontWeight: 700 }}>{chf(k.drawTot)}</td>
                <td style={numTd}>—</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: "var(--space-4)" }}><FinChart rows={rows} /></div>
        <div style={{ display: "flex", gap: "var(--space-6)", marginTop: "var(--space-2)", flexWrap: "wrap" }}>
          {[["var(--color-gold)", "CA"], ["rgba(239,68,68,0.55)", "Charges"], ["var(--color-success)", "Trésorerie"]].map(([col, lbl]) => (
            <span key={lbl} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: col, display: "inline-block" }} />{lbl}
            </span>
          ))}
        </div>

        {(aiLoading || aiError || analyse) && (
          <div style={{ marginTop: "var(--space-4)", borderTop: "var(--border-subtle)", paddingTop: "var(--space-4)" }}>
            <AiResult content={analyse} loading={aiLoading} error={aiError} emptyHint={undefined} />
          </div>
        )}
      </Card>

      {/* Budget d'exploitation détaillé (OPEX) */}
      <Card>
        <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 var(--space-1)" }}>🧾 Budget d'exploitation détaillé</p>
        <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: "0 0 var(--space-4)" }}>
          Répartition indicative &amp; modifiable — le total doit coller au prévisionnel (RI 1'650 · Sàrl 9'750 / mois).
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--space-5)" }}>
          {([["RI", "Amorçage — Raison Individuelle", fin.opexRI, opexRITot], ["Sarl", "Sàrl — dès janv. 2027", fin.opexSarl, opexSarlTot]] as const).map(([phase, title, arr, tot]) => {
            const ok = tot === CANON[phase];
            return (
              <div key={phase}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text-secondary)" }}>{title}</span>
                  <span style={{ fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: "var(--radius-xs)", background: ok ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)", color: ok ? "var(--color-success)" : "var(--color-warning)" }}>
                    {chf(tot)} / {chf(CANON[phase])} CHF
                  </span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {arr.map((l, i) => (
                      <tr key={i}>
                        <td style={{ ...tdStyle, width: "100%" }}>
                          <input value={l.poste} onChange={(e) => editOpex(phase, i, "poste", e.target.value)} style={{ width: "100%", background: "transparent", border: "none", color: "var(--color-text-secondary)", fontSize: "var(--text-xs)", outline: "none" }} />
                        </td>
                        <td style={numTd}><NumCell value={l.montant} onChange={(v) => editOpex(phase, i, "montant", v)} w={72} /></td>
                        <td style={{ ...tdStyle, padding: "5px 4px" }}>
                          <button onClick={() => delOpex(phase, i)} title="Supprimer" style={{ background: "none", border: "none", color: "var(--color-text-muted)", cursor: "pointer", fontSize: "14px" }}>×</button>
                        </td>
                      </tr>
                    ))}
                    <tr><td style={{ ...tdStyle, fontWeight: 700 }}>Total mensuel</td><td style={{ ...numTd, fontWeight: 700 }}>{chf(tot)}</td><td style={tdStyle} /></tr>
                  </tbody>
                </table>
                <Button size="sm" variant="ghost" onClick={() => addOpex(phase)} style={{ marginTop: 6 }}>+ Ligne</Button>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Plan de financement Sàrl + Charges sociales + RI→Sàrl */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-5)" }}>
        <Card>
          <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 var(--space-1)" }}>🏦 Plan de financement — constitution Sàrl (janv. 2027)</p>
          <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: "0 0 var(--space-4)" }}>Capital opérationnel injecté à la constitution (CO art. 773) — modélisé en trésorerie au mois M8.</p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {fin.financement.map((l, i) => (
                <tr key={i}>
                  <td style={tdStyle}>{l.poste}</td>
                  <td style={{ ...numTd, color: l.montant < 0 ? "var(--color-danger)" : "var(--color-text-secondary)" }}>{l.montant < 0 ? "−" : ""}{chf(Math.abs(l.montant))} CHF</td>
                </tr>
              ))}
              <tr style={{ borderTop: "var(--border-active)" }}>
                <td style={{ ...tdStyle, fontWeight: 700 }}>Capital opérationnel injecté</td>
                <td style={{ ...numTd, fontWeight: 700, color: "var(--color-success)" }}>{chf(financementTot)} CHF</td>
              </tr>
            </tbody>
          </table>
        </Card>

        <Card>
          <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 var(--space-4)" }}>Charges sociales estimées (indépendante)</p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={thStyle}>Poste</th><th style={thStyle}>Taux / Montant</th><th style={{ ...thStyle, textAlign: "right" }}>Estim./an</th></tr></thead>
            <tbody>
              {[
                ["AVS/AI/APG", "~10% du revenu net", "5'500 CHF"],
                ["LPP (2e pilier)", "Facultatif", "— CHF"],
                ["Pilier 3a (déductible)", "Max 7'056 CHF", "7'056 CHF"],
                ["RC professionnelle", "Forfait", "~600 CHF"],
                ["LAMal (caisse maladie)", "Individuelle", "~3'600 CHF"],
              ].map((r) => (
                <tr key={r[0]}><td style={tdStyle}>{r[0]}</td><td style={tdStyle}>{r[1]}</td><td style={numTd}>{r[2]}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Quand passer de la RI à la Sàrl ? */}
      <Card>
        <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 var(--space-1)" }}>⚡ Quand passer de la Raison Individuelle à la Sàrl ?</p>
        <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: "0 0 var(--space-4)" }}>L'optimisation fiscale la plus impactante pour un indépendant suisse.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-5)", alignItems: "start" }}>
          <div>
            <div style={{ fontSize: "var(--text-xs)", lineHeight: 1.7, color: "var(--color-text-muted)", marginBottom: "var(--space-3)" }}>
              La Sàrl devient pertinente quand votre revenu net dépasse environ <strong style={{ color: "var(--color-text-secondary)" }}>120'000–150'000 CHF/an</strong>. En dessous, les frais administratifs ne compensent pas les avantages fiscaux.<br /><br />
              <strong style={{ color: "var(--color-text-secondary)" }}>Avantages de la Sàrl :</strong><br />
              • Imposition du bénéfice (env. 12–14% en Vaud) &lt; impôt sur le revenu<br />
              • Salaire « raisonnable » versé, reste en bénéfice<br />
              • Cotisations AVS sur le salaire déclaré uniquement<br />
              • Protection du patrimoine privé (responsabilité limitée)
            </div>
            <label style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>Votre CA annuel estimé (CHF)</label>
            <input type="number" value={sarlCA} onChange={(e) => setSarlCA(e.target.value)} placeholder="Ex : 120000"
              style={{ width: "100%", maxWidth: 220, background: "var(--color-bg-input)", border: "var(--border-subtle)", borderRadius: "var(--radius-xs)", color: "var(--color-text-primary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", padding: "8px 10px", outline: "none" }} />
          </div>
          <div style={{ background: "var(--color-bg-input)", border: "var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "var(--space-4)", fontSize: "var(--text-xs)", lineHeight: 1.7 }}>
            {!sarlCalc ? (
              <span style={{ color: "var(--color-text-muted)" }}>Entrez votre CA estimé pour calculer le seuil de basculement.</span>
            ) : (
              <>
                <div style={{ fontWeight: 700, marginBottom: 8, color: sarlCalc.seuil ? "var(--color-success)" : "var(--color-warning)" }}>
                  {sarlCalc.seuil ? "✅ La Sàrl pourrait vous faire économiser" : "⏳ Pas encore le seuil optimal (120k CHF)"}
                </div>
                <Row k="Charge AVS (RI, ~10%)" v={`${chf(sarlCalc.chargesRI)} CHF`} />
                <Row k="Impôt revenu estimé (RI)" v={`${chf(sarlCalc.impotRI)} CHF`} vColor="var(--color-danger)" />
                <Row k="IS Sàrl estimé (Vaud ~13%)" v={`${chf(sarlCalc.impotSarl)} CHF`} vColor="var(--color-success)" />
                <div style={{ marginTop: 8, fontSize: "10px", color: "var(--color-text-muted)" }}>Estimation indicative. Consultez votre fiduciaire avant toute décision de statut.</div>
                <div style={{ marginTop: 8, fontSize: "11px", padding: "var(--space-2)", borderRadius: "var(--radius-xs)", background: sarlCalc.seuil ? "rgba(34,197,94,0.10)" : "rgba(96,165,250,0.10)", color: sarlCalc.seuil ? "var(--color-success)" : "var(--color-info)" }}>
                  {sarlCalc.seuil
                    ? `Gain fiscal potentiel Sàrl vs RI : ~${sarlCalc.gain}k CHF/an. Moment de consulter un fiduciaire agréé.`
                    : `À ${chf(sarlCalc.ca)} CHF de CA, restez en RI. Réévaluez à 120k CHF.`}
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Réalisé (comptabilité) — pont vers la page Compta */}
      <Card glass>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
          <span style={{ fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Réalisé {currentYear} (comptabilité)</span>
          <a href="/compta" style={{ fontSize: "var(--text-xs)", color: "var(--color-gold)" }}>Ouvrir la comptabilité →</a>
        </div>
        {realised.count === 0 ? (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: 0 }}>
            Aucune transaction enregistrée. Saisissez vos revenus et dépenses réels dans <a href="/compta" style={{ color: "var(--color-gold)" }}>Comptabilité</a> pour comparer au prévisionnel.
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)" }}>
            <KpiCard label="Revenus réels" value={`${chf(realised.rev)} CHF`} trend="up" />
            <KpiCard label="Dépenses réelles" value={`${chf(realised.dep)} CHF`} trend="flat" />
            <KpiCard label="Bénéfice réel" value={`${chf(realised.benef)} CHF`} trend={realised.benef >= 0 ? "up" : "down"} />
          </div>
        )}
      </Card>
    </div>
  );
}

function Row({ k, v, vColor }: { k: string; v: string; vColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "var(--border-subtle)" }}>
      <span style={{ color: "var(--color-text-muted)" }}>{k}</span>
      <span style={{ fontWeight: 600, color: vColor ?? "var(--color-text-secondary)", fontFamily: "var(--font-mono)" }}>{v}</span>
    </div>
  );
}
