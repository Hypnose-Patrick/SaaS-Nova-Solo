import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useUserStore } from "@/stores/useUserStore";
import { useAiGen, MODEL_REASONING } from "@/lib/useAiGen";
import { SYM_QUESTIONS, promptSymbolicIntake, promptSymbolicTable } from "@/lib/lancementPrompts";
import { loadLocal, saveLocal, parseLooseJson } from "@/lib/local";

interface Intake { metaphore: string; plan: string[] }
interface SymNode { label: string; kind: string; note: string }
interface SymLink { from: string; to: string; relation: string }
interface SymTable { nodes: SymNode[]; links: SymLink[]; lecture: string; questions: string[] }

const KIND: Record<string, { label: string; color: string }> = {
  cap: { label: "Cap", color: "var(--color-gold)" },
  offre: { label: "Offre", color: "var(--color-success)" },
  levier: { label: "Levier", color: "var(--color-info)" },
  frein: { label: "Frein", color: "var(--color-danger)" },
  client: { label: "Client", color: "var(--color-gold-light)" },
  prescripteur: { label: "Prescripteur", color: "var(--color-info)" },
  ressource: { label: "Ressource", color: "var(--color-text-secondary)" },
  vision: { label: "Vision", color: "var(--color-gold)" },
};

const TA: React.CSSProperties = {
  width: "100%", minHeight: 70, marginTop: "var(--space-2)",
  background: "var(--color-bg-input)", border: "var(--border-subtle)",
  borderRadius: "var(--radius-sm)", color: "var(--color-text-primary)",
  fontFamily: "var(--font-body)", fontSize: "var(--text-sm)",
  lineHeight: "var(--leading-normal)", padding: "var(--space-3) var(--space-4)",
  resize: "vertical", outline: "none", boxSizing: "border-box",
};

export function Symbolique() {
  const profile = useUserStore((s) => s.profile);
  const { error, gen } = useAiGen();
  const [answers, setAnswers] = useState<string[]>(() => loadLocal("ns_sym_answers", ["", "", ""]));
  const [intake, setIntake] = useState<Intake | null>(() => loadLocal<Intake | null>("ns_sym_intake", null));
  const [table, setTable] = useState<SymTable | null>(() => loadLocal<SymTable | null>("ns_sym_table", null));
  const [phase, setPhase] = useState<"compose" | "loading">("compose");

  function setAnswer(i: number, v: string) {
    const next = answers.slice();
    next[i] = v;
    setAnswers(next);
    saveLocal("ns_sym_answers", next);
  }

  async function compose() {
    if (answers.some((a) => !a.trim())) return;
    setPhase("loading");
    // 1. Métaphore + plan
    const raw1 = await gen("nova", promptSymbolicIntake(answers), { model: MODEL_REASONING });
    if (raw1) {
      const ik = parseLooseJson<Intake>(raw1) ?? { metaphore: raw1, plan: [] };
      setIntake(ik);
      saveLocal("ns_sym_intake", ik);
      // 2. Tableau symbolique
      const raw2 = await gen("nova", promptSymbolicTable(profile, answers, ik.metaphore), { model: MODEL_REASONING });
      if (raw2) {
        const t = parseLooseJson<SymTable>(raw2);
        if (t) { setTable(t); saveLocal("ns_sym_table", t); }
      }
    }
    setPhase("compose");
  }

  const busy = phase === "loading";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: 880 }}>
      <PageHeader title="Vision symbolique" subtitle="Coaching systémique : de l'idée floue à une structure lisible. Le symbole éclaire — il ne prouve rien." />

      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-warning)", background: "rgba(245,158,11,0.08)", borderRadius: "var(--radius-sm)", padding: "var(--space-3) var(--space-4)" }}>
        ⚠️ Le piège du symbolique : une métaphore n'est pas une preuve de marché. Croise toujours avec du concret — entretiens clients, test d'offre, budget.
      </div>

      <Card glass>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-base)", color: "var(--color-gold)", margin: "0 0 var(--space-4)" }}>
          Dialogue avec ton coach systémique — 3 questions
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {SYM_QUESTIONS.map((q, i) => (
            <div key={i}>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)" }}>
                <span style={{ color: "var(--color-gold)", marginRight: 8 }}>{i + 1}.</span>{q}
              </span>
              <textarea value={answers[i]} onChange={(e) => setAnswer(i, e.target.value)} style={TA} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: "var(--space-4)" }}>
          <Button variant="gold" loading={busy} onClick={compose} disabled={answers.some((a) => !a.trim())}>
            {table ? "Recomposer ma vision" : "Composer ma vision symbolique"}
          </Button>
        </div>
        {error && <p style={{ fontSize: "var(--text-sm)", color: "var(--color-danger)", marginTop: "var(--space-3)" }}>{error}</p>}
      </Card>

      {intake && (
        <Card glass title="Votre métaphore centrale">
          <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", color: "var(--color-text-primary)", lineHeight: "var(--leading-normal)", margin: 0 }}>
            {intake.metaphore}
          </p>
          {intake.plan?.length > 0 && (
            <div style={{ marginTop: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {intake.plan.map((step, i) => (
                <div key={i} style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
                  <span style={{ color: "var(--color-gold-muted)", marginRight: 8 }}>◆</span>{step}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {table && (
        <Card glass title="Tableau de modélisation symbolique">
          {/* Symboles */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--color-text-muted)", fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "var(--tracking-wider)" }}>
                <th style={{ padding: "var(--space-2)" }}>Symbole</th>
                <th style={{ padding: "var(--space-2)" }}>Type</th>
                <th style={{ padding: "var(--space-2)" }}>Note</th>
              </tr>
            </thead>
            <tbody>
              {table.nodes.map((n, i) => (
                <tr key={i} style={{ borderTop: "var(--border-subtle)" }}>
                  <td style={{ padding: "var(--space-2)", color: "var(--color-text-primary)", fontWeight: 500 }}>{n.label}</td>
                  <td style={{ padding: "var(--space-2)" }}>
                    <span style={{ fontSize: "var(--text-xs)", color: KIND[n.kind]?.color ?? "var(--color-text-muted)" }}>
                      {KIND[n.kind]?.label ?? n.kind}
                    </span>
                  </td>
                  <td style={{ padding: "var(--space-2)", color: "var(--color-text-secondary)" }}>{n.note}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Relations */}
          {table.links?.length > 0 && (
            <div style={{ marginTop: "var(--space-5)" }}>
              <p style={{ fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "var(--tracking-wider)", color: "var(--color-text-muted)", margin: "0 0 var(--space-2)" }}>Relations</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                {table.links.map((l, i) => (
                  <div key={i} style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
                    <span style={{ color: "var(--color-text-primary)" }}>{l.from}</span>
                    <span style={{ color: "var(--color-gold-muted)" }}> — {l.relation} → </span>
                    <span style={{ color: "var(--color-text-primary)" }}>{l.to}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lecture */}
          {table.lecture && (
            <div style={{ marginTop: "var(--space-5)", padding: "var(--space-4)", background: "rgba(197,165,114,0.06)", borderRadius: "var(--radius-sm)" }}>
              <p style={{ fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "var(--tracking-wider)", color: "var(--color-gold)", margin: "0 0 var(--space-2)" }}>Lecture systémique</p>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: "var(--leading-normal)", margin: 0 }}>{table.lecture}</p>
            </div>
          )}

          {/* Questions */}
          {table.questions?.length > 0 && (
            <div style={{ marginTop: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {table.questions.map((q, i) => (
                <div key={i} style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)" }}>
                  <span style={{ color: "var(--color-gold)", marginRight: 8 }}>?</span>{q}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
