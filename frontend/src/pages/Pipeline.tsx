import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useUserStore } from "@/stores/useUserStore";
import { useAppStore } from "@/stores/useAppStore";
import { supabase } from "@/lib/supabase";
import { researchProspect } from "@/lib/ai";
import type { Prospect, ProspectColumn, SonCas } from "@/types";

const COLUMNS: { key: ProspectColumn; label: string }[] = [
  { key: "nouveau",     label: "Nouveau" },
  { key: "contacte",   label: "Contacté" },
  { key: "rdv",        label: "RDV" },
  { key: "proposition",label: "Proposition" },
  { key: "gagne",      label: "Gagné" },
  { key: "perdu",      label: "Perdu" },
];

const SONCAS_COLOR: Record<SonCas, "gold" | "success" | "warning" | "danger" | "muted"> = {
  sympathie:  "gold",
  orgueil:    "warning",
  nouveaute:  "success",
  confort:    "muted",
  argent:     "warning",
  securite:   "muted",
};

const NEXT_COLUMN: Record<ProspectColumn, ProspectColumn | null> = {
  nouveau: "contacte", contacte: "rdv", rdv: "proposition",
  proposition: "gagne", gagne: null, perdu: null,
};

interface NewProspectForm {
  name: string;
  company: string;
  email: string;
  soncas: SonCas | "";
  est_value: string;
}

export function Pipeline() {
  const profile = useUserStore((s) => s.profile);
  const { prospects, fetchProspects, loadingProspects, moveProspect } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewProspectForm>({ name: "", company: "", email: "", soncas: "", est_value: "" });
  const [saving, setSaving] = useState(false);
  const [researching, setResearching] = useState<string | null>(null);
  const [researchResult, setResearchResult] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profile?.id) fetchProspects(profile.id);
  }, [profile?.id]);

  function prospectsByColumn(col: ProspectColumn) {
    return prospects.filter((p) => p.column_key === col);
  }

  async function addProspect() {
    if (!profile?.id || !form.name.trim()) return;
    setSaving(true);
    const { data } = await supabase
      .from("prospects")
      .insert({
        profile_id: profile.id,
        name: form.name.trim(),
        company: form.company || null,
        email: form.email || null,
        soncas: form.soncas || null,
        est_value: parseFloat(form.est_value) || 0,
        column_key: "nouveau",
      })
      .select()
      .single();

    if (data) {
      useAppStore.setState((s) => ({ prospects: [data as Prospect, ...s.prospects] }));
    }
    setForm({ name: "", company: "", email: "", soncas: "", est_value: "" });
    setShowForm(false);
    setSaving(false);
  }

  async function advance(prospect: Prospect) {
    const next = NEXT_COLUMN[prospect.column_key];
    if (!next) return;
    await moveProspect(prospect.id, next);
  }

  async function research(prospect: Prospect) {
    setResearching(prospect.id);
    try {
      const result = await researchProspect(prospect.name, prospect.company, { profile });
      setResearchResult((r) => ({ ...r, [prospect.id]: result }));
    } finally {
      setResearching(null);
    }
  }

  const totalPipeline = prospects
    .filter((p) => !["gagne", "perdu"].includes(p.column_key))
    .reduce((s, p) => s + p.est_value, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 400, color: "var(--color-text-primary)", margin: 0 }}>
            Pipeline commercial
          </h2>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", marginTop: "var(--space-1)" }}>
            Pipeline actif :{" "}
            <span style={{ color: "var(--color-gold)" }}>
              {totalPipeline.toLocaleString("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 })}
            </span>
          </p>
        </div>
        <Button size="sm" variant="gold" onClick={() => setShowForm(!showForm)}>
          + Prospect
        </Button>
      </div>

      {/* Formulaire nouveau prospect */}
      {showForm && (
        <Card glass>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <Input label="Nom *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jean Dupont" />
            <Input label="Entreprise" value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder="Acme SA" />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jean@acme.ch" />
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <label style={{ fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
                SONCAS
              </label>
              <select
                value={form.soncas}
                onChange={(e) => setForm((f) => ({ ...f, soncas: e.target.value as SonCas | "" }))}
                style={{ background: "var(--color-bg-input)", border: "var(--border-subtle)", borderRadius: "var(--radius-sm)", color: "var(--color-text-primary)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", padding: "var(--space-3) var(--space-4)", outline: "none" }}
              >
                <option value="">— Sélectionner —</option>
                {["sympathie","orgueil","nouveaute","confort","argent","securite"].map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <Input label="Valeur estimée (CHF)" type="number" value={form.est_value} onChange={(e) => setForm((f) => ({ ...f, est_value: e.target.value }))} placeholder="1440" />
          </div>
          <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
            <Button size="sm" variant="gold" loading={saving} onClick={addProspect}>Ajouter</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Annuler</Button>
          </div>
        </Card>
      )}

      {/* Kanban */}
      {loadingProspects ? (
        <p style={{ color: "var(--color-text-muted)" }}>Chargement…</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(180px, 1fr))", gap: "var(--space-3)", overflowX: "auto" }}>
          {COLUMNS.map((col) => {
            const cards = prospectsByColumn(col.key);
            const colValue = cards.reduce((s, p) => s + p.est_value, 0);
            return (
              <div key={col.key} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", minWidth: 180 }}>
                {/* En-tête colonne */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-2) 0" }}>
                  <span style={{ fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: col.key === "gagne" ? "var(--color-success)" : col.key === "perdu" ? "var(--color-danger)" : "var(--color-text-muted)" }}>
                    {col.label}
                  </span>
                  {cards.length > 0 && (
                    <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{cards.length}</span>
                  )}
                </div>
                {colValue > 0 && (
                  <span style={{ fontSize: 10, color: "var(--color-gold)", marginTop: -6, paddingBottom: "var(--space-1)" }}>
                    {colValue.toLocaleString("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 })}
                  </span>
                )}

                {/* Cartes */}
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {cards.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        background: "var(--color-bg-surface)",
                        border: "var(--border-subtle)",
                        borderRadius: "var(--radius-sm)",
                        padding: "var(--space-3)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-2)",
                        transition: "border-color var(--transition-fast)",
                      }}
                    >
                      <div style={{ fontWeight: 500, fontSize: "var(--text-sm)", color: "var(--color-text-primary)" }}>{p.name}</div>
                      {p.company && <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>{p.company}</div>}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        {p.soncas && <Badge color={SONCAS_COLOR[p.soncas as SonCas]}>{p.soncas}</Badge>}
                        {p.est_value > 0 && (
                          <span style={{ fontSize: 10, color: "var(--color-gold)", fontFamily: "var(--font-mono)" }}>
                            {p.est_value.toLocaleString("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 })}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap" }}>
                        {NEXT_COLUMN[p.column_key] && (
                          <Button size="sm" variant="gold" onClick={() => advance(p)} style={{ fontSize: 10, padding: "2px 6px" }}>
                            → {COLUMNS.find((c) => c.key === NEXT_COLUMN[p.column_key])?.label}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={researching === p.id}
                          onClick={() => research(p)}
                          style={{ fontSize: 10, padding: "2px 6px" }}
                        >
                          IA
                        </Button>
                      </div>

                      {/* Résultat recherche IA */}
                      {researchResult[p.id] && (
                        <p style={{ fontSize: 10, color: "var(--color-text-secondary)", background: "rgba(197,165,114,0.06)", borderRadius: "var(--radius-xs)", padding: "var(--space-2)", margin: 0, lineHeight: "var(--leading-normal)", maxHeight: 120, overflow: "auto" }}>
                          {researchResult[p.id]}
                        </p>
                      )}
                    </div>
                  ))}
                  {cards.length === 0 && (
                    <div style={{ border: "1px dashed rgba(255,255,255,0.06)", borderRadius: "var(--radius-sm)", padding: "var(--space-4)", textAlign: "center" }}>
                      <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>Vide</span>
                    </div>
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
