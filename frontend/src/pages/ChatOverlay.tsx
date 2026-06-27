import { useState, useRef, useEffect } from "react";
import { useChatStore } from "@/stores/useChatStore";
import { useUserStore } from "@/stores/useUserStore";
import { Button } from "@/components/ui/Button";
import type { AgentKey } from "@/types";

const AGENTS: { key: AgentKey; label: string }[] = [
  { key: "nova", label: "Nova" },
  { key: "juriste", label: "Juriste" },
  { key: "strategist", label: "Stratège" },
  { key: "financier", label: "Financier" },
  { key: "communicant", label: "Comm." },
  { key: "commercial", label: "Commercial" },
  { key: "technicien", label: "Tech." },
];

export function ChatOverlay() {
  const { messages, thinking, open, activeAgent, setOpen, setAgent, send } =
    useChatStore();
  const profile = useUserStore((s) => s.profile);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [open, messages.length]);

  if (!open) return null;

  function handleSend() {
    if (!text.trim() || !profile?.id || thinking) return;
    send(text.trim(), profile.id);
    setText("");
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: "var(--space-6)",
        right: "var(--space-6)",
        width: 420,
        maxHeight: "80vh",
        background: "var(--color-bg-elevated)",
        border: "var(--border-gold)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-xl)",
        display: "flex",
        flexDirection: "column",
        zIndex: "var(--z-modal)",
        backdropFilter: "blur(12px)",
      }}
      role="dialog"
      aria-label="Cabinet Nova"
    >
      {/* En-tête */}
      <div
        style={{
          padding: "var(--space-4) var(--space-5)",
          borderBottom: "var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-lg)",
            color: "var(--color-gold)",
          }}
        >
          Cabinet Nova
        </span>
        <button
          onClick={() => setOpen(false)}
          aria-label="Fermer"
          style={{
            background: "none",
            border: "none",
            color: "var(--color-text-muted)",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            padding: 4,
          }}
        >
          ✕
        </button>
      </div>

      {/* Sélecteur d'agent */}
      <div
        style={{
          padding: "var(--space-2) var(--space-4)",
          borderBottom: "var(--border-subtle)",
          display: "flex",
          gap: "var(--space-1)",
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        {AGENTS.map((a) => (
          <button
            key={a.key}
            onClick={() => setAgent(a.key)}
            style={{
              padding: "2px 10px",
              borderRadius: "var(--radius-xs)",
              border: `1px solid ${activeAgent === a.key ? "var(--color-gold)" : "rgba(255,255,255,0.08)"}`,
              background:
                activeAgent === a.key ? "rgba(197,165,114,0.12)" : "transparent",
              color:
                activeAgent === a.key
                  ? "var(--color-gold)"
                  : "var(--color-text-muted)",
              fontSize: "var(--text-xs)",
              cursor: "pointer",
              letterSpacing: "var(--tracking-wide)",
              transition: "all var(--transition-fast)",
            }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "var(--space-4) var(--space-5)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
          minHeight: 200,
        }}
      >
        {messages.length === 0 && (
          <p
            style={{
              color: "var(--color-text-muted)",
              fontSize: "var(--text-sm)",
              textAlign: "center",
              marginTop: "var(--space-8)",
            }}
          >
            Posez votre question à{" "}
            <span style={{ color: "var(--color-gold)" }}>
              {AGENTS.find((a) => a.key === activeAgent)?.label}
            </span>
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "88%",
              padding: "var(--space-3) var(--space-4)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--text-sm)",
              lineHeight: "var(--leading-normal)",
              background:
                m.role === "user"
                  ? "rgba(197,165,114,0.15)"
                  : "rgba(255,255,255,0.04)",
              color:
                m.role === "user"
                  ? "var(--color-text-primary)"
                  : "var(--color-text-secondary)",
              border:
                m.role === "user"
                  ? "1px solid rgba(197,165,114,0.2)"
                  : "var(--border-subtle)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {m.content}
          </div>
        ))}
        {thinking && (
          <div
            style={{
              alignSelf: "flex-start",
              color: "var(--color-gold-muted)",
              fontSize: "var(--text-xs)",
              letterSpacing: "var(--tracking-wide)",
            }}
          >
            Nova réfléchit…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: "var(--space-3) var(--space-4)",
          borderTop: "var(--border-subtle)",
          display: "flex",
          gap: "var(--space-2)",
          flexShrink: 0,
        }}
      >
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Votre question… (Entrée pour envoyer)"
          rows={2}
          style={{
            flex: 1,
            background: "var(--color-bg-input)",
            border: "var(--border-subtle)",
            borderRadius: "var(--radius-sm)",
            color: "var(--color-text-primary)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-sm)",
            padding: "var(--space-2) var(--space-3)",
            outline: "none",
            resize: "none",
            lineHeight: "var(--leading-normal)",
          }}
        />
        <Button
          size="sm"
          variant="gold"
          onClick={handleSend}
          loading={thinking}
          disabled={!text.trim()}
          style={{ alignSelf: "flex-end" }}
        >
          →
        </Button>
      </div>
    </div>
  );
}
