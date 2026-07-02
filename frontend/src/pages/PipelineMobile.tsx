import { useEffect, useMemo, useState } from "react";
import { useUserStore } from "@/stores/useUserStore";
import { useAppStore } from "@/stores/useAppStore";
import { supabase } from "@/lib/supabase";
import type { Prospect, ProspectColumn } from "@/types";

/**
 * PipelineMobile — version mobile du pipeline commercial (design Claude Design,
 * re-skinné sur les tokens Nova Solo). Rendu par <Pipeline> sous 768px.
 * Branché sur les vrais prospects (useAppStore) : recherche, avancement d'étape,
 * ajout rapide. Le kanban glisser-déposer reste sur desktop.
 */

const COLUMN_LABEL: Record<ProspectColumn, string> = {
  nouveau: "Nouveau", contacte: "Contacté", rdv: "RDV", proposition: "Proposition", gagne: "Gagné", perdu: "Perdu",
};
const COLUMN_COLOR: Record<ProspectColumn, string> = {
  nouveau: "var(--color-text-muted)", contacte: "var(--color-info)", rdv: "var(--color-gold)",
  proposition: "var(--color-warning)", gagne: "var(--color-success)", perdu: "var(--color-danger)",
};
const NEXT_COLUMN: Record<ProspectColumn, ProspectColumn | null> = {
  nouveau: "contacte", contacte: "rdv", rdv: "proposition", proposition: "gagne", gagne: null, perdu: null,
};
const ORDER: Record<ProspectColumn, number> = { nouveau: 0, contacte: 1, rdv: 2, proposition: 3, gagne: 4, perdu: 5 };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
const chf = (n: number) => `${n.toLocaleString("fr-CH", { maximumFractionDigits: 0 }).replace(/ /g, "’")} CHF`;

const inp: React.CSSProperties = {
  background: "var(--color-bg-input)", border: "var(--border-subtle)", borderRadius: "var(--radius-sm)",
  color: "var(--color-text-primary)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)",
  padding: "9px 12px", outline: "none", width: "100%", boxSizing: "border-box",
};

export function PipelineMobile() {
  const profile = useUserStore((s) => s.profile);
  const { prospects, fetchProspects, loadingProspects, moveProspect } = useAppStore();
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", est_value: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.id) fetchProspects(profile.id);
  }, [profile?.id]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? prospects.filter((p) => `${p.name} ${p.company ?? ""}`.toLowerCase().includes(s)) : prospects;
    return [...list].sort((a, b) => ORDER[a.column_key] - ORDER[b.column_key]);
  }, [prospects, q]);

  const active = prospects.filter((p) => !["gagne", "perdu"].includes(p.column_key));
  const totalPipeline = active.reduce((s, p) => s + p.est_value, 0);

  async function addProspect() {
    if (!profile?.id || !form.name.trim()) return;
    setSaving(true);
    const { data } = await supabase
      .from("prospects")
      .insert({ profile_id: profile.id, name: form.name.trim(), company: form.company || null, est_value: parseFloat(form.est_value) || 0, column_key: "nouveau" })
      .select().single();
    if (data) useAppStore.setState((s) => ({ prospects: [data as Prospect, ...s.prospects] }));
    setForm({ name: "", company: "", est_value: "" });
    setShowForm(false);
    setSaving(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* En-tête */}
      <div>
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 400, color: "var(--color-text-primary)" }}>Pipeline</h2>
        <p style={{ margin: "var(--space-1) 0 0", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
          Pipeline actif : <span style={{ color: "var(--color-gold)", fontFamily: "var(--font-mono)" }}>{chf(totalPipeline)}</span>
        </p>
      </div>

      {/* Recherche */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--color-bg-input)", border: "var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "0 12px" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un prospect…" style={{ ...inp, background: "transparent", border: "none", padding: "10px 0" }} />
      </div>

      {/* Header liste + ajout */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
          {active.length} prospect{active.length > 1 ? "s" : ""} actif{active.length > 1 ? "s" : ""}
        </span>
        <button onClick={() => setShowForm((v) => !v)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-gold)", background: "transparent", color: "var(--color-gold)", fontFamily: "var(--font-body)", fontSize: "var(--text-xs)", fontWeight: 500, cursor: "pointer" }}>
          + Prospect
        </button>
      </div>

      {/* Formulaire ajout rapide */}
      {showForm && (
        <div style={{ background: "var(--color-bg-surface)", border: "var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nom *" style={inp} />
          <input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder="Entreprise" style={inp} />
          <input value={form.est_value} onChange={(e) => setForm((f) => ({ ...f, est_value: e.target.value }))} inputMode="decimal" placeholder="Valeur estimée (CHF)" style={{ ...inp, fontFamily: "var(--font-mono)" }} />
          <div style={{ display: "flex", gap: "var(--space-2)", marginTop: 2 }}>
            <button onClick={addProspect} disabled={saving || !form.name.trim()} style={{ flex: 1, padding: "10px", borderRadius: "var(--radius-sm)", border: "none", background: "var(--color-gold)", color: "var(--color-text-inverse)", fontWeight: 600, fontSize: "var(--text-sm)", cursor: "pointer", opacity: saving || !form.name.trim() ? 0.5 : 1 }}>Ajouter</button>
            <button onClick={() => setShowForm(false)} style={{ padding: "10px 16px", borderRadius: "var(--radius-sm)", border: "var(--border-subtle)", background: "transparent", color: "var(--color-text-secondary)", fontSize: "var(--text-sm)", cursor: "pointer" }}>Annuler</button>
          </div>
        </div>
      )}

      {/* Liste */}
      {loadingProspects ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>Chargement…</p>
      ) : filtered.length === 0 ? (
        <div style={{ background: "var(--color-bg-surface)", border: "var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "var(--space-8)", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
            {q ? "Aucun prospect ne correspond." : "Aucun prospect. Ajoute ton premier avec « + Prospect »."}
          </p>
        </div>
      ) : (
        <div style={{ background: "var(--color-bg-surface)", border: "var(--border-subtle)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          {filtered.map((p, i) => {
            const next = NEXT_COLUMN[p.column_key];
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "12px 14px", borderBottom: i < filtered.length - 1 ? "var(--border-subtle)" : "none" }}>
                <div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", flexShrink: 0, background: "var(--color-gold-glow)", border: "var(--border-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gold)" }}>
                  {initials(p.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: "0 0 2px", fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: COLUMN_COLOR[p.column_key], flexShrink: 0 }}>{COLUMN_LABEL[p.column_key]}</span>
                    {p.company && <span style={{ fontSize: 11, color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {p.company}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                  {p.est_value > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-gold)" }}>{chf(p.est_value)}</span>}
                  {next && (
                    <button onClick={() => moveProspect(p.id, next)} title={`→ ${COLUMN_LABEL[next]}`} style={{ padding: "3px 8px", borderRadius: "var(--radius-xs)", border: "var(--border-subtle)", background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)", fontSize: 10, cursor: "pointer", whiteSpace: "nowrap" }}>
                      → {COLUMN_LABEL[next]}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
