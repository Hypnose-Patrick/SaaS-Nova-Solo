import { useState } from "react";
import { useUserStore } from "@/stores/useUserStore";
import { loadLocal, saveLocal } from "@/lib/local";

// Devis express — chiffrer sur le terrain en quelques secondes puis copier /
// envoyer par mail. Autonome, hors-ligne, persisté en local (brouillon).
// TVA suisse 8.1 %, désactivable (indépendant non assujetti < 100'000 CHF).

const TVA = 8.1;

interface Line { d: string; qte: string; pu: string }
interface DevisState { client: string; email: string; tva: boolean; lines: Line[] }
const EMPTY: DevisState = { client: "", email: "", tva: false, lines: [{ d: "", qte: "1", pu: "" }] };

const inp: React.CSSProperties = {
  background: "var(--color-bg-input)", border: "var(--border-subtle)", borderRadius: "var(--radius-sm)",
  color: "var(--color-text-primary)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)",
  padding: "8px 10px", outline: "none", width: "100%", boxSizing: "border-box",
};
const numInp: React.CSSProperties = { ...inp, fontFamily: "var(--font-mono)", textAlign: "right", padding: "8px 6px" };

function chf(n: number): string {
  return n.toLocaleString("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ /g, "’");
}

export function DevisExpress() {
  const profile = useUserStore((s) => s.profile);
  const [st, setSt] = useState<DevisState>(() => loadLocal<DevisState>("ns_devis_express", EMPTY));

  function patch(p: Partial<DevisState>) {
    const next = { ...st, ...p };
    setSt(next); saveLocal("ns_devis_express", next);
  }
  function setLine(i: number, field: keyof Line, v: string) {
    patch({ lines: st.lines.map((l, j) => (j === i ? { ...l, [field]: v } : l)) });
  }
  function addLine() { patch({ lines: [...st.lines, { d: "", qte: "1", pu: "" }] }); }
  function delLine(i: number) { patch({ lines: st.lines.filter((_, j) => j !== i) }); }
  function reset() { setSt(EMPTY); saveLocal("ns_devis_express", EMPTY); }

  const ht = st.lines.reduce((s, l) => s + (Number(l.qte) || 0) * (Number(l.pu) || 0), 0);
  const tva = st.tva ? (ht * TVA) / 100 : 0;
  const ttc = ht + tva;

  function buildText(): string {
    const L: string[] = [];
    L.push(`DEVIS — ${profile?.brand_name || profile?.name || "Nova Solo"}`);
    if (st.client) L.push(`Client : ${st.client}`);
    L.push("");
    st.lines.filter((l) => l.d.trim()).forEach((l) => {
      const q = Number(l.qte) || 0, pu = Number(l.pu) || 0;
      L.push(`• ${l.d} — ${q} × ${chf(pu)} = ${chf(q * pu)} CHF`);
    });
    L.push("");
    L.push(`Sous-total HT : ${chf(ht)} CHF`);
    if (st.tva) L.push(`TVA ${TVA}% : ${chf(tva)} CHF`);
    L.push(`Total${st.tva ? " TTC" : ""} : ${chf(ttc)} CHF`);
    return L.join("\n");
  }

  function copy() { navigator.clipboard?.writeText(buildText()); }
  function send() {
    const subject = encodeURIComponent(`Devis — ${profile?.brand_name || profile?.name || ""}`.trim());
    const body = encodeURIComponent(buildText());
    window.open(`mailto:${st.email || ""}?subject=${subject}&body=${body}`, "_blank");
  }

  const empty = ht <= 0;

  return (
    <div style={{ background: "var(--color-bg-surface)", border: "var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-1)" }}>
        <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-md)", fontWeight: 400, color: "var(--color-text-primary)" }}>Devis express</p>
        {(st.client || ht > 0) && (
          <button onClick={reset} style={{ background: "none", border: "none", color: "var(--color-text-muted)", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>vider</button>
        )}
      </div>
      <p style={{ margin: "0 0 var(--space-3)", fontSize: 11, color: "var(--color-text-muted)", lineHeight: "var(--leading-normal)" }}>
        Chiffre sur place, puis copie ou envoie par mail.
      </p>

      {/* Client */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
        <input value={st.client} onChange={(e) => patch({ client: e.target.value })} placeholder="Client" style={inp} />
        <input value={st.email} onChange={(e) => patch({ email: e.target.value })} placeholder="Email (optionnel)" type="email" style={inp} />
      </div>

      {/* Lignes */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {st.lines.map((l, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 44px 74px 22px", gap: 6, alignItems: "center" }}>
            <input value={l.d} onChange={(e) => setLine(i, "d", e.target.value)} placeholder="Désignation (main-d'œuvre, matériel…)" style={inp} />
            <input value={l.qte} onChange={(e) => setLine(i, "qte", e.target.value)} inputMode="decimal" placeholder="Qté" style={numInp} />
            <input value={l.pu} onChange={(e) => setLine(i, "pu", e.target.value)} inputMode="decimal" placeholder="PU" style={numInp} />
            <button onClick={() => delLine(i)} aria-label="Supprimer la ligne" disabled={st.lines.length <= 1}
              style={{ background: "none", border: "none", color: "var(--color-text-muted)", cursor: st.lines.length <= 1 ? "default" : "pointer", fontSize: 14, opacity: st.lines.length <= 1 ? 0.3 : 1 }}>✕</button>
          </div>
        ))}
      </div>
      <button onClick={addLine} style={{ marginTop: "var(--space-2)", background: "none", border: "none", color: "var(--color-gold)", fontSize: "var(--text-xs)", cursor: "pointer", padding: "4px 0" }}>+ Ajouter une ligne</button>

      {/* TVA + totaux */}
      <div style={{ marginTop: "var(--space-3)", borderTop: "var(--border-subtle)", paddingTop: "var(--space-3)" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--space-2)", cursor: "pointer" }}>
          <input type="checkbox" checked={st.tva} onChange={(e) => patch({ tva: e.target.checked })} style={{ accentColor: "var(--color-gold)" }} />
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Assujetti TVA ({TVA}%)</span>
        </label>
        <Row label="Sous-total HT" value={`${chf(ht)} CHF`} />
        {st.tva && <Row label={`TVA ${TVA}%`} value={`${chf(tva)} CHF`} />}
        <Row label={`Total${st.tva ? " TTC" : ""}`} value={`${chf(ttc)} CHF`} strong />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
        <button onClick={copy} disabled={empty} style={{ flex: 1, padding: "10px", borderRadius: "var(--radius-sm)", border: "var(--border-subtle)", background: "var(--color-bg-elevated)", color: "var(--color-text-primary)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", cursor: empty ? "default" : "pointer", opacity: empty ? 0.4 : 1 }}>Copier</button>
        <button onClick={send} disabled={empty} style={{ flex: 1, padding: "10px", borderRadius: "var(--radius-sm)", border: "none", background: "var(--color-gold)", color: "var(--color-text-inverse)", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "var(--text-sm)", cursor: empty ? "default" : "pointer", opacity: empty ? 0.4 : 1 }}>Envoyer</button>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "var(--text-sm)" }}>
      <span style={{ color: strong ? "var(--color-text-primary)" : "var(--color-text-muted)", fontWeight: strong ? 600 : 400 }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontWeight: strong ? 700 : 500, color: strong ? "var(--color-gold)" : "var(--color-text-secondary)" }}>{value}</span>
    </div>
  );
}
