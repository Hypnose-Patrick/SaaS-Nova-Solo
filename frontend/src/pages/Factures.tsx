import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { KpiCard } from "@/components/ui/KpiCard";
import { useUserStore } from "@/stores/useUserStore";
import { supabase } from "@/lib/supabase";
import type { Invoice } from "@/types";

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
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [lines, setLines] = useState<LineItem[]>([{ description: "", qty: 1, unit_price: 0 }]);
  const [saving, setSaving] = useState(false);

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

  async function createInvoice() {
    if (!profile?.id || !clientName.trim()) return;
    setSaving(true);
    const num = `INV-${Date.now().toString().slice(-6)}`;
    const ht = amountHt();
    const ttc = amountTtc();
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

    if (data) setInvoices((prev) => [data as Invoice, ...prev]);
    setClientName("");
    setClientEmail("");
    setLines([{ description: "", qty: 1, unit_price: 0 }]);
    setShowForm(false);
    setSaving(false);
  }

  async function updateStatus(id: string, status: Invoice["status"]) {
    await supabase.from("invoices").update({ status }).eq("id", id);
    setInvoices((inv) => inv.map((i) => (i.id === id ? { ...i, status } : i)));
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
        <Button size="sm" variant="gold" onClick={() => setShowForm(!showForm)}>
          + Nouvelle facture
        </Button>
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
            Nouvelle facture
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
            <Button size="sm" variant="gold" loading={saving} onClick={createInvoice}>Créer la facture</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Annuler</Button>
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
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr 120px 120px 140px", gap: "var(--space-4)", padding: "var(--space-2) var(--space-4)", borderBottom: "var(--border-subtle)" }}>
              {["N°", "Client", "Email", "Date", "Montant TTC", "Statut"].map((h) => (
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
                  gridTemplateColumns: "120px 1fr 1fr 120px 120px 140px",
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
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
