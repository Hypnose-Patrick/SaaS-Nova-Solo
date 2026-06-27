import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useUserStore } from "@/stores/useUserStore";
import { useAppStore } from "@/stores/useAppStore";
import { challengeBmcBlock } from "@/lib/ai";
import { AiResult } from "@/components/ui/AiResult";
import { useAiGen, MODEL_REASONING } from "@/lib/useAiGen";
import { promptBmcGlobal } from "@/lib/lancementPrompts";
import { loadLocal, saveLocal } from "@/lib/local";

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

export function Bmc() {
  const profile = useUserStore((s) => s.profile);
  const { bmc, fetchBmc, upsertBmcBlock, loadingBmc } = useAppStore();
  const [editing, setEditing] = useState<BlockKey | null>(null);
  const [draft, setDraft] = useState("");
  const [challenging, setChallenging] = useState<BlockKey | null>(null);
  const { loading: gLoading, error: gError, gen } = useAiGen();
  const [global, setGlobal] = useState<string | null>(() => loadLocal<string | null>("ns_bmc_global", null));

  useEffect(() => {
    if (profile?.id) fetchBmc(profile.id);
  }, [profile?.id]);

  async function analyzeGlobal() {
    const resume = BLOCKS.map((b) => `${b.label} : ${getBlock(b.key)?.content ?? "—"}`).join("\n");
    const r = await gen("strategist", promptBmcGlobal(profile, resume), { model: MODEL_REASONING });
    if (r) { setGlobal(r); saveLocal("ns_bmc_global", r); }
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
              {/* Titre */}
              <span style={{ fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-gold-muted)" }}>
                {block.label}
              </span>

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

                  {/* Challenge IA */}
                  {data?.content && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={challenging === block.key}
                        onClick={(e) => { e.stopPropagation(); challenge(block.key); }}
                        style={{ fontSize: "10px" }}
                      >
                        Challenge Stratège
                      </Button>
                      {data.challenge && (
                        <p style={{ fontSize: "10px", color: "var(--color-gold)", background: "rgba(197,165,114,0.08)", borderRadius: "var(--radius-xs)", padding: "var(--space-2)", margin: 0, lineHeight: "var(--leading-normal)" }}>
                          {data.challenge}
                        </p>
                      )}
                    </div>
                  )}
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
