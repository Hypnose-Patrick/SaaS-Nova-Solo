import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { AiResult } from "@/components/ui/AiResult";
import { useUserStore } from "@/stores/useUserStore";
import { useAiGen, MODEL_REASONING } from "@/lib/useAiGen";
import { promptMarketingPost, promptEditorialIdeas, promptPortfolioCase, promptMarketingInsights } from "@/lib/lancementPrompts";
import { loadLocal, saveLocal, parseLooseJson } from "@/lib/local";

const FORMATS = [
  "Post témoignage (parcours / reconversion)",
  "Post conseil (valeur actionnable)",
  "Accroche courte (hook)",
  "Plan de carrousel",
  "Annonce d'offre",
] as const;

interface Idea { semaine: string; format: string; titre: string; objectif: string }
interface CalItem { id: string; date: string; canal: string; idee: string; statut: "À créer" | "Planifié" | "Publié" }
interface Insight { priorite: "P1" | "P2" | "P3"; titre: string; action: string }
interface Channel { id: string; canal: string; etat: string; statut: PresenceStatut }

type PresenceStatut = "À évaluer" | "À optimiser" | "Actif" | "À créer";

const STATUTS: CalItem["statut"][] = ["À créer", "Planifié", "Publié"];
const STATUT_COLOR: Record<CalItem["statut"], string> = {
  "À créer": "var(--color-text-muted)",
  "Planifié": "var(--color-info)",
  "Publié": "var(--color-success)",
};

const PRESENCE_STATUTS: PresenceStatut[] = ["À évaluer", "À optimiser", "Actif", "À créer"];
const PRESENCE_COLOR: Record<PresenceStatut, string> = {
  "À évaluer": "var(--color-text-muted)",
  "À optimiser": "var(--color-warning)",
  "Actif": "var(--color-success)",
  "À créer": "var(--color-danger)",
};
const INSIGHT_COLOR: Record<Insight["priorite"], string> = {
  P1: "var(--color-gold)",
  P2: "var(--color-warning)",
  P3: "var(--color-text-muted)",
};
const INSIGHT_LABEL: Record<Insight["priorite"], string> = {
  P1: "P1 — Priorité haute",
  P2: "P2 — À planifier",
  P3: "P3 — Exploratoire",
};

const TA: React.CSSProperties = {
  width: "100%", minHeight: 80, marginTop: "var(--space-2)",
  background: "var(--color-bg-input)", border: "var(--border-subtle)",
  borderRadius: "var(--radius-sm)", color: "var(--color-text-primary)",
  fontFamily: "var(--font-body)", fontSize: "var(--text-sm)",
  lineHeight: "var(--leading-normal)", padding: "var(--space-3) var(--space-4)",
  resize: "vertical", outline: "none", boxSizing: "border-box",
};
const FIELD: React.CSSProperties = {
  width: "100%", marginTop: "var(--space-2)",
  background: "var(--color-bg-input)", border: "var(--border-subtle)",
  borderRadius: "var(--radius-sm)", color: "var(--color-text-primary)",
  fontFamily: "var(--font-body)", fontSize: "var(--text-sm)",
  padding: "var(--space-3) var(--space-4)", outline: "none", boxSizing: "border-box",
};
const LBL: React.CSSProperties = {
  fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)",
  textTransform: "uppercase", color: "var(--color-text-muted)",
};

// id stable sans Math.random/Date.now (compteur de session suffit pour des clés locales)
let _seq = 0;
function nextId() { _seq += 1; return `c${_seq}_${performance.now().toFixed(0)}`; }

export function Marketing() {
  const profile = useUserStore((s) => s.profile);
  const post = useAiGen();
  const ideasGen = useAiGen();
  const portfolio = useAiGen();
  const insightsGen = useAiGen();

  // Générateur de contenu
  const [format, setFormat] = useState<string>(() => loadLocal("ns_mkt_format", FORMATS[0]));
  const [sujet, setSujet] = useState<string>(() => loadLocal("ns_mkt_sujet", ""));
  const [content, setContent] = useState<string | null>(() => loadLocal<string | null>("ns_mkt_content", null));

  // Calendrier éditorial
  const [calendar, setCalendar] = useState<CalItem[]>(() => loadLocal<CalItem[]>("ns_mkt_calendar", []));
  const [ideas, setIdeas] = useState<Idea[]>(() => loadLocal<Idea[]>("ns_mkt_ideas", []));

  // Portfolio
  const [caseStudy, setCaseStudy] = useState<string | null>(() => loadLocal<string | null>("ns_mkt_case", null));

  // Insights IA + audit de présence en ligne
  const [insights, setInsights] = useState<Insight[]>(() => loadLocal<Insight[]>("ns_mkt_insights", []));
  const [channels, setChannels] = useState<Channel[]>(() =>
    loadLocal<Channel[]>("ns_mkt_presence", [
      { id: "ch_linkedin", canal: "LinkedIn", etat: "", statut: "À évaluer" },
      { id: "ch_site", canal: "Site web", etat: profile?.website ?? "", statut: profile?.website ? "Actif" : "À créer" },
      { id: "ch_news", canal: "Newsletter", etat: "", statut: "À créer" },
    ]),
  );

  function persistCal(next: CalItem[]) { setCalendar(next); saveLocal("ns_mkt_calendar", next); }
  function persistChannels(next: Channel[]) { setChannels(next); saveLocal("ns_mkt_presence", next); }

  function presenceSummary(): string {
    return channels
      .filter((c) => c.canal.trim())
      .map((c) => `${c.canal} : ${c.etat || "—"} (${c.statut})`)
      .join(" ; ");
  }

  async function generateInsights() {
    const r = await insightsGen.gen("communicant", promptMarketingInsights(profile, presenceSummary()), { model: MODEL_REASONING });
    if (r) {
      const parsed = parseLooseJson<{ insights: Insight[] }>(r);
      const list = (parsed?.insights ?? []).filter((i) => i.titre && i.action);
      setInsights(list);
      saveLocal("ns_mkt_insights", list);
    }
  }

  function updateChannel(id: string, patch: Partial<Channel>) {
    persistChannels(channels.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function addChannel() {
    persistChannels([...channels, { id: nextId(), canal: "", etat: "", statut: "À évaluer" }]);
  }
  function removeChannel(id: string) {
    persistChannels(channels.filter((c) => c.id !== id));
  }

  async function generatePost() {
    saveLocal("ns_mkt_format", format);
    saveLocal("ns_mkt_sujet", sujet);
    const r = await post.gen("communicant", promptMarketingPost(profile, format, sujet));
    if (r) { setContent(r); saveLocal("ns_mkt_content", r); }
  }

  async function suggestIdeas() {
    const r = await ideasGen.gen("communicant", promptEditorialIdeas(profile), { model: MODEL_REASONING });
    if (r) {
      const parsed = parseLooseJson<{ ideas: Idea[] }>(r);
      const list = parsed?.ideas ?? [];
      setIdeas(list);
      saveLocal("ns_mkt_ideas", list);
    }
  }

  async function generateCase() {
    const r = await portfolio.gen("communicant", promptPortfolioCase(profile));
    if (r) { setCaseStudy(r); saveLocal("ns_mkt_case", r); }
  }

  function addIdeaToCalendar(idea: Idea) {
    persistCal([...calendar, { id: nextId(), date: idea.semaine, canal: "LinkedIn", idee: `${idea.format} — ${idea.titre}`, statut: "À créer" }]);
  }

  function addRow() {
    persistCal([...calendar, { id: nextId(), date: "", canal: "LinkedIn", idee: "", statut: "À créer" }]);
  }

  function updateRow(id: string, patch: Partial<CalItem>) {
    persistCal(calendar.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function removeRow(id: string) {
    persistCal(calendar.filter((c) => c.id !== id));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: 920 }}>
      <PageHeader title="Marketing & Visibilité" subtitle="Génération de contenu LinkedIn, calendrier éditorial et études de cas — porté par l'agent Communicant." />

      {/* Générateur de contenu */}
      <Card glass title="Générateur de contenu LinkedIn">
        <label style={LBL}>Format</label>
        <select value={format} onChange={(e) => setFormat(e.target.value)} style={FIELD}>
          {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>

        <div style={{ marginTop: "var(--space-4)" }}>
          <label style={LBL}>Sujet / angle</label>
          <textarea value={sujet} onChange={(e) => setSujet(e.target.value)} placeholder="Ex : les 3 erreurs qui bloquent une reconversion à 40 ans…" style={TA} />
        </div>

        <div style={{ marginTop: "var(--space-4)" }}>
          <Button variant="gold" loading={post.loading} onClick={generatePost} disabled={!sujet.trim()}>
            {content ? "Régénérer le contenu" : "Générer le contenu"}
          </Button>
        </div>

        {(post.loading || post.error || content) && (
          <div style={{ marginTop: "var(--space-4)" }}>
            <AiResult content={content} loading={post.loading} error={post.error} />
          </div>
        )}

        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: "var(--space-4)" }}>
          Avant de publier, testez la réaction de votre cible avec le <Link to="/mirrorfisch" style={{ color: "var(--color-gold)" }}>Test d'audience</Link>.
        </p>
      </Card>

      {/* Calendrier éditorial */}
      <Card glass title="Calendrier éditorial" action={
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <Button size="sm" variant="ghost" loading={ideasGen.loading} onClick={suggestIdeas}>Suggérer des idées (IA)</Button>
          <Button size="sm" variant="gold" onClick={addRow}>+ Ligne</Button>
        </div>
      }>
        {ideasGen.error && <p style={{ fontSize: "var(--text-sm)", color: "var(--color-danger)", marginBottom: "var(--space-3)" }}>{ideasGen.error}</p>}

        {/* Idées suggérées */}
        {ideas.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-5)" }}>
            <p style={{ ...LBL, color: "var(--color-gold)" }}>Idées suggérées — cliquez pour planifier</p>
            {ideas.map((idea, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3)", background: "rgba(197,165,114,0.06)", borderRadius: "var(--radius-sm)" }}>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gold-muted)", width: 28, flexShrink: 0 }}>{idea.semaine}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)" }}>{idea.titre}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>{idea.format} · {idea.objectif}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => addIdeaToCalendar(idea)}>+ Planifier</Button>
              </div>
            ))}
          </div>
        )}

        {/* Tableau planning */}
        {calendar.length === 0 ? (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: 0 }}>
            Aucun contenu planifié. Ajoutez une ligne ou laissez l'IA suggérer des idées.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {calendar.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <input value={c.date} onChange={(e) => updateRow(c.id, { date: e.target.value })} placeholder="Date" style={{ ...FIELD, marginTop: 0, width: 90, flexShrink: 0 }} />
                <input value={c.canal} onChange={(e) => updateRow(c.id, { canal: e.target.value })} placeholder="Canal" style={{ ...FIELD, marginTop: 0, width: 110, flexShrink: 0 }} />
                <input value={c.idee} onChange={(e) => updateRow(c.id, { idee: e.target.value })} placeholder="Idée de contenu" style={{ ...FIELD, marginTop: 0, flex: 1, minWidth: 0 }} />
                <select value={c.statut} onChange={(e) => updateRow(c.id, { statut: e.target.value as CalItem["statut"] })} style={{ ...FIELD, marginTop: 0, width: 120, flexShrink: 0, color: STATUT_COLOR[c.statut] }}>
                  {STATUTS.map((s) => <option key={s} value={s} style={{ color: "var(--color-text-primary)" }}>{s}</option>)}
                </select>
                <Button size="sm" variant="ghost" onClick={() => removeRow(c.id)}>✕</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Insights IA */}
      <Card glass title="Insights IA — Recommandations" action={
        <Button size="sm" variant="gold" loading={insightsGen.loading} onClick={generateInsights}>
          {insights.length > 0 ? "Réanalyser" : "Générer des insights"}
        </Button>
      }>
        {insightsGen.error && <p style={{ fontSize: "var(--text-sm)", color: "var(--color-danger)", marginBottom: "var(--space-3)" }}>{insightsGen.error}</p>}
        {insights.length === 0 ? (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: 0 }}>
            Lancez l'analyse : Nova priorise 3 à 5 actions de visibilité adaptées à votre profil et à votre présence en ligne déclarée ci-dessous.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {insights.map((ins, i) => (
              <div key={i} style={{ padding: "var(--space-3) var(--space-4)", background: "var(--color-bg-input)", borderRadius: "var(--radius-sm)", borderLeft: `3px solid ${INSIGHT_COLOR[ins.priorite]}` }}>
                <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: INSIGHT_COLOR[ins.priorite], marginBottom: 2, letterSpacing: "var(--tracking-wide)" }}>
                  {INSIGHT_LABEL[ins.priorite] ?? ins.priorite}
                </div>
                <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)", fontWeight: 500 }}>{ins.titre}</div>
                <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: "var(--leading-relaxed)" }}>{ins.action}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Présence en ligne — audit des canaux */}
      <Card glass title="Présence en ligne — audit des canaux" action={
        <Button size="sm" variant="ghost" onClick={addChannel}>+ Canal</Button>
      }>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {channels.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <input value={c.canal} onChange={(e) => updateChannel(c.id, { canal: e.target.value })} placeholder="Canal" style={{ ...FIELD, marginTop: 0, width: 130, flexShrink: 0 }} />
              <input value={c.etat} onChange={(e) => updateChannel(c.id, { etat: e.target.value })} placeholder="État (ex : nombre de relations, abonnés, URL…)" style={{ ...FIELD, marginTop: 0, flex: 1, minWidth: 0 }} />
              <select value={c.statut} onChange={(e) => updateChannel(c.id, { statut: e.target.value as PresenceStatut })} style={{ ...FIELD, marginTop: 0, width: 130, flexShrink: 0, color: PRESENCE_COLOR[c.statut] }}>
                {PRESENCE_STATUTS.map((s) => <option key={s} value={s} style={{ color: "var(--color-text-primary)" }}>{s}</option>)}
              </select>
              <Button size="sm" variant="ghost" onClick={() => removeChannel(c.id)}>✕</Button>
            </div>
          ))}
        </div>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: "var(--space-3)" }}>
          Renseignez l'état de chaque canal : il nourrit les Insights IA ci-dessus.
        </p>
      </Card>

      {/* Portfolio / étude de cas */}
      <Card glass title="Étude de cas / portfolio" action={
        <Button size="sm" variant="gold" loading={portfolio.loading} onClick={generateCase}>
          {caseStudy ? "Régénérer" : "Générer une étude de cas"}
        </Button>
      }>
        <AiResult
          content={caseStudy}
          loading={portfolio.loading}
          error={portfolio.error}
          emptyHint="La preuve sociale est le carburant du coaching : situation AVANT → travail réalisé → résultat APRÈS chiffré → témoignage."
        />
      </Card>
    </div>
  );
}
