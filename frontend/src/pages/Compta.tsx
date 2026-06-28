import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { KpiCard } from "@/components/ui/KpiCard";
import { useUserStore } from "@/stores/useUserStore";
import { useAppStore } from "@/stores/useAppStore";
import { supabase } from "@/lib/supabase";
import { extractReceipt, ocrReceipt, extractStatement } from "@/lib/ai";
import type { ComptaEntry } from "@/types";

const MONTHS_FR = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

const CATEGORIES_REVENU = [
  "Coaching", "Formation", "Consulting", "Conférence",
  "Produit numérique", "Autre",
];
const CATEGORIES_DEPENSE = [
  "Loyer / bureau", "Assurances", "Téléphone / internet", "Marketing",
  "Formation", "Matériel / équipement", "Transport",
  "Restaurant / représentation", "Honoraires", "Logiciels / abonnements", "Autre",
];

function formatChf(n: number) {
  return n.toLocaleString("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 2 });
}

interface NewEntry {
  date: string;
  description: string;
  amount: string;
  type: "revenu" | "depense";
  tva: string;
  fournisseur: string;
  category: string;
}

const EMPTY_FORM: NewEntry = {
  date: new Date().toISOString().slice(0, 10),
  description: "",
  amount: "",
  type: "depense",
  tva: "",
  fournisseur: "",
  category: "",
};

const YEARS = [2024, 2025, 2026, 2027];

export function Compta() {
  const profile = useUserStore((s) => s.profile);
  const { compta, fetchCompta } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "revenu" | "depense">("all");
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<number | "all">("all");
  const [form, setForm] = useState<NewEntry>(EMPTY_FORM);

  // Scan de reçu (IA) + import/export CSV
  const [receiptText, setReceiptText] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [photoScanning, setPhotoScanning] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (profile?.id) fetchCompta(profile.id);
  }, [profile?.id]);

  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const { monthRevenu, monthDepense } = useMemo(() => {
    const m = compta.filter((e) => e.date.startsWith(currentMonthPrefix));
    return {
      monthRevenu:  m.filter((e) => e.type === "revenu").reduce((s, e) => s + e.amount, 0),
      monthDepense: m.filter((e) => e.type === "depense").reduce((s, e) => s + e.amount, 0),
    };
  }, [compta, currentMonthPrefix]);

  const filtered = useMemo(() => {
    return compta.filter((e) => {
      if (filterType !== "all" && e.type !== filterType) return false;
      if (!e.date.startsWith(String(filterYear))) return false;
      if (filterMonth !== "all") {
        const prefix = `${filterYear}-${String((filterMonth as number) + 1).padStart(2, "0")}`;
        if (!e.date.startsWith(prefix)) return false;
      }
      return true;
    });
  }, [compta, filterType, filterYear, filterMonth]);

  const filteredRevenu  = filtered.filter((e) => e.type === "revenu").reduce((s, e) => s + e.amount, 0);
  const filteredDepense = filtered.filter((e) => e.type === "depense").reduce((s, e) => s + e.amount, 0);

  function setF(patch: Partial<NewEntry>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function addEntry() {
    if (!profile?.id || !form.amount || !form.date) return;
    setSaving(true);
    const { data } = await supabase
      .from("compta_entries")
      .insert({
        profile_id:  profile.id,
        date:        form.date,
        description: form.description || null,
        amount:      parseFloat(form.amount),
        type:        form.type,
        tva:         form.tva ? parseFloat(form.tva) : null,
        fournisseur: form.fournisseur || null,
        category:    form.category || null,
      })
      .select()
      .single();

    if (data) {
      useAppStore.setState((s) => ({
        compta: [data as ComptaEntry, ...s.compta].sort((a, b) => b.date.localeCompare(a.date)),
      }));
    }
    setForm({ ...EMPTY_FORM, type: form.type });
    setShowForm(false);
    setSaving(false);
  }

  async function deleteEntry(id: string) {
    await supabase.from("compta_entries").delete().eq("id", id);
    useAppStore.setState((s) => ({ compta: s.compta.filter((e) => e.id !== id) }));
  }

  // Scan de reçu par IA → préremplit le formulaire de saisie
  async function scanReceipt() {
    const text = receiptText.trim();
    if (!text) return;
    setScanning(true);
    setScanMsg(null);
    try {
      const allCats = [...CATEGORIES_REVENU, ...CATEGORIES_DEPENSE];
      const r = await extractReceipt(text, allCats, profile ?? {});
      setForm({
        date: r.date ?? new Date().toISOString().slice(0, 10),
        description: r.fournisseur ?? "",
        amount: r.montant != null ? String(r.montant) : "",
        type: r.type,
        tva: r.tva != null ? String(r.tva) : "",
        fournisseur: r.fournisseur ?? "",
        category: r.categorie ?? "",
      });
      setShowForm(true);
      setScanMsg(
        `Extrait : ${r.montant != null ? formatChf(r.montant) : "montant ?"}` +
          `${r.fournisseur ? ` · ${r.fournisseur}` : ""}${r.date ? ` · ${r.date}` : ""}. ` +
          `Vérifiez et enregistrez.`,
      );
    } catch {
      setScanMsg("Extraction impossible — réessayez ou saisissez manuellement.");
    }
    setScanning(false);
  }

  // Scan PHOTO d'une quittance : upload dans le bucket privé puis OCR vision IA.
  async function scanReceiptPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !profile?.user_id) return;
    if (!file.type.startsWith("image/")) { setScanMsg("Choisissez une image (JPG, PNG…)."); return; }
    setPhotoScanning(true);
    setScanMsg("Lecture de la quittance…");
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${profile.user_id}/receipts/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("nova-docs").upload(path, file, { upsert: true });
      if (upErr) throw new Error(upErr.message);
      const r = await ocrReceipt(path);
      const cat = r.categorie && CATEGORIES_DEPENSE.find((c) => c.toLowerCase() === r.categorie!.toLowerCase());
      setForm({
        date: r.date ?? new Date().toISOString().slice(0, 10),
        description: r.fournisseur ?? "",
        amount: r.montant_ttc != null ? String(r.montant_ttc) : "",
        type: "depense",
        tva: r.tva_taux != null ? String(r.tva_taux) : "",
        fournisseur: r.fournisseur ?? "",
        category: cat || "",
      });
      setShowForm(true);
      const conf = Math.round((r.confiance ?? 0) * 100);
      setScanMsg(
        `Extrait : ${r.montant_ttc != null ? formatChf(r.montant_ttc) : "montant ?"}` +
          `${r.fournisseur ? ` · ${r.fournisseur}` : ""}${r.date ? ` · ${r.date}` : ""}` +
          `${conf ? ` (confiance ${conf}%)` : ""}. Vérifiez et enregistrez.`,
      );
    } catch (err) {
      setScanMsg(`OCR photo indisponible (${err instanceof Error ? err.message : "erreur"}). Utilisez le collage de texte ci-contre.`);
    }
    setPhotoScanning(false);
  }

  // Import d'un relevé bancaire CSV (Date / Description / Montant, séparateur ; , ou tab)
  async function importBankCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !profile?.id) return;
    setImporting(true);
    setImportMsg(null);
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const rows: Array<Omit<ComptaEntry, "id" | "created_at">> = [];
    let skipped = 0;
    lines.forEach((line, i) => {
      if (i === 0 && /date/i.test(line)) return; // en-tête
      const parts = line.split(/[;,\t]/).map((p) => p.trim().replace(/^"|"$/g, ""));
      if (parts.length < 3) { skipped++; return; }
      let rawDate = parts[0];
      let rawDesc = parts[1];
      let rawAmt = parts[2].replace(/['\s ]/g, "").replace("−", "-").replace(",", ".");
      // Certaines banques inversent description/montant
      if (isNaN(parseFloat(rawAmt)) && !isNaN(parseFloat(rawDesc))) {
        const tmp = rawDesc; rawDesc = rawAmt; rawAmt = tmp.replace(/['\s ]/g, "").replace("−", "-").replace(",", ".");
      }
      const amount = parseFloat(rawAmt);
      if (!amount || !rawDate) { skipped++; return; }
      // Date DD.MM.YYYY → YYYY-MM-DD
      const dm = rawDate.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (dm) rawDate = `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
      rows.push({
        profile_id: profile.id,
        date: rawDate,
        description: rawDesc || "Import bancaire",
        amount: Math.abs(amount),
        type: amount >= 0 ? "revenu" : "depense",
        tva: null,
        fournisseur: null,
        category: null,
        receipt_url: null,
      });
    });
    if (rows.length === 0) {
      setImportMsg("Aucune ligne reconnue. Format attendu : Date ; Description ; Montant.");
      setImporting(false);
      return;
    }
    const { data } = await supabase.from("compta_entries").insert(rows).select();
    if (data) {
      useAppStore.setState((s) => ({
        compta: [...(data as ComptaEntry[]), ...s.compta].sort((a, b) => b.date.localeCompare(a.date)),
      }));
    }
    setImportMsg(`${rows.length} écriture${rows.length > 1 ? "s" : ""} importée${rows.length > 1 ? "s" : ""}${skipped ? ` · ${skipped} ignorée${skipped > 1 ? "s" : ""}` : ""}.`);
    setImporting(false);
  }

  // Extrait le texte d'un PDF côté navigateur (pdfjs, chargé à la demande).
  async function pdfToText(file: File): Promise<string> {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    let text = "";
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      text += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
    }
    return text;
  }

  // Import d'un relevé bancaire PDF : texte extrait du PDF puis transactions
  // identifiées par l'agent financier (gère la diversité des formats de banques).
  async function importBankPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !profile?.id) return;
    setImporting(true);
    setImportMsg("Lecture du PDF…");
    try {
      const text = await pdfToText(file);
      if (text.replace(/\s/g, "").length < 20) {
        setImportMsg("PDF sans texte exploitable (probablement scanné). Exportez un CSV depuis votre banque, ou utilisez « Photo de quittance » pour un reçu unique.");
        setImporting(false);
        return;
      }
      setImportMsg("Analyse des transactions (IA)…");
      const txs = await extractStatement(text, profile ?? {});
      if (txs.length === 0) {
        setImportMsg("Aucune transaction détectée dans ce PDF.");
        setImporting(false);
        return;
      }
      const rows: Array<Omit<ComptaEntry, "id" | "created_at">> = txs.map((t) => ({
        profile_id: profile.id,
        date: t.date,
        description: t.description || "Import bancaire",
        amount: Math.abs(t.amount),
        type: t.amount >= 0 ? "revenu" : "depense",
        tva: null,
        fournisseur: null,
        category: null,
        receipt_url: null,
      }));
      const { data } = await supabase.from("compta_entries").insert(rows).select();
      if (data) {
        useAppStore.setState((s) => ({
          compta: [...(data as ComptaEntry[]), ...s.compta].sort((a, b) => b.date.localeCompare(a.date)),
        }));
      }
      setImportMsg(`${rows.length} transaction${rows.length > 1 ? "s" : ""} importée${rows.length > 1 ? "s" : ""} depuis le PDF. Vérifiez et corrigez si besoin.`);
    } catch (err) {
      setImportMsg(`Lecture du PDF impossible (${err instanceof Error ? err.message : "erreur"}).`);
    }
    setImporting(false);
  }

  // Export CSV des écritures filtrées (sécurisé contre l'injection de formules)
  function csvField(s: string | number): string {
    const v = String(s ?? "");
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  }
  function exportCsv() {
    if (filtered.length === 0) return;
    const header = ["Date", "Type", "Montant CHF", "Description", "Fournisseur/Client", "Catégorie", "TVA %"];
    const body = filtered.map((e) =>
      [e.date, e.type === "revenu" ? "Revenu" : "Dépense", e.amount.toFixed(2),
       e.description ?? "", e.fournisseur ?? "", e.category ?? "", e.tva != null ? String(e.tva) : ""]
        .map(csvField).join(";"),
    );
    const csv = "﻿" + [header.map(csvField).join(";"), ...body].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `compta_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const categories = form.type === "revenu" ? CATEGORIES_REVENU : CATEGORIES_DEPENSE;
  const solde = monthRevenu - monthDepense;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 400, color: "var(--color-text-primary)", margin: 0 }}>
            Comptabilité
          </h2>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", marginTop: "var(--space-1)" }}>
            Saisie des revenus et dépenses. Alimentez les graphes Finances.
          </p>
        </div>
        <Button size="sm" variant="gold" onClick={() => setShowForm(!showForm)}>
          + Saisir
        </Button>
      </div>

      {/* KPIs mois courant */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)" }}>
        <KpiCard label={`Revenus ${MONTHS_FR[now.getMonth()]}`} value={formatChf(monthRevenu)} trend="up" />
        <KpiCard label={`Dépenses ${MONTHS_FR[now.getMonth()]}`} value={formatChf(monthDepense)} trend="flat" />
        <KpiCard label={`Solde ${MONTHS_FR[now.getMonth()]}`} value={formatChf(solde)} trend={solde >= 0 ? "up" : "down"} />
      </div>

      {/* Formulaire */}
      {showForm && (
        <Card glass>
          <p style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-text-primary)", marginBottom: "var(--space-4)" }}>
            Nouvelle écriture
          </p>

          {/* Toggle revenu / dépense */}
          <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
            {(["depense", "revenu"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setF({ type: t, category: "" })}
                style={{
                  padding: "var(--space-2) var(--space-4)",
                  borderRadius: "var(--radius-sm)",
                  border: "var(--border-subtle)",
                  background: form.type === t
                    ? t === "revenu" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"
                    : "var(--color-bg-input)",
                  color: form.type === t
                    ? t === "revenu" ? "var(--color-success)" : "var(--color-danger)"
                    : "var(--color-text-muted)",
                  fontSize: "var(--text-sm)",
                  fontWeight: form.type === t ? 600 : 400,
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                  transition: "all var(--transition-fast)",
                }}
              >
                {t === "revenu" ? "Revenu" : "Dépense"}
              </button>
            ))}
          </div>

          {/* Ligne 1 : date, montant, TVA */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
            <Input
              label="Date *"
              type="date"
              value={form.date}
              onChange={(e) => setF({ date: e.target.value })}
            />
            <Input
              label="Montant CHF *"
              type="number"
              min="0"
              step="0.05"
              value={form.amount}
              onChange={(e) => setF({ amount: e.target.value })}
              placeholder="250.00"
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <label style={{ fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
                TVA
              </label>
              <select
                value={form.tva}
                onChange={(e) => setF({ tva: e.target.value })}
                style={{ background: "var(--color-bg-input)", border: "var(--border-subtle)", borderRadius: "var(--radius-sm)", color: form.tva ? "var(--color-text-primary)" : "var(--color-text-muted)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", padding: "var(--space-3) var(--space-4)", outline: "none" }}
              >
                <option value="">Exonéré / non applicable</option>
                <option value="8.1">8.1 % — standard</option>
                <option value="3.8">3.8 % — hôtellerie</option>
                <option value="2.6">2.6 % — alimentaire</option>
              </select>
            </div>
          </div>

          {/* Ligne 2 : description, fournisseur, catégorie */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
            <Input
              label="Description"
              value={form.description}
              onChange={(e) => setF({ description: e.target.value })}
              placeholder="Séance coaching"
            />
            <Input
              label={form.type === "revenu" ? "Client / source" : "Fournisseur"}
              value={form.fournisseur}
              onChange={(e) => setF({ fournisseur: e.target.value })}
              placeholder={form.type === "revenu" ? "Entreprise SA" : "Amazon"}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <label style={{ fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
                Catégorie
              </label>
              <select
                value={form.category}
                onChange={(e) => setF({ category: e.target.value })}
                style={{ background: "var(--color-bg-input)", border: "var(--border-subtle)", borderRadius: "var(--radius-sm)", color: form.category ? "var(--color-text-primary)" : "var(--color-text-muted)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", padding: "var(--space-3) var(--space-4)", outline: "none" }}
              >
                <option value="">— Catégorie —</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <Button size="sm" variant="gold" loading={saving} onClick={addEntry}>
              Enregistrer
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Annuler
            </Button>
          </div>
        </Card>
      )}

      {/* Scan reçu IA + import / export CSV */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
        <Card glass title="Scanner un reçu (IA)">
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: "0 0 var(--space-3)" }}>
            Photographiez une quittance ou collez son texte — Nova en extrait montant, date, fournisseur, TVA et catégorie, puis préremplit la saisie.
          </p>
          <textarea
            value={receiptText}
            onChange={(e) => setReceiptText(e.target.value)}
            rows={4}
            placeholder={"Migros — 22.06.2026\nFournitures bureau\nTotal CHF 34.80 (TVA 8.1% incluse)"}
            style={{ width: "100%", boxSizing: "border-box", background: "var(--color-bg-input)", border: "var(--border-subtle)", borderRadius: "var(--radius-sm)", color: "var(--color-text-primary)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", padding: "var(--space-3)", outline: "none", resize: "vertical", marginBottom: "var(--space-3)" }}
          />
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
            <Button size="sm" variant="gold" loading={scanning} disabled={!receiptText.trim() || photoScanning} onClick={scanReceipt}>
              Extraire le texte
            </Button>
            <label style={{ display: "inline-flex" }}>
              <input type="file" accept="image/*" capture="environment" onChange={scanReceiptPhoto} style={{ display: "none" }} disabled={photoScanning || scanning} />
              <span style={{ display: "inline-flex", alignItems: "center", padding: "var(--space-2) var(--space-4)", borderRadius: "var(--radius-sm)", border: "var(--border-subtle)", background: "var(--color-bg-input)", color: "var(--color-text-secondary)", fontSize: "var(--text-sm)", cursor: photoScanning ? "wait" : "pointer", opacity: photoScanning ? 0.6 : 1 }}>
                {photoScanning ? "Lecture…" : "📷 Photo de quittance"}
              </span>
            </label>
          </div>
          {scanMsg && (
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", margin: "var(--space-3) 0 0", lineHeight: "var(--leading-relaxed)" }}>
              {scanMsg}
            </p>
          )}
        </Card>

        <Card glass title="Import / export">
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: "0 0 var(--space-3)" }}>
            Importez un relevé bancaire <strong>CSV</strong> (colonnes Date · Description · Montant) ou <strong>PDF</strong>. Le PDF est lu et ses transactions extraites par l'IA. Le signe du montant détermine recette / dépense.
          </p>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <label style={{ display: "inline-flex" }}>
              <input type="file" accept=".csv,.txt" onChange={importBankCsv} style={{ display: "none" }} disabled={importing} />
              <span style={{ display: "inline-flex", alignItems: "center", padding: "var(--space-2) var(--space-4)", borderRadius: "var(--radius-sm)", border: "var(--border-subtle)", background: "var(--color-bg-input)", color: "var(--color-text-secondary)", fontSize: "var(--text-sm)", cursor: importing ? "wait" : "pointer", opacity: importing ? 0.6 : 1 }}>
                {importing ? "Import…" : "📂 Importer CSV"}
              </span>
            </label>
            <label style={{ display: "inline-flex" }}>
              <input type="file" accept="application/pdf,.pdf" onChange={importBankPdf} style={{ display: "none" }} disabled={importing} />
              <span style={{ display: "inline-flex", alignItems: "center", padding: "var(--space-2) var(--space-4)", borderRadius: "var(--radius-sm)", border: "var(--border-subtle)", background: "var(--color-bg-input)", color: "var(--color-text-secondary)", fontSize: "var(--text-sm)", cursor: importing ? "wait" : "pointer", opacity: importing ? 0.6 : 1 }}>
                {importing ? "Import…" : "📄 Importer PDF"}
              </span>
            </label>
            <Button size="sm" variant="ghost" disabled={filtered.length === 0} onClick={exportCsv}>
              ⬇ Exporter ({filtered.length})
            </Button>
          </div>
          {importMsg && (
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", margin: "var(--space-3) 0 0" }}>
              {importMsg}
            </p>
          )}
        </Card>
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
        {(["all", "revenu", "depense"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            style={{
              padding: "var(--space-1) var(--space-3)",
              borderRadius: "var(--radius-xs)",
              border: "var(--border-subtle)",
              background: filterType === t ? "var(--color-gold)" : "transparent",
              color: filterType === t ? "var(--color-bg-primary)" : "var(--color-text-muted)",
              fontSize: "var(--text-xs)",
              fontWeight: filterType === t ? 600 : 400,
              cursor: "pointer",
              fontFamily: "var(--font-body)",
            }}
          >
            {t === "all" ? "Tout" : t === "revenu" ? "Revenus" : "Dépenses"}
          </button>
        ))}

        <select
          value={filterYear}
          onChange={(e) => setFilterYear(Number(e.target.value))}
          style={{ background: "var(--color-bg-input)", border: "var(--border-subtle)", borderRadius: "var(--radius-sm)", color: "var(--color-text-muted)", fontFamily: "var(--font-body)", fontSize: "var(--text-xs)", padding: "var(--space-1) var(--space-3)", outline: "none" }}
        >
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value === "all" ? "all" : Number(e.target.value))}
          style={{ background: "var(--color-bg-input)", border: "var(--border-subtle)", borderRadius: "var(--radius-sm)", color: "var(--color-text-muted)", fontFamily: "var(--font-body)", fontSize: "var(--text-xs)", padding: "var(--space-1) var(--space-3)", outline: "none" }}
        >
          <option value="all">Tous les mois</option>
          {MONTHS_FR.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>

        {filtered.length > 0 && (
          <span style={{ marginLeft: "auto", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
            <span style={{ color: "var(--color-success)" }}>+{formatChf(filteredRevenu)}</span>
            {" · "}
            <span style={{ color: "var(--color-danger)" }}>-{formatChf(filteredDepense)}</span>
            {" · "}
            {filtered.length} écriture{filtered.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Tableau */}
      <Card glass>
        {filtered.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", textAlign: "center", padding: "var(--space-8)" }}>
            Aucune écriture pour cette période.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 1fr 130px 110px 70px 36px", gap: "var(--space-3)", padding: "var(--space-2) var(--space-3)", borderBottom: "var(--border-subtle)" }}>
              {["Date", "Description", "Fournisseur / Client", "Catégorie", "Montant", "TVA", ""].map((h) => (
                <span key={h} style={{ fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
                  {h}
                </span>
              ))}
            </div>

            {filtered.map((e) => (
              <div
                key={e.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "90px 1fr 1fr 130px 110px 70px 36px",
                  gap: "var(--space-3)",
                  padding: "var(--space-3)",
                  borderBottom: "var(--border-subtle)",
                  alignItems: "center",
                }}
              >
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                  {e.date}
                </span>
                <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {e.description ?? "—"}
                </span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {e.fournisseur ?? "—"}
                </span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {e.category ?? "—"}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", fontWeight: 500, color: e.type === "revenu" ? "var(--color-success)" : "var(--color-danger)" }}>
                  {e.type === "revenu" ? "+" : "-"}{formatChf(e.amount)}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                  {e.tva != null ? `${e.tva}%` : "—"}
                </span>
                <button
                  onClick={() => deleteEntry(e.id)}
                  title="Supprimer"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", fontSize: 11, padding: 2, opacity: 0.4, lineHeight: 1 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
