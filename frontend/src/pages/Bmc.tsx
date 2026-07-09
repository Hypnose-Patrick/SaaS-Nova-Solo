import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useUserStore } from "@/stores/useUserStore";
import { useAppStore } from "@/stores/useAppStore";
import { challengeBmcBlock } from "@/lib/ai";
import { AiResult } from "@/components/ui/AiResult";
import { useAiGen, MODEL_REASONING } from "@/lib/useAiGen";
import { promptBmcGlobal, promptBmcEnrich, BMC_GUIDE } from "@/lib/lancementPrompts";
import { loadLocal, saveLocal, projectKey } from "@/lib/local";

const BLOCKS = [
  { key: "partenaires", label: "Partenaires clés",     area: "partenaires" },
  { key: "activites",  label: "Activités clés",        area: "activites"  },
  { key: "valeur",     label: "Proposition de valeur", area: "valeur"     },
  { key: "relations",  label: "Relations clients",     area: "relations"  },
  { key: "segments",   label: "Segments clients",      area: "segments"   },
  { key: "ressources", label: "Ressources clés",       area: "ressources" },
  { key: "canaux",     label: "Canaux",                area: "canaux"     },
  { key: "couts",      label: "Structure de coûts",    area: "couts"      },
  { key: "revenus",    label: "Sources de revenus",    area: "revenus"    },
] as const;

type BlockKey = (typeof BLOCKS)[number]["key"];

// Reprend l'ancienne donnée globale (pré-scoping projet) pour le premier
// projet qui charge ce module après le correctif, puis l'efface — sans ça
// tout nouveau projet hériterait sinon de l'analyse du dernier projet actif.
function migrateLegacyBmc(projectId: string) {
  if (localStorage.getItem(projectKey("ns_bmc_global", projectId)) != null) return;
  const v = localStorage.getItem("ns_bmc_global");
  if (v == null) return;
  localStorage.setItem(projectKey("ns_bmc_global", projectId), v);
  localStorage.removeItem("ns_bmc_global");
}

function loadBmc(projectId: string | null | undefined) {
  return {
    global: loadLocal<string | null>(projectKey("ns_bmc_global", projectId), null),
  };
}

export function Bmc() {
  const profile = useUserStore((s) => s.profile);
  const projectId = profile?.id ?? null;
  const { bmc, fetchBmc, upsertBmcBlock, loadingBmc } = useAppStore();
  const [editing, setEditing] = useState<BlockKey | null>(null);
  const [draft, setDraft] = useState("");
  const [challenging, setChallenging] = useState<BlockKey | null>(null);
  const { loading: gLoading, error: gError, gen } = useAiGen();

  useEffect(() => { if (projectId) migrateLegacyBmc(projectId); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [global, setGlobal] = useState<string | null>(() => loadBmc(projectId).global);
  const [enriching, setEnriching] = useState<BlockKey | null>(null);
  const [enrichDraft, setEnrichDraft] = useState<Record<string, string>>({});
  const prevProjectId = useRef(projectId);

  // Changement de projet actif (sélecteur, sans démonter la page) : recharge
  // l'analyse propre à ce projet au lieu de garder celle affichée à l'écran.
  useEffect(() => {
    if (prevProjectId.current === projectId) return;
    prevProjectId.current = projectId;
    if (!projectId) return;
    setGlobal(loadBmc(projectId).global);
  }, [projectId]);

  async function enrich(key: BlockKey, label: string) {
    setEnriching(key);
    const r = await gen("strategist", promptBmcEnrich(profile, label, getBlock(key)?.content ?? ""), { model: MODEL_REASONING });
    setEnriching(null);
    if (r) setEnrichDraft((d) => ({ ...d, [key]: r }));
  }

  async function applyEnrich(key: BlockKey) {
    const draft = enrichDraft[key];
    if (!draft || !profile?.id) return;
    await upsertBmcBlock({ profile_id: profile.id, block_key: key, content: draft });
    setEnrichDraft((d) => { const n = { ...d }; delete n[key]; return n; });
  }

  function dismissEnrich(key: BlockKey) {
    setEnrichDraft((d) => { const n = { ...d }; delete n[key]; return n; });
  }

  useEffect(() => {
    if (profile?.id) fetchBmc(profile.id);
  }, [profile?.id]);

  async function analyzeGlobal() {
    const resume = BLOCKS.map((b) => `${b.label} : ${getBlock(b.key)?.content ?? "—"}`).join("\n");
    const r = await gen("strategist", promptBmcGlobal(profile, resume), { model: MODEL_REASONING });
    if (r) { setGlobal(r); saveLocal(projectKey("ns_bmc_global", projectId), r); }
  }

  function getBlock(key: BlockKey) {
    return bmc.find((b) => b.block_key === key);
  }

  function startEdit(key: BlockKey) {
    setEditing(key);
    setDraft(getBlock(key)?.content ?? "");
  }

  async function save(key: BlockKey) {
    if (!profile?.id) return;
    await upsertBmcBlock({ profile_id: profile.id, block_key: key, content: draft });
    setEditing(null);
  }

  async function challenge(key: BlockKey) {
    const content = getBlock(key)?.content;
    if (!content) return;
    setChallenging(key);
    try {
      const result = await challengeBmcBlock(key, content);
      if (!profile?.id) return;
      await upsertBmcBlock({ profile_id: profile.id, block_key: key, content: getBlock(key)?.content ?? "", challenge: result });
    } finally {
      setChallenging(null);
    }
  }

  if (loadingBmc) {
    return <p style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-body)" }}>Chargement…</p>;
  }

  const GRID: Record<string, { col: string; row: string }> = {
    partenaires: { col: "1", row: "1" },
    activites:   { col: "2", row: "1" },
    valeur:      { col: "3", row: "1 / span 2" },
    relations:   { col: "4", row: "1" },
    segments:    { col: "5", row: "1 / span 2" },
    ressources:  { col: "2", row: "2" },
    canaux:      { col: "4", row: "2" },
    couts:       { col: "1 / span 3", row: "3" },
    revenus:     { col: "4 / span 2", row: "3" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 400, color: "var(--color-text-primary)", margin: 0 }}>
          Business Model Canvas
        </h2>
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", marginTop: "var(--space-1)" }}>
          Cliquez sur un bloc pour le remplir. Le Stratège Hermès peut challenger chaque hypothèse.
        </p>
      </div>

      {/* Grille BMC */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gridTemplateRows: "auto auto auto",
          gap: "var(--space-3)",
          minHeight: 480,
        }}
      >
        {BLOCKS.map((block) => {
          const data = getBlock(block.key);
          const pos = GRID[block.key];
          const isEditing = editing === block.key;

          return (
            <div
              key={block.key}
              style={{
                gridColumn: pos.col,
                gridRow: pos.row,
                background: "var(--color-bg-surface)",
                border: isEditing ? "var(--border-active)" : "var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-4)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
                cursor: isEditing ? "default" : "pointer",
                transition: "border-color var(--transition-fast)",
                minHeight: 120,
              }}
              onClick={() => !isEditing && startEdit(block.key)}
            >
              {/* Titre + priorité */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" }}>
                <span style={{ fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-gold-muted)" }}>
                  {block.label}
                </span>
                {BMC_GUIDE[block.key] && (
                  <span style={{ fontSize: "9px", color: "var(--color-text-muted)", border: "var(--border-subtle)", borderRadius: "var(--radius-xs)", padding: "1px 5px", flexShrink: 0 }}>Prio. {BMC_GUIDE[block.key].prio}</span>
                )}
              </div>

              {/* Guide d'enrichissement */}
              {BMC_GUIDE[block.key] && (
                <details onClick={(e) => e.stopPropagation()} style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>
                  <summary style={{ cursor: "pointer", color: "var(--color-gold-muted)" }}>Comment enrichir ce bloc</summary>
                  <div style={{ marginTop: 4, lineHeight: 1.5 }}>
                    {BMC_GUIDE[block.key].guide}
                    <div style={{ marginTop: 4, color: "var(--color-gold)" }}><span style={{ fontWeight: 700 }}>📊 À mesurer :</span> {BMC_GUIDE[block.key].kpi}</div>
                  </div>
                </details>
              )}

              {/* Contenu ou textarea */}
              {isEditing ? (
                <>
                  <textarea
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    style={{
                      flex: 1,
                      background: "var(--color-bg-input)",
                      border: "var(--border-subtle)",
                      borderRadius: "var(--radius-xs)",
                      color: "var(--color-text-primary)",
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--text-xs)",
                      lineHeight: "var(--leading-normal)",
                      padding: "var(--space-2)",
                      resize: "none",
                      outline: "none",
                      minHeight: 80,
                    }}
                    placeholder={`Décrivez vos ${block.label.toLowerCase()}…`}
                  />
                  <div style={{ display: "flex", gap: "var(--space-2)" }}>
                    <Button size="sm" variant="gold" onClick={(e) => { e.stopPropagation(); save(block.key); }}>
                      Sauver
                    </Button>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditing(null); }}>
                      ✕
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ flex: 1, fontSize: "var(--text-xs)", color: data?.content ? "var(--color-text-secondary)" : "var(--color-text-muted)", lineHeight: "var(--leading-normal)", margin: 0, whiteSpace: "pre-wrap" }}>
                    {data?.content ?? "Cliquer pour remplir…"}
                  </p>

                  {/* Actions IA : Enrichir + Challenge */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={enriching === block.key}
                        onClick={(e) => { e.stopPropagation(); enrich(block.key, block.label); }}
                        style={{ fontSize: "10px" }}
                      >
                        ✦ Enrichir
                      </Button>
                      {data?.content && (
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={challenging === block.key}
                          onClick={(e) => { e.stopPropagation(); challenge(block.key); }}
                          style={{ fontSize: "10px" }}
                        >
                          ⚡ Challenge
                        </Button>
                      )}
                    </div>

                    {data?.challenge && (
                      <p style={{ fontSize: "10px", color: "var(--color-gold)", background: "rgba(197,165,114,0.08)", borderRadius: "var(--radius-xs)", padding: "var(--space-2)", margin: 0, lineHeight: "var(--leading-normal)" }}>
                        {data.challenge}
                      </p>
                    )}

                    {enrichDraft[block.key] && (
                      <div onClick={(e) => e.stopPropagation()} style={{ fontSize: "10px", background: "rgba(197,165,114,0.08)", borderRadius: "var(--radius-xs)", padding: "var(--space-2)" }}>
                        <div style={{ fontWeight: 700, color: "var(--color-gold)", marginBottom: 4 }}>✦ Proposition enrichie</div>
                        <div style={{ whiteSpace: "pre-wrap", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>{enrichDraft[block.key]}</div>
                        <div style={{ display: "flex", gap: "var(--space-2)", marginTop: 6 }}>
                          <Button size="sm" variant="gold" onClick={(e) => { e.stopPropagation(); applyEnrich(block.key); }} style={{ fontSize: "10px" }}>✓ Insérer</Button>
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); dismissEnrich(block.key); }} style={{ fontSize: "10px" }}>Ignorer</Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <Card glass title="Analyse globale du canvas" action={
        <Button size="sm" variant="gold" loading={gLoading} onClick={analyzeGlobal}>
          {global ? "Réanalyser" : "Analyser"}
        </Button>
      }>
        <AiResult content={global} loading={gLoading} error={gError} emptyHint="Cohérence globale notée /10, 3 forces, 3 risques et 2 recommandations prioritaires." />
      </Card>
    </div>
  );
}
