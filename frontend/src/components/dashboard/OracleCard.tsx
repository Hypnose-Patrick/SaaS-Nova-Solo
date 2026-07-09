import { useEffect, useRef, useState } from "react";
import { ORACLE_ANIMALS } from "@/lib/oracleAnimals";
import { loadLocal, saveLocal, projectKey } from "@/lib/local";
import { useUserStore } from "@/stores/useUserStore";

// Oracle du jour — mini-jeu de pause : 1 tap tire un animal business (message +
// défi). La carte reste fixée pour la journée ; « une autre » permet de rejouer.

interface DrawState { day: string; idx: number }
const EMPTY_STATE: DrawState = { day: "", idx: -1 };

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
function pick(exclude = -1): number {
  if (ORACLE_ANIMALS.length <= 1) return 0;
  let i = Math.floor(Math.random() * ORACLE_ANIMALS.length);
  while (i === exclude) i = Math.floor(Math.random() * ORACLE_ANIMALS.length);
  return i;
}

// Reprend l'ancien tirage global (pré-scoping projet) pour le premier projet
// qui charge ce module après le correctif, puis l'efface — sans ça tout
// nouveau projet hériterait sinon du tirage du dernier projet actif.
function migrateLegacyOracle(projectId: string) {
  if (localStorage.getItem(projectKey("ns_oracle_jour", projectId)) != null) return;
  const v = localStorage.getItem("ns_oracle_jour");
  if (v == null) return;
  localStorage.setItem(projectKey("ns_oracle_jour", projectId), v);
  localStorage.removeItem("ns_oracle_jour");
}

function loadOracle(projectId: string | null | undefined) {
  return loadLocal<DrawState>(projectKey("ns_oracle_jour", projectId), EMPTY_STATE);
}

export function OracleCard() {
  const profile = useUserStore((s) => s.profile);
  const projectId = profile?.id ?? null;

  useEffect(() => { if (projectId) migrateLegacyOracle(projectId); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [state, setState] = useState<DrawState>(() => loadOracle(projectId));
  const prevProjectId = useRef(projectId);

  // Changement de projet actif (sélecteur, sans démonter la page) : recharge
  // le tirage propre à ce projet au lieu de garder celui affiché à l'écran.
  useEffect(() => {
    if (prevProjectId.current === projectId) return;
    prevProjectId.current = projectId;
    if (!projectId) return;
    setState(loadOracle(projectId));
  }, [projectId]);

  const drawn = state.day === todayKey() && state.idx >= 0 ? ORACLE_ANIMALS[state.idx] : null;

  function draw(exclude = -1) {
    const next = { day: todayKey(), idx: pick(exclude) };
    setState(next); saveLocal(projectKey("ns_oracle_jour", projectId), next);
  }

  return (
    <div style={{ background: "var(--color-bg-surface)", border: "var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
        <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-md)", fontWeight: 400, color: "var(--color-text-primary)" }}>
          Oracle du jour <span style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>· l'animal business</span>
        </p>
        {drawn && (
          <button onClick={() => draw(state.idx)} style={{ background: "none", border: "none", color: "var(--color-gold)", fontSize: 11, cursor: "pointer" }}>↻ une autre</button>
        )}
      </div>

      {!drawn ? (
        <button
          onClick={() => draw()}
          style={{
            width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)",
            padding: "var(--space-6) var(--space-4)", cursor: "pointer",
            background: "linear-gradient(160deg, var(--color-gold-glow), transparent)",
            border: "1px dashed var(--color-gold-border)", borderRadius: "var(--radius-md)",
          }}
        >
          <span style={{ fontFamily: "var(--font-display)", fontSize: 34, color: "var(--color-gold)", lineHeight: 1 }}>✦</span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-base)", color: "var(--color-text-primary)" }}>Tire ta carte du jour</span>
          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Un animal, un message, un défi — le temps d'une pause.</span>
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 4 }}>
          <span style={{ fontSize: 44, lineHeight: 1 }}>{drawn.emoji}</span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--color-text-primary)" }}>{drawn.label}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--color-gold)" }}>{drawn.kw.join(" · ")}</span>
          <p style={{ margin: "var(--space-2) 0 0", fontFamily: "var(--font-display)", fontSize: "var(--text-base)", color: "var(--color-gold)", fontStyle: "italic" }}>« {drawn.punch} »</p>
          <p style={{ margin: "2px 0 0", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: "var(--leading-normal)" }}>{drawn.tip}</p>
          <div style={{ marginTop: "var(--space-3)", width: "100%", padding: "var(--space-3) var(--space-4)", background: "var(--color-bg-elevated)", borderRadius: "var(--radius-sm)", textAlign: "left" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 4 }}>Ton défi du jour</div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)", lineHeight: "var(--leading-normal)" }}>{drawn.defi}</div>
          </div>
        </div>
      )}
    </div>
  );
}
