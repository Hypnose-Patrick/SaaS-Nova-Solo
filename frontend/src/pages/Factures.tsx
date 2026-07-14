import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { KpiCard } from "@/components/ui/KpiCard";
import { useUserStore } from "@/stores/useUserStore";
import { useAppStore } from "@/stores/useAppStore";
import { useSubscription, exportLockInfo } from "@/lib/useSubscription";
import { DocumentPreview } from "@/components/DocumentPreview";
import { supabase } from "@/lib/supabase";
import { printHtml, downloadWord, escapeHtml } from "@/lib/exportDoc";
import { unlockShare } from "@/lib/referral";
import type { ComptaEntry, Invoice } from "@/types";

const STATUS_LABEL: Record<Invoice["status"], string> = {
  draft: "Brouillon",
  sent:  "Envoyée",
  paid:  "Payée",
};
const STATUS_COLOR: Record<Invoice["status"], "muted" | "warning" | "success"> = {
  draft: "muted",
  sent:  "warning",
  paid:  "success",
};

const TVA_CH = 8.1;

function formatChf(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("fr-CH", { style: "currency", currency: "CHF", minimumFractionDigits: 2 });
}

interface LineItem {
  description: string;
  qty: number;
  unit_price: number;
}

export function Factures() {
  const profile = useUserStore((s) => s.profile);
  const navigate = useNavigate();
  const { isActive, canExport, account } = useSubscription();
  const exportLock = exportLockInfo(account);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [lines, setLines] = useState<LineItem[]>([{ description: "", qty: 1, unit_price: 0 }]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from("invoices")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setInvoices((data ?? []) as Invoice[]);
        setLoading(false);
      });
  }, [profile?.id]);

  function amountHt() {
    return lines.reduce((s, l) => s + l.qty * l.unit_price, 0);
  }
  function amountTtc() {
    const ht = amountHt();
    return ht * (1 + TVA_CH / 100);
  }

  function addLine() {
    setLines((l) => [...l, { description: "", qty: 1, unit_price: 0 }]);
  }
  function removeLine(i: number) {
    setLines((l) => l.filter((_, idx) => idx !== i));
  }
  function updateLine(i: number, field: keyof LineItem, value: string | number) {
    setLines((l) => l.map((line, idx) => (idx === i ? { ...line, [field]: value } : line)));
  }

  function resetForm() {
    setClientName("");
    setClientEmail("");
    setLines([{ description: "", qty: 1, unit_price: 0 }]);
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(inv: Invoice) {
    setEditingId(inv.id);
    setClientName(inv.client_name ?? "");
    setClientEmail(inv.client_email ?? "");
    setLines(inv.items && inv.items.length > 0 ? inv.items : [{ description: "", qty: 1, unit_price: 0 }]);
    setShowForm(true);
  }

  async function saveInvoice() {
    if (!profile?.id || !clientName.trim()) return;
    setSaving(true);
    const ht = amountHt();
    const ttc = amountTtc();

    if (editingId) {
      const patch = {
        client_name: clientName,
        client_email: clientEmail || null,
        amount_ht: ht,
        tva_rate: TVA_CH,
        amount_ttc: ttc,
        items: lines,
      };
      const { data } = await supabase.from("invoices").update(patch).eq("id", editingId).select().single();
      if (data) setInvoices((prev) => prev.map((i) => (i.id === editingId ? (data as Invoice) : i)));
    } else {
      const num = `INV-${Date.now().toString().slice(-6)}`;
      const { data } = await supabase
        .from("invoices")
        .insert({
          profile_id: profile.id,
          number: num,
          client_name: clientName,
          client_email: clientEmail || null,
          date: new Date().toISOString().slice(0, 10),
          amount_ht: ht,
          tva_rate: TVA_CH,
          amount_ttc: ttc,
          items: lines,
          status: "draft",
        })
        .select()
        .single();
      if (data) {
        setInvoices((prev) => [data as Invoice, ...prev]);
        // Parrainage : 1re facture créée -> débloque le module de partage (idempotent).
        void unlockShare("first_invoice_sent");
      }
    }

    resetForm();
    setSaving(false);
  }

  async function updateStatus(id: string, status: Invoice["status"]) {
    await supabase.from("invoices").update({ status }).eq("id", id);
    setInvoices((inv) => inv.map((i) => (i.id === id ? { ...i, status } : i)));
    if (status === "paid") await recordPaymentInCompta(id);
  }

  // Comptabilité de caisse : le revenu n'est comptabilisé qu'à l'encaissement
  // (statut "paid"), jamais à l'envoi — sinon une facture envoyée puis jamais
  // payée gonflerait le compte d'exploitation. invoice_id est UNIQUE en base
  // (migration 017) : ce garde-fou applicatif + la contrainte DB empêchent
  // toute écriture en double si le statut est re-déclenché.
  async function recordPaymentInCompta(invoiceId: string) {
    if (!profile?.id) return;
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return;

    const { data: existing } = await supabase
      .from("compta_entries")
      .select("id")
      .eq("invoice_id", invoiceId)
      .maybeSingle();
    if (existing) return;

    const { data } = await supabase
      .from("compta_entries")
      .insert({
        profile_id: profile.id,
        invoice_id: invoiceId,
        date: new Date().toISOString().slice(0, 10),
        description: `Facture ${inv.number}${inv.client_name ? ` — ${inv.client_name}` : ""}`,
        amount: inv.amount_ttc ?? 0,
        type: "revenu",
        tva: inv.tva_rate,
        fournisseur: inv.client_name,
        category: "Facturation client",
      })
      .select()
      .single();

    if (data) {
      useAppStore.setState((s) => ({
        compta: [data as ComptaEntry, ...s.compta].sort((a, b) => b.date.localeCompare(a.date)),
      }));
    }
  }

  async function deleteInvoice(inv: Invoice) {
    // Vérifié en base (pas via le store local, qui peut être vide si l'onglet
    // Comptabilité n'a pas encore été ouvert dans la session) — la facture "Payée"
    // a forcément une écriture liée (créée par recordPaymentInCompta) sinon.
    const { data: linked } = await supabase
      .from("compta_entries")
      .select("id")
      .eq("invoice_id", inv.id)
      .maybeSingle();

    const warning = linked
      ? `Supprimer la facture ${inv.number} (${inv.client_name ?? "client"}) ? L'écriture comptable liée (revenu encaissé) sera supprimée aussi. Cette action est irréversible.`
      : `Supprimer la facture ${inv.number} (${inv.client_name ?? "client"}) ? Cette action est irréversible.`;
    if (!window.confirm(warning)) return;

    await supabase.from("invoices").delete().eq("id", inv.id);
    if (linked) await supabase.from("compta_entries").delete().eq("invoice_id", inv.id);
    setInvoices((prev) => prev.filter((i) => i.id !== inv.id));
    useAppStore.setState((s) => ({ compta: s.compta.filter((e) => e.invoice_id !== inv.id) }));
    if (editingId === inv.id) resetForm();
  }

  // Export PDF/Word d'une facture individuelle — réservé aux abonnés (même règle que CV/Business plan/Dossier).
  function buildInvoiceHtml(inv: Invoice): string {
    const company = profile?.brand_name || profile?.name || "Indépendant·e";
    const items = inv.items ?? [];
    const rows = items
      .map(
        (it) =>
          `<tr><td>${escapeHtml(it.description)}</td>` +
          `<td style="text-align:right">${it.qty}</td>` +
          `<td style="text-align:right">${formatChf(it.unit_price)}</td>` +
          `<td style="text-align:right">${formatChf(it.qty * it.unit_price)}</td></tr>`,
      )
      .join("");
    const tva = (inv.amount_ttc ?? 0) - (inv.amount_ht ?? 0);

    return (
      `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Facture ${escapeHtml(inv.number)}</title>` +
      `<style>
        body{font-family:Calibri,Arial,sans-serif;max-width:760px;margin:32px auto;padding:0 24px;color:#1a1a1a;font-size:13px}
        .head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px}
        h1{font-size:20px;margin:0 0 4px}
        .muted{color:#666;font-size:12px}
        .block{margin-bottom:24px}
        table{width:100%;border-collapse:collapse;margin-bottom:16px}
        th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#666;border-bottom:1px solid #ccc;padding:6px 4px}
        td{padding:6px 4px;border-bottom:1px solid #eee}
        .totals{margin-left:auto;width:260px}
        .totals div{display:flex;justify-content:space-between;padding:4px 0}
        .totals .total{font-weight:700;font-size:15px;border-top:1px solid #333;padding-top:8px;margin-top:4px}
      </style></head><body>` +
      `<div class="head">` +
      `<div><h1>${escapeHtml(company)}</h1>` +
      (profile?.contact_adresse ? `<div class="muted">${escapeHtml(profile.contact_adresse)}</div>` : "") +
      (profile?.contact_email ? `<div class="muted">${escapeHtml(profile.contact_email)}</div>` : "") +
      (profile?.contact_tel ? `<div class="muted">${escapeHtml(profile.contact_tel)}</div>` : "") +
      `</div>` +
      `<div style="text-align:right">` +
      `<h1>Facture ${escapeHtml(inv.number)}</h1>` +
      `<div class="muted">Date : ${escapeHtml(inv.date)}</div>` +
      `<div class="muted">Statut : ${escapeHtml(STATUS_LABEL[inv.status])}</div>` +
      `</div></div>` +
      `<div class="block"><div class="muted" style="text-transform:uppercase;font-size:11px;letter-spacing:.05em;margin-bottom:4px">Facturé à</div>` +
      `<div>${escapeHtml(inv.client_name || "—")}</div>` +
      (inv.client_email ? `<div class="muted">${escapeHtml(inv.client_email)}</div>` : "") +
      `</div>` +
      `<table><thead><tr><th>Description</th><th style="text-align:right">Qté</th><th style="text-align:right">Prix unit.</th><th style="text-align:right">Total</th></tr></thead>` +
      `<tbody>${rows}</tbody></table>` +
      `<div class="totals">` +
      `<div><span>Sous-total HT</span><span>${formatChf(inv.amount_ht)}</span></div>` +
      `<div><span>TVA ${inv.tva_rate}%</span><span>${formatChf(tva)}</span></div>` +
      `<div class="total"><span>Total TTC</span><span>${formatChf(inv.amount_ttc)}</span></div>` +
      `</div></body></html>`
    );
  }

  function exportInvoicePdf(inv: Invoice) {
    if (!canExport) {
      if (isActive) setPreviewInvoice(inv); else navigate("/settings");
      return;
    }
    printHtml(buildInvoiceHtml(inv));
  }
  function exportInvoiceWord(inv: Invoice) {
    if (!canExport) {
      if (isActive) setPreviewInvoice(inv); else navigate("/settings");
      return;
    }
    downloadWord(`facture-${inv.number}`, buildInvoiceHtml(inv));
  }

  // Export CSV de l'ensemble des factures — réservé aux abonnés actifs (pas pendant l'essai gratuit).
  function csvField(s: string | number): string {
    const v = String(s ?? "");
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  }
  function exportInvoicesCsv() {
    if (!canExport || invoices.length === 0) return;
    const header = ["N°", "Client", "Email", "Date", "Montant HT", "TVA %", "Montant TTC", "Statut"];
    const body = invoices.map((i) =>
      [
        i.number,
        i.client_name ?? "",
        i.client_email ?? "",
        i.date,
        (i.amount_ht ?? 0).toFixed(2),
        String(i.tva_rate),
        (i.amount_ttc ?? 0).toFixed(2),
        STATUS_LABEL[i.status],
      ]
        .map(csvField)
        .join(";"),
    );
    const csv = "﻿" + [header.map(csvField).join(";"), ...body].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `factures_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 150);
  }

  const totalPaid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + (i.amount_ttc ?? 0), 0);
  const totalPending = invoices.filter((i) => i.status === "sent").reduce((s, i) => s + (i.amount_ttc ?? 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 400, color: "var(--color-text-primary)", margin: 0 }}>
            Factures
          </h2>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", marginTop: "var(--space-1)" }}>
            Créez et suivez vos factures clients (TVA {TVA_CH}%).
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <Button
            size="sm"
            variant="ghost"
            disabled={invoices.length === 0 || !canExport}
            title={canExport ? undefined : exportLock.label}
            onClick={exportInvoicesCsv}
          >
            ⬇ Export CSV
          </Button>
          <Button
            size="sm"
            variant="gold"
            onClick={() => {
              if (showForm) resetForm();
              else setShowForm(true);
            }}
          >
            {showForm ? "Annuler" : "+ Nouvelle facture"}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)" }}>
        <KpiCard label="Total encaissé (TTC)" value={formatChf(totalPaid)} trend="up" />
        <KpiCard label="En attente (TTC)" value={formatChf(totalPending)} trend="flat" />
        <KpiCard label="Nombre de factures" value={String(invoices.length)} trend="flat" />
      </div>

      {/* Formulaire création */}
      {showForm && (
        <Card glass>
          <p style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-text-primary)", marginBottom: "var(--space-4)" }}>
            {editingId ? "Modifier la facture" : "Nouvelle facture"}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
            <Input label="Client *" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Société SA" />
            <Input label="Email client" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="client@exemple.ch" />
          </div>

          {/* Lignes */}
          <p style={{ fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "var(--space-2)" }}>
            Lignes de facturation
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
            {lines.map((line, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px 120px 32px", gap: "var(--space-2)", alignItems: "center" }}>
                <input
                  value={line.description}
                  onChange={(e) => updateLine(i, "description", e.target.value)}
                  placeholder="Ex : main-d'œuvre, matériel, prestation…"
                  style={{ background: "var(--color-bg-input)", border: "var(--border-subtle)", borderRadius: "var(--radius-sm)", color: "var(--color-text-primary)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", padding: "var(--space-2) var(--space-3)", outline: "none" }}
                />
                <input
                  type="number"
                  min={1}
                  value={line.qty}
                  onChange={(e) => updateLine(i, "qty", parseInt(e.target.value) || 1)}
                  placeholder="Qté"
                  style={{ background: "var(--color-bg-input)", border: "var(--border-subtle)", borderRadius: "var(--radius-sm)", color: "var(--color-text-primary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", padding: "var(--space-2) var(--space-3)", outline: "none", textAlign: "right" }}
                />
                <input
                  type="number"
                  min={0}
                  step={10}
                  value={line.unit_price}
                  onChange={(e) => updateLine(i, "unit_price", parseFloat(e.target.value) || 0)}
                  placeholder="Prix unit."
                  style={{ background: "var(--color-bg-input)", border: "var(--border-subtle)", borderRadius: "var(--radius-sm)", color: "var(--color-text-primary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", padding: "var(--space-2) var(--space-3)", outline: "none", textAlign: "right" }}
                />
                {lines.length > 1 ? (
                  <button
                    onClick={() => removeLine(i)}
                    style={{ background: "none", border: "none", color: "var(--color-text-muted)", cursor: "pointer", fontSize: "var(--text-sm)", padding: "var(--space-1)" }}
                  >
                    ✕
                  </button>
                ) : <span />}
              </div>
            ))}
          </div>

          <Button size="sm" variant="ghost" onClick={addLine} style={{ marginBottom: "var(--space-4)" }}>
            + Ajouter une ligne
          </Button>

          {/* Totaux */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", borderTop: "var(--border-subtle)", paddingTop: "var(--space-4)", marginBottom: "var(--space-4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
              <span>Sous-total HT</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>{formatChf(amountHt())}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
              <span>TVA {TVA_CH}%</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>{formatChf(amountTtc() - amountHt())}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-base)", fontWeight: 600, color: "var(--color-text-primary)", borderTop: "var(--border-subtle)", paddingTop: "var(--space-2)" }}>
              <span>Total TTC</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-gold)" }}>{formatChf(amountTtc())}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <Button size="sm" variant="gold" loading={saving} onClick={saveInvoice}>
              {editingId ? "Enregistrer les modifications" : "Créer la facture"}
            </Button>
            <Button size="sm" variant="ghost" onClick={resetForm}>Annuler</Button>
          </div>
        </Card>
      )}

      {/* Liste factures */}
      {loading ? (
        <p style={{ color: "var(--color-text-muted)" }}>Chargement…</p>
      ) : invoices.length === 0 ? (
        <Card glass>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", textAlign: "center", padding: "var(--space-8)" }}>
            Aucune facture. Créez votre première facture en cliquant sur "+ Nouvelle facture".
          </p>
        </Card>
      ) : (
        <Card glass>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {/* En-tête tableau */}
            <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr 100px 110px 120px 150px", gap: "var(--space-4)", padding: "var(--space-2) var(--space-4)", borderBottom: "var(--border-subtle)" }}>
              {["N°", "Client", "Email", "Date", "Montant TTC", "Statut", "Actions"].map((h) => (
                <span key={h} style={{ fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
                  {h}
                </span>
              ))}
            </div>

            {invoices.map((inv) => (
              <div
                key={inv.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "110px 1fr 1fr 100px 110px 120px 150px",
                  gap: "var(--space-4)",
                  padding: "var(--space-3) var(--space-4)",
                  borderBottom: "var(--border-subtle)",
                  alignItems: "center",
                }}
              >
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                  {inv.number}
                </span>
                <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {inv.client_name ?? "—"}
                </span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {inv.client_email ?? "—"}
                </span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                  {inv.date}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "var(--color-gold)" }}>
                  {formatChf(inv.amount_ttc)}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <Badge color={STATUS_COLOR[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
                  {inv.status === "draft" && (
                    <button
                      onClick={() => updateStatus(inv.id, "sent")}
                      title="Marquer envoyée"
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--color-text-muted)", padding: "2px" }}
                    >
                      ✉
                    </button>
                  )}
                  {inv.status === "sent" && (
                    <button
                      onClick={() => updateStatus(inv.id, "paid")}
                      title="Marquer payée"
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--color-success)", padding: "2px" }}
                    >
                      ✓
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  <button
                    onClick={() => startEdit(inv)}
                    title="Modifier la facture"
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--color-text-muted)", padding: "2px" }}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => deleteInvoice(inv)}
                    title="Supprimer la facture"
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--color-danger)", padding: "2px" }}
                  >
                    🗑
                  </button>
                  <button
                    onClick={() => exportInvoicePdf(inv)}
                    title={canExport ? "Exporter en PDF" : isActive ? `Aperçu — ${exportLock.label}` : exportLock.label}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--color-text-muted)", opacity: canExport ? 1 : 0.5, padding: "2px" }}
                  >
                    🖨
                  </button>
                  <button
                    onClick={() => exportInvoiceWord(inv)}
                    title={canExport ? "Exporter en Word" : isActive ? `Aperçu — ${exportLock.label}` : exportLock.label}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--color-text-muted)", opacity: canExport ? 1 : 0.5, padding: "2px" }}
                  >
                    📝
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {previewInvoice && (
        <DocumentPreview
          html={buildInvoiceHtml(previewInvoice)}
          label={exportLock.label}
          onClose={() => setPreviewInvoice(null)}
        />
      )}
    </div>
  );
}
