import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useChatStore } from "@/stores/useChatStore";
import { useUserStore } from "@/stores/useUserStore";
import { helpForPath } from "@/lib/pageHelp";
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

// Typage minimal de la Web Speech API (absente de lib.dom).
interface SpeechResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function ChatOverlay() {
  const { messages, thinking, open, activeAgent, setOpen, setAgent, send } =
    useChatStore();
  const profile = useUserStore((s) => s.profile);
  const { pathname } = useLocation();
  const pageHelp = helpForPath(pathname);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const speechSupported = useMemo(() => Boolean(getSpeechCtor()), []);

  // Contexte transmis à Nova : l'écran courant + l'essentiel du profil de
  // l'abonné (ses propres données). Permet une aide située et personnalisée.
  function pageContext(): unknown {
    return {
      ecran: pageHelp.title,
      role_ecran: pageHelp.blurb,
      profil: profile
        ? {
            prenom: profile.name ?? undefined,
            domaine: profile.domaine ?? undefined,
            situation: profile.situation ?? undefined,
            statut: profile.statut ?? undefined,
            localisation: [profile.ville, profile.canton].filter(Boolean).join(" ") || undefined,
          }
        : undefined,
    };
  }

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [open, messages.length]);

  // Coupe la dictée si l'overlay se ferme ou se démonte.
  useEffect(() => {
    if (!open && recognitionRef.current) {
      recognitionRef.current.stop();
    }
    return () => recognitionRef.current?.stop();
  }, [open]);

  // Fermé → bulle d'aide flottante (toujours visible, sur chaque écran).
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Ouvrir l'aide Nova"
        title={`Besoin d'aide ? — ${pageHelp.title}`}
        style={{
          position: "fixed",
          bottom: "var(--space-6)",
          right: "var(--space-6)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          padding: "var(--space-3) var(--space-5)",
          borderRadius: 999,
          border: "var(--border-gold)",
          background: "var(--color-bg-elevated)",
          color: "var(--color-gold)",
          boxShadow: "var(--shadow-xl)",
          cursor: "pointer",
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-sm)",
          letterSpacing: "var(--tracking-wide)",
          backdropFilter: "blur(12px)",
          zIndex: "var(--z-modal)",
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>✦</span>
        <span>Aide</span>
      </button>
    );
  }

  function submit(value: string) {
    const v = value.trim();
    if (!v || !profile?.id || thinking) return;
    recognitionRef.current?.stop();
    send(v, profile.id, pageContext());
    setText("");
  }

  // Question suggérée : route d'abord vers l'expert le plus pertinent pour l'écran.
  function submitSuggestion(value: string) {
    setAgent(pageHelp.agent);
    submit(value);
  }

  function handleSend() {
    submit(text);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function toggleDictation() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getSpeechCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "fr-CH";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      let chunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) chunk += e.results[i][0].transcript;
      }
      const clean = chunk.trim();
      if (clean) setText((t) => (t ? `${t} ${clean}` : clean));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  const shortcuts = pageHelp.suggestions;

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
          <div style={{ marginTop: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-3)", alignItems: "center" }}>
            <p
              style={{
                color: "var(--color-text-muted)",
                fontSize: "var(--text-sm)",
                textAlign: "center",
                margin: 0,
              }}
            >
              Vous êtes sur{" "}
              <span style={{ color: "var(--color-gold)" }}>{pageHelp.title}</span>
              <br />
              <span style={{ fontSize: "var(--text-xs)" }}>{pageHelp.blurb}</span>
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", width: "100%" }}>
              {shortcuts.map((s) => (
                <button
                  key={s}
                  onClick={() => submitSuggestion(s)}
                  disabled={thinking}
                  style={{
                    textAlign: "left",
                    padding: "var(--space-2) var(--space-3)",
                    borderRadius: "var(--radius-sm)",
                    border: "var(--border-subtle)",
                    background: "rgba(255,255,255,0.03)",
                    color: "var(--color-text-secondary)",
                    fontSize: "var(--text-xs)",
                    cursor: thinking ? "default" : "pointer",
                    transition: "all var(--transition-fast)",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
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
          placeholder={listening ? "Dictée en cours… parlez" : "Votre question… (Entrée pour envoyer)"}
          rows={2}
          style={{
            flex: 1,
            background: "var(--color-bg-input)",
            border: listening ? "1px solid var(--color-gold)" : "var(--border-subtle)",
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
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", alignSelf: "flex-end" }}>
          {speechSupported && (
            <button
              onClick={toggleDictation}
              aria-label={listening ? "Arrêter la dictée" : "Dicter à la voix"}
              title={listening ? "Arrêter la dictée" : "Dicter à la voix"}
              style={{
                width: 34,
                height: 34,
                borderRadius: "var(--radius-sm)",
                border: listening ? "1px solid var(--color-gold)" : "var(--border-subtle)",
                background: listening ? "rgba(197,165,114,0.15)" : "transparent",
                color: listening ? "var(--color-gold)" : "var(--color-text-muted)",
                cursor: "pointer",
                fontSize: 15,
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all var(--transition-fast)",
              }}
            >
              {listening ? "■" : "🎤"}
            </button>
          )}
          <Button
            size="sm"
            variant="gold"
            onClick={handleSend}
            loading={thinking}
            disabled={!text.trim()}
          >
            →
          </Button>
        </div>
      </div>
    </div>
  );
}
