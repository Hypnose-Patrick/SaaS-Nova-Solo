import { useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useUserStore } from "@/stores/useUserStore";
import { askAgent } from "@/lib/ai";
import { loadLocal, saveLocal } from "@/lib/local";
import type { AgentKey } from "@/types";

// Les 6 agents-conseils du Cabinet Hermès (nova = copilote global, hors cabinet).
interface Conseiller {
  key: Exclude<AgentKey, "nova">;
  label: string;
  icon: string;
  tagline: string;
  blurb: string;
  starter: string;
}

const CONSEILLERS: Conseiller[] = [
  { key: "strategist", label: "Stratège", icon: "♟", tagline: "Stratégie & positionnement",
    blurb: "Analyse concurrentielle, différenciation, choix de niche, développement à 3 ans.",
    starter: "Aide-moi à clarifier mon positionnement et ma niche." },
  { key: "financier", label: "Financier", icon: "◇", tagline: "Finance & trésorerie",
    blurb: "Prévisionnel, rentabilité, TVA suisse, pilier 3a, gestion du runway.",
    starter: "Mon prévisionnel tient-il la route ? Où sont mes risques de trésorerie ?" },
  { key: "communicant", label: "Communicant", icon: "◫", tagline: "Marketing & communication",
    blurb: "Positionnement de marque, contenu LinkedIn, copywriting, visibilité Suisse romande.",
    starter: "Quel angle de communication adopter pour me rendre visible ?" },
  { key: "commercial", label: "Commercial", icon: "◈", tagline: "Business development & vente",
    blurb: "Prospection, négociation, partenariats, closing.",
    starter: "Comment structurer ma prospection pour décrocher mes premiers clients ?" },
  { key: "juriste", label: "Juriste", icon: "⚖", tagline: "Juridique & conformité suisse",
    blurb: "Statut RI vs Sàrl, Registre du Commerce, nLPD, contrats.",
    starter: "RI ou Sàrl pour démarrer mon activité ? Quels critères ?" },
  { key: "technicien", label: "Technicien", icon: "⚙", tagline: "Tech & outils",
    blurb: "Choix d'outils, site web, automatisation, CRM, facturation.",
    starter: "Quelle pile d'outils minimale pour lancer mon activité solo ?" },
];

interface Turn {
  role: "user" | "assistant";
  content: string;
}

export function Hermes() {
  const profile = useUserStore((s) => s.profile);
  const [active, setActive] = useState<Conseiller | null>(null);
  const [threads, setThreads] = useState<Record<string, Turn[]>>(() =>
    loadLocal("ns_hermes_threads", {} as Record<string, Turn[]>),
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const history = active ? threads[active.key] ?? [] : [];

  function persist(next: Record<string, Turn[]>) {
    setThreads(next);
    saveLocal("ns_hermes_threads", next);
  }

  async function send(text?: string) {
    if (!active) return;
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setError(null);
    setInput("");
    const prior = threads[active.key] ?? [];
    const withUser = [...prior, { role: "user" as const, content: msg }];
    persist({ ...threads, [active.key]: withUser });
    setSending(true);
    try {
      const reply = await askAgent(active.key, msg, profile ?? {}, prior);
      persist({ ...threads, [active.key]: [...withUser, { role: "assistant", content: reply }] });
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
    } catch {
      setError("La réponse n'a pas pu être générée. Réessayez.");
      // On retire le tour utilisateur resté sans réponse pour pouvoir réessayer proprement.
      persist({ ...threads, [active.key]: prior });
      setInput(msg);
    }
    setSending(false);
  }

  function clearThread() {
    if (!active) return;
    const next = { ...threads };
    delete next[active.key];
    persist(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <PageHeader
        title="Cabinet Hermès"
        subtitle="Six conseillers IA spécialisés. Chacun raisonne avec votre profil en contexte — consultez celui dont vous avez besoin."
      />

      {/* Grille des conseillers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "var(--space-4)" }}>
        {CONSEILLERS.map((c) => {
          const count = (threads[c.key] ?? []).filter((t) => t.role === "user").length;
          const isActive = active?.key === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setActive(c)}
              style={{
                textAlign: "left",
                background: isActive ? "rgba(197,165,114,0.06)" : "var(--color-bg-surface)",
                border: isActive ? "1px solid var(--color-gold)" : "var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-5)",
                cursor: "pointer",
                transition: "all var(--transition-fast)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <span style={{ fontSize: 22, color: "var(--color-gold)" }}>{c.icon}</span>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", color: "var(--color-text-primary)" }}>{c.label}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gold-muted)", letterSpacing: "var(--tracking-wide)" }}>{c.tagline}</div>
                </div>
                {count > 0 && (
                  <span style={{ marginLeft: "auto", fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>{count}</span>
                )}
              </div>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", lineHeight: "var(--leading-relaxed)", margin: 0 }}>{c.blurb}</p>
            </button>
          );
        })}
      </div>

      {/* Consultation */}
      {active && (
        <Card glass title={`${active.icon}  ${active.label} — ${active.tagline}`}
          action={history.length > 0 ? <Button size="sm" variant="ghost" onClick={clearThread}>Effacer</Button> : undefined}>
          <div
            ref={scrollRef}
            style={{ maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}
          >
            {history.length === 0 && (
              <button
                onClick={() => send(active.starter)}
                style={{ textAlign: "left", background: "var(--color-bg-input)", border: "var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "var(--space-3) var(--space-4)", color: "var(--color-text-secondary)", fontSize: "var(--text-sm)", cursor: "pointer", fontStyle: "italic" }}
              >
                💬 {active.starter}
              </button>
            )}
            {history.map((t, i) => (
              <div
                key={i}
                style={{
                  alignSelf: t.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  background: t.role === "user" ? "rgba(197,165,114,0.12)" : "var(--color-bg-input)",
                  border: "var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  padding: "var(--space-3) var(--space-4)",
                  color: "var(--color-text-primary)",
                  fontSize: "var(--text-sm)",
                  lineHeight: "var(--leading-relaxed)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {t.content}
              </div>
            ))}
            {sending && (
              <div style={{ alignSelf: "flex-start", color: "var(--color-text-muted)", fontSize: "var(--text-sm)", fontStyle: "italic" }}>
                {active.label} réfléchit…
              </div>
            )}
          </div>

          {error && <p style={{ color: "var(--color-danger)", fontSize: "var(--text-xs)", margin: "0 0 var(--space-2)" }}>{error}</p>}

          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder={`Posez votre question au ${active.label}…`}
              style={{ flex: 1, background: "var(--color-bg-input)", border: "var(--border-subtle)", borderRadius: "var(--radius-sm)", color: "var(--color-text-primary)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", padding: "var(--space-3) var(--space-4)", outline: "none" }}
            />
            <Button variant="gold" loading={sending} disabled={!input.trim()} onClick={() => send()}>
              Envoyer
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
