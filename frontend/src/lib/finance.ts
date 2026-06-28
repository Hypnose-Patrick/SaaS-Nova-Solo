// Modèle financier partagé (Finances + Business Plan) — source unique de vérité
// pour la forme des données, le calcul du prévisionnel et le résumé budgétaire.

import { loadLocal } from "./local";

export const FIN_KEY = "ns_finance";

export interface FinMonth { m: string; period: string; ca: number; charges: number; draw?: number }
export interface OpexLine { poste: string; montant: number }
export interface FinModel {
  scenario: "A" | "B";
  startCash: number;
  capitalInjection: number;
  injectionMonth: number; // 1-indexé
  scenarios: Record<"A" | "B", { label: string; months: FinMonth[] }>;
  opexRI: OpexLine[];
  opexSarl: OpexLine[];
  financement: OpexLine[];
}

export interface FinRow {
  m: string; period: string; ca: number; charges: number;
  ebitda: number; draw: number; injection: number; treso: number;
}

// Format CHF avec apostrophe de milliers (style suisse), arrondi à l'entier.
export function chf(n: number): string {
  const r = Math.round(Number(n) || 0);
  const neg = r < 0;
  const s = Math.abs(r).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return (neg ? "−" : "") + s;
}

// Calcule les 12 lignes (EBITDA + trésorerie cumulée) du scénario actif.
export function financeCompute(f: FinModel): FinRow[] {
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

export function financeKpis(rows: FinRow[]) {
  const caTot = rows.reduce((s, r) => s + r.ca, 0);
  const chTot = rows.reduce((s, r) => s + r.charges, 0);
  const drawTot = rows.reduce((s, r) => s + r.draw, 0);
  const be = rows.find((r) => r.ebitda >= 0);
  return {
    caTot, chTot, drawTot, ebTot: caTot - chTot,
    tresoMin: rows.length ? Math.min(...rows.map((r) => r.treso)) : 0,
    tresoMax: rows.length ? Math.max(...rows.map((r) => r.treso)) : 0,
    be: be ? `${be.m} · ${be.period}` : "—",
  };
}

// Charge le budget enregistré localement (ou null si aucun).
export function loadFinanceModel(): FinModel | null {
  return loadLocal<FinModel | null>(FIN_KEY, null);
}

// Résumé texte du budget réel — destiné à la section financière du Business Plan.
// Reprend les VRAIS chiffres saisis dans Finances (aucune invention).
export function buildBudgetMarkdown(f: FinModel): string {
  const rows = financeCompute(f);
  const k = financeKpis(rows);
  const sc = f.scenarios[f.scenario];
  const L: string[] = [];

  L.push(`BUDGET PRÉVISIONNEL — Scénario ${f.scenario} (${sc?.label ?? ""}), 12 mois.`);
  L.push(`Trésorerie de départ : ${chf(f.startCash)} CHF.`);
  if ((Number(f.capitalInjection) || 0) > 0 && (Number(f.injectionMonth) || 0) > 0) {
    L.push(`Injection de capital : ${chf(f.capitalInjection)} CHF au mois M${f.injectionMonth}.`);
  }
  L.push("");
  L.push("Détail mensuel (CA · charges · EBITDA · trésorerie) :");
  rows.forEach((r) => {
    L.push(`- ${r.m} (${r.period}) : CA ${chf(r.ca)} · charges ${chf(r.charges)} · EBITDA ${chf(r.ebitda)} · trésorerie ${chf(r.treso)} CHF`);
  });
  L.push("");
  L.push(`Totaux 12 mois : CA ${chf(k.caTot)} CHF · charges ${chf(k.chTot)} CHF · EBITDA ${chf(k.ebTot)} CHF.`);
  L.push(`Trésorerie : plancher ${chf(k.tresoMin)} CHF · pic ${chf(k.tresoMax)} CHF. Premier mois EBITDA positif : ${k.be}.`);

  const opex = (label: string, lines: OpexLine[]) => {
    const filled = lines.filter((l) => (Number(l.montant) || 0) !== 0);
    if (!filled.length) return;
    const tot = filled.reduce((s, l) => s + (Number(l.montant) || 0), 0);
    L.push("");
    L.push(`${label} (CHF/mois) :`);
    filled.forEach((l) => L.push(`- ${l.poste} : ${chf(l.montant)}`));
    L.push(`Total : ${chf(tot)} CHF/mois.`);
  };
  opex("Budget d'exploitation — Raison Individuelle", f.opexRI);
  opex("Budget d'exploitation — Sàrl", f.opexSarl);

  const fin = f.financement.filter((l) => (Number(l.montant) || 0) !== 0);
  if (fin.length) {
    const tot = fin.reduce((s, l) => s + (Number(l.montant) || 0), 0);
    L.push("");
    L.push("Plan de financement :");
    fin.forEach((l) => L.push(`- ${l.poste} : ${chf(l.montant)} CHF`));
    L.push(`Total : ${chf(tot)} CHF.`);
  }

  return L.join("\n");
}
