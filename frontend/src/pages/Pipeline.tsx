import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useUserStore } from "@/stores/useUserStore";
import { useAppStore } from "@/stores/useAppStore";
import { supabase } from "@/lib/supabase";
import { researchProspect, prospectEmail, prospectObjections, prospectDossier, PROSPECT_EMAIL_TEMPLATES, type ProspectEmailTemplate } from "@/lib/ai";
import { callN8n } from "@/lib/n8n";
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

  // Mail IA de prise de contact
  const [emailOpen, setEmailOpen] = useState<string | null>(null);
  const [emailing, setEmailing] = useState<string | null>(null);
  const [emailTpl, setEmailTpl] = useState<Record<string, ProspectEmailTemplate>>({});
  const [emailResult, setEmailResult] = useState<Record<string, string>>({});

  // Panneau « Objections » / « Dossier » IA (un seul ouvert par carte).
  const [panelOpen, setPanelOpen] = useState<{ id: string; kind: "obj" | "dossier" } | null>(null);
  const [genBusy, setGenBusy] = useState<string | null>(null);
  const [objResult, setObjResult] = useState<Record<string, string>>({});
  const [dossierResult, setDossierResult] = useState<Record<string, string>>({});

  // Glisser-déposer entre colonnes
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<ProspectColumn | null>(null);

  useEffect(() => {
    if (profile?.id) fetchProspects(profile.id);
  }, [profile?.id]);

  function prospectsByColumn(col: ProspectColumn) {
    return prospects.filter((p) => p.column_key === col);
  }

  async function dropOn(col: ProspectColumn) {
    const id = dragId;
    setDragOver(null);
    setDragId(null);
    if (!id) return;
    const p = prospects.find((x) => x.id === id);
    if (!p || p.column_key === col) return;
    await moveProspect(id, col);
  }

  async function genEmail(p: Prospect) {
    setEmailing(p.id);
    try {
      const tpl = emailTpl[p.id] ?? "direct";
      const r = await prospectEmail(p.name, p.company, p.soncas, tpl, { profile });
      setEmailResult((m) => ({ ...m, [p.id]: r }));
    } finally {
      setEmailing(null);
    }
  }

  function togglePanel(id: string, kind: "obj" | "dossier") {
    setPanelOpen((o) => (o?.id === id && o.kind === kind ? null : { id, kind }));
  }

  async function genObjections(p: Prospect) {
    setGenBusy(`${p.id}:obj`);
    try {
      const r = await prospectObjections(p.name, p.company, p.soncas, { profile });
      setObjResult((m) => ({ ...m, [p.id]: r }));
    } finally {
      setGenBusy(null);
    }
  }

  async function genDossier(p: Prospect) {
    setGenBusy(`${p.id}:dossier`);
    try {
      const r = await prospectDossier(p.name, p.company, p.soncas, p.est_value, { profile });
      setDossierResult((m) => ({ ...m, [p.id]: r }));
    } finally {
      setGenBusy(null);
    }
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
      // Si l'abonné a branché son propre webhook n8n de recherche, on l'utilise
      // en priorité (données réelles) ; sinon repli sur l'IA classique.
      const n8nData = await callN8n("research", { entreprise: prospect.company, website: null });
      const result = n8nData != null
        ? (typeof n8nData === "string" ? n8nData : JSON.stringify(n8nData, null, 2))
        : await researchProspect(prospect.name, prospect.company, { profile });
      setResearchResult((r) => ({ ...r, [prospect.id]: result }));
    } finally {
      setResearching(null);
    }
  }

  // Envoi du dossier : webhook n8n de l'abonné en priorité, sinon brouillon mailto.
  async function sendDossier(prospect: Prospect, content: string) {
    setGenBusy(`${prospect.id}:send`);
    try {
      const sent = await callN8n("send", {
        destinataire: prospect.email,
        nom: prospect.name,
        entreprise: prospect.company,
        contenu: content,
      });
      if (sent != null) {
        setDossierResult((m) => ({ ...m, [prospect.id]: `${content}\n\n— Envoyé via votre webhook n8n ✓` }));
      } else {
        const subject = encodeURIComponent(`Proposition — ${prospect.company || prospect.name}`);
        const body = encodeURIComponent(content);
        window.open(`mailto:${prospect.email ?? ""}?subject=${subject}&body=${body}`, "_blank");
      }
    } finally {
      setGenBusy(null);
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
            <span style={{ color: "var(--color-text-muted)" }}> · glissez une carte entre les étapes</span>
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
              <div
                key={col.key}
                onDragOver={(e) => { e.preventDefault(); if (dragOver !== col.key) setDragOver(col.key); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver((d) => (d === col.key ? null : d)); }}
                onDrop={() => dropOn(col.key)}
                style={{
                  display: "flex", flexDirection: "column", gap: "var(--space-2)", minWidth: 180,
                  borderRadius: "var(--radius-sm)",
                  outline: dragOver === col.key ? "1px dashed var(--color-gold)" : "1px dashed transparent",
                  outlineOffset: 4,
                  background: dragOver === col.key ? "rgba(197,165,114,0.05)" : "transparent",
                  transition: "background var(--transition-fast)",
                }}
              >
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
                      draggable
                      onDragStart={() => setDragId(p.id)}
                      onDragEnd={() => { setDragId(null); setDragOver(null); }}
                      style={{
                        background: "var(--color-bg-surface)",
                        border: "var(--border-subtle)",
                        borderRadius: "var(--radius-sm)",
                        padding: "var(--space-3)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-2)",
                        cursor: "grab",
                        opacity: dragId === p.id ? 0.5 : 1,
                        transition: "border-color var(--transition-fast), opacity var(--transition-fast)",
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
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEmailOpen((o) => (o === p.id ? null : p.id))}
                          style={{ fontSize: 10, padding: "2px 6px" }}
                        >
                          ✉ Mail
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => togglePanel(p.id, "obj")}
                          style={{ fontSize: 10, padding: "2px 6px" }}
                        >
                          ⚔ Objections
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => togglePanel(p.id, "dossier")}
                          style={{ fontSize: 10, padding: "2px 6px" }}
                        >
                          📄 Dossier
                        </Button>
                      </div>

                      {/* Résultat recherche IA */}
                      {researchResult[p.id] && (
                        <p style={{ fontSize: 10, color: "var(--color-text-secondary)", background: "rgba(197,165,114,0.06)", borderRadius: "var(--radius-xs)", padding: "var(--space-2)", margin: 0, lineHeight: "var(--leading-normal)", maxHeight: 120, overflow: "auto" }}>
                          {researchResult[p.id]}
                        </p>
                      )}

                      {/* Panneau mail IA */}
                      {emailOpen === p.id && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", borderTop: "var(--border-subtle)", paddingTop: "var(--space-2)" }}>
                          <select
                            value={emailTpl[p.id] ?? "direct"}
                            onChange={(e) => setEmailTpl((m) => ({ ...m, [p.id]: e.target.value as ProspectEmailTemplate }))}
                            style={{ background: "var(--color-bg-input)", border: "var(--border-subtle)", borderRadius: "var(--radius-xs)", color: "var(--color-text-primary)", fontSize: 10, padding: "3px 6px", outline: "none" }}
                          >
                            {PROSPECT_EMAIL_TEMPLATES.map((t) => (
                              <option key={t.key} value={t.key}>{t.label}</option>
                            ))}
                          </select>
                          <div style={{ display: "flex", gap: "var(--space-1)" }}>
                            <Button size="sm" variant="gold" loading={emailing === p.id} onClick={() => genEmail(p)} style={{ fontSize: 10, padding: "2px 6px" }}>
                              {emailResult[p.id] ? "Régénérer" : "Générer le mail"}
                            </Button>
                            {emailResult[p.id] && (
                              <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(emailResult[p.id])} style={{ fontSize: 10, padding: "2px 6px" }}>
                                Copier
                              </Button>
                            )}
                          </div>
                          {emailResult[p.id] && (
                            <p style={{ fontSize: 10, color: "var(--color-text-secondary)", background: "rgba(197,165,114,0.06)", borderRadius: "var(--radius-xs)", padding: "var(--space-2)", margin: 0, lineHeight: "var(--leading-normal)", whiteSpace: "pre-wrap", maxHeight: 160, overflow: "auto" }}>
                              {emailResult[p.id]}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Panneau guide d'objections */}
                      {panelOpen?.id === p.id && panelOpen.kind === "obj" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", borderTop: "var(--border-subtle)", paddingTop: "var(--space-2)" }}>
                          <div style={{ display: "flex", gap: "var(--space-1)" }}>
                            <Button size="sm" variant="gold" loading={genBusy === `${p.id}:obj`} onClick={() => genObjections(p)} style={{ fontSize: 10, padding: "2px 6px" }}>
                              {objResult[p.id] ? "Régénérer" : "Guide d'objections"}
                            </Button>
                            {objResult[p.id] && (
                              <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(objResult[p.id])} style={{ fontSize: 10, padding: "2px 6px" }}>
                                Copier
                              </Button>
                            )}
                          </div>
                          {objResult[p.id] && (
                            <p style={{ fontSize: 10, color: "var(--color-text-secondary)", background: "rgba(197,165,114,0.06)", borderRadius: "var(--radius-xs)", padding: "var(--space-2)", margin: 0, lineHeight: "var(--leading-normal)", whiteSpace: "pre-wrap", maxHeight: 180, overflow: "auto" }}>
                              {objResult[p.id]}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Panneau dossier de proposition */}
                      {panelOpen?.id === p.id && panelOpen.kind === "dossier" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", borderTop: "var(--border-subtle)", paddingTop: "var(--space-2)" }}>
                          <div style={{ display: "flex", gap: "var(--space-1)" }}>
                            <Button size="sm" variant="gold" loading={genBusy === `${p.id}:dossier`} onClick={() => genDossier(p)} style={{ fontSize: 10, padding: "2px 6px" }}>
                              {dossierResult[p.id] ? "Régénérer" : "Générer le dossier"}
                            </Button>
                            {dossierResult[p.id] && (
                              <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(dossierResult[p.id])} style={{ fontSize: 10, padding: "2px 6px" }}>
                                Copier
                              </Button>
                            )}
                            {dossierResult[p.id] && (
                              <Button
                                size="sm"
                                variant="ghost"
                                loading={genBusy === `${p.id}:send`}
                                onClick={() => sendDossier(p, dossierResult[p.id])}
                                style={{ fontSize: 10, padding: "2px 6px" }}
                              >
                                ✉ Envoyer
                              </Button>
                            )}
                          </div>
                          {dossierResult[p.id] && (
                            <p style={{ fontSize: 10, color: "var(--color-text-secondary)", background: "rgba(197,165,114,0.06)", borderRadius: "var(--radius-xs)", padding: "var(--space-2)", margin: 0, lineHeight: "var(--leading-normal)", whiteSpace: "pre-wrap", maxHeight: 180, overflow: "auto" }}>
                              {dossierResult[p.id]}
                            </p>
                          )}
                        </div>
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
