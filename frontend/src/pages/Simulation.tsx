import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useUserStore } from "@/stores/useUserStore";
import {
  swarmPanel,
  swarmVerdict,
  swarmRecommendation,
  type SwarmPersonaVerdict,
  type SwarmVote,
} from "@/lib/ai";
import { loadLocal, saveLocal } from "@/lib/local";

type Phase = "idle" | "panel" | "debate" | "synthesis";

interface SwarmRun {
  question: string;
  verdicts: SwarmPersonaVerdict[];
  recommendation: string;
}

const VOTE_STYLE: Record<SwarmVote, { label: string; color: string }> = {
  oui: { label: "Oui", color: "var(--color-success)" },
  non: { label: "Non", color: "var(--color-danger)" },
  nuance: { label: "Nuancé", color: "var(--color-warning)" },
};

const PHASE_LABEL: Record<Exclude<Phase, "idle">, string> = {
  panel: "Génération du panel de personas…",
  debate: "Le panel délibère…",
  synthesis: "Nova synthétise le débat…",
};

export function Simulation() {
  const profile = useUserStore((s) => s.profile);
  const [question, setQuestion] = useState("");
  const [count, setCount] = useState(8);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<SwarmRun | null>(() =>
    loadLocal<SwarmRun | null>("ns_swarm", null),
  );

  const busy = phase !== "idle";

  async function launch() {
    const q = question.trim();
    if (!q || busy || !profile) return;
    setError(null);
    const ctx = profile ?? {};
    try {
      setPhase("panel");
      const personas = await swarmPanel(q, count, ctx);
      if (personas.length === 0) {
        setError("Le panel n'a pas pu être généré. Reformulez la décision et réessayez.");
        setPhase("idle");
        return;
      }
      setPhase("debate");
      const verdicts: SwarmPersonaVerdict[] = (
        await Promise.all(
          personas.map(async (p) => {
            const v = await swarmVerdict(p, q, ctx);
            return { ...p, ...v };
          }),
        )
      );
      setPhase("synthesis");
      const recommendation = await swarmRecommendation(q, verdicts, ctx);
      const next: SwarmRun = { question: q, verdicts, recommendation };
      setRun(next);
      saveLocal("ns_swarm", next);
    } catch {
      setError("La simulation a échoué. Réessayez dans un instant.");
    }
    setPhase("idle");
  }

  const tally = run
    ? run.verdicts.reduce(
        (acc, v) => {
          acc[v.vote] += 1;
          return acc;
        },
        { oui: 0, non: 0, nuance: 0 } as Record<SwarmVote, number>,
      )
    : null;

  const total = run?.verdicts.length ?? 0;
  const verdictLabel =
    tally && total
      ? tally.oui > tally.non
        ? "Plutôt OUI"
        : tally.non > tally.oui
          ? "Plutôt NON"
          : "Partagé"
      : "";
  const verdictColor =
    tally && total
      ? tally.oui > tally.non
        ? "var(--color-success)"
        : tally.non > tally.oui
          ? "var(--color-danger)"
          : "var(--color-warning)"
      : "var(--color-gold)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <PageHeader
        title="Simulation Swarm"
        subtitle="Testez une décision avant de l'engager : l'IA génère un panel de clients-cibles, les fait débattre, puis Nova en tire des actions concrètes."
      />

      <Card glass title="Lancer une simulation">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div>
            <label style={{ display: "block", fontSize: "var(--text-xs)", color: "var(--color-text-muted)", letterSpacing: "var(--tracking-wide)", marginBottom: "var(--space-2)" }}>
              Décision à tester
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ex : ma cible paierait-elle 90 CHF/session pour un accompagnement individuel ?"
              rows={3}
              disabled={busy}
              style={{
                width: "100%",
                background: "var(--color-bg-input)",
                border: "var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                color: "var(--color-text-primary)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-sm)",
                lineHeight: "var(--leading-normal)",
                padding: "var(--space-3) var(--space-4)",
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
              Personas
              <input
                type="number"
                min={4}
                max={10}
                value={count}
                disabled={busy}
                onChange={(e) => setCount(Math.max(4, Math.min(10, Number(e.target.value) || 8)))}
                style={{
                  width: 64,
                  background: "var(--color-bg-input)",
                  border: "var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--color-text-primary)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-sm)",
                  padding: "var(--space-2) var(--space-3)",
                  outline: "none",
                }}
              />
            </label>
            <Button variant="gold" loading={busy} disabled={!question.trim() || !profile} onClick={launch}>
              Lancer la simulation
            </Button>
            {busy && (
              <span style={{ fontSize: "var(--text-sm)", color: "var(--color-gold-muted)", fontStyle: "italic" }}>
                {PHASE_LABEL[phase as Exclude<Phase, "idle">]}
              </span>
            )}
          </div>
          {error && <p style={{ color: "var(--color-danger)", fontSize: "var(--text-sm)", margin: 0 }}>{error}</p>}
        </div>
      </Card>

      {run && (
        <>
          {/* Consensus */}
          <Card glass style={{ borderColor: "rgba(197,165,114,0.25)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-5)" }}>
              <div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", letterSpacing: "var(--tracking-wide)", marginBottom: "var(--space-1)" }}>
                  Consensus du panel
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", color: verdictColor }}>
                  {verdictLabel}
                </div>
              </div>
              {tally && (
                <div style={{ display: "flex", gap: "var(--space-4)" }}>
                  {(["oui", "nuance", "non"] as SwarmVote[]).map((v) => (
                    <div key={v} style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xl)", color: VOTE_STYLE[v].color }}>
                        {tally[v]}<span style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>/{total}</span>
                      </div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>{VOTE_STYLE[v].label}</div>
                    </div>
                  ))}
                </div>
              )}
              <p style={{ flex: "1 1 240px", fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: 0, fontStyle: "italic" }}>
                Décision testée : « {run.question} »
              </p>
            </div>
          </Card>

          {/* Recommandation Nova */}
          {run.recommendation && (
            <Card glass title="✦ Synthèse & recommandation Nova">
              <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)", lineHeight: "var(--leading-relaxed)", whiteSpace: "pre-wrap", margin: 0 }}>
                {run.recommendation}
              </p>
            </Card>
          )}

          {/* Le panel */}
          <Card glass title={`Le panel · ${total} personas`}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-4)" }}>
              {run.verdicts.map((v, i) => (
                <div
                  key={i}
                  style={{
                    background: "var(--color-bg-input)",
                    border: "var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    padding: "var(--space-4)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-2)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-2)" }}>
                    <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text-primary)" }}>{v.name}</span>
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: "var(--text-xs)",
                        fontWeight: 600,
                        color: VOTE_STYLE[v.vote].color,
                        border: `1px solid ${VOTE_STYLE[v.vote].color}`,
                        borderRadius: "var(--radius-xs)",
                        padding: "1px 8px",
                        letterSpacing: "var(--tracking-wide)",
                      }}
                    >
                      {VOTE_STYLE[v.vote].label}
                    </span>
                  </div>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--color-gold-muted)", margin: 0, lineHeight: "var(--leading-normal)" }}>{v.profil}</p>
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", margin: 0, lineHeight: "var(--leading-relaxed)" }}>{v.argument}</p>
                  {v.objection && (
                    <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: 0, lineHeight: "var(--leading-normal)" }}>
                      <span style={{ color: "var(--color-warning)" }}>Réserve :</span> {v.objection}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
