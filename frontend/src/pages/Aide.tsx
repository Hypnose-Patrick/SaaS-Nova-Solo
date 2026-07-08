import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PARCOURS_GUIDE, TUTORIELS, VIDEO_BASE } from "@/lib/tutoriels";

// Centre d'aide : un module par onglet de l'app, vidéo (bunny.net) + guide
// écrit au format 4MAT (Pourquoi / Quoi / Comment / Et alors) pour celles et
// ceux qui préfèrent lire et avancer pas à pas plutôt que regarder une vidéo.

export function Aide() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  const filtered = TUTORIELS.filter((t) =>
    query.trim() === "" || t.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: 920 }}>
      <PageHeader
        title="Aide & tutoriels"
        subtitle="Une vidéo courte et un guide pas à pas par module — choisis ce qui te convient."
      />

      <Card style={{ padding: "var(--space-6)", border: "1px solid var(--color-gold)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-md)",
              color: "var(--color-text-primary)",
            }}
          >
            {PARCOURS_GUIDE.title}
          </span>
          <FourMat label="Pourquoi" text={PARCOURS_GUIDE.why} />
          <FourMat label="Quoi" text={PARCOURS_GUIDE.what} />
          <FourMat label="Comment" text={PARCOURS_GUIDE.how} />
          <FourMat label="Et alors" text={PARCOURS_GUIDE.sowhat} />
        </div>
      </Card>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher un module (ex. Factures, Agenda, Terrain…)"
        style={{
          background: "var(--color-bg-input)",
          border: "var(--border-subtle)",
          borderRadius: "var(--radius-sm)",
          color: "var(--color-text-primary)",
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-sm)",
          padding: "var(--space-3) var(--space-4)",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {filtered.map((t) => {
          const isOpen = open === t.n;
          return (
            <Card key={t.n} style={{ padding: 0, overflow: "hidden" }}>
              <button
                onClick={() => setOpen(isOpen ? null : t.n)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-4)",
                  padding: "var(--space-5) var(--space-6)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: 18, opacity: 0.8 }}>{t.icon}</span>
                <span style={{ flex: 1 }}>
                  <span
                    style={{
                      display: "block",
                      fontFamily: "var(--font-display)",
                      fontSize: "var(--text-md)",
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {String(t.n).padStart(2, "0")} — {t.title}
                  </span>
                  {!t.hasVideo && (
                    <span
                      style={{
                        display: "inline-block",
                        marginTop: 4,
                        fontSize: "var(--text-xs)",
                        letterSpacing: "var(--tracking-wide)",
                        textTransform: "uppercase",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      Vidéo à venir — guide écrit disponible
                    </span>
                  )}
                </span>
                <span style={{ color: "var(--color-gold)", fontSize: "var(--text-sm)" }}>
                  {isOpen ? "▲" : "▼"}
                </span>
              </button>

              {isOpen && (
                <div
                  style={{
                    padding: "0 var(--space-6) var(--space-6)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-5)",
                  }}
                >
                  {t.hasVideo && (
                    <video
                      key={t.slug}
                      controls
                      preload="none"
                      style={{ width: "100%", borderRadius: "var(--radius-md)", background: "#000" }}
                      src={`${VIDEO_BASE}${t.slug}.mp4`}
                    />
                  )}

                  <FourMat label="Pourquoi" text={t.why} />
                  <FourMat label="Quoi" text={t.what} />
                  <FourMat label="Comment" text={t.how} />
                  <FourMat label="Et alors" text={t.sowhat} />

                  <Link
                    to={t.route}
                    style={{
                      alignSelf: "flex-start",
                      fontSize: "var(--text-xs)",
                      letterSpacing: "var(--tracking-wider)",
                      textTransform: "uppercase",
                      color: "var(--color-gold)",
                      textDecoration: "none",
                      border: "1px solid var(--color-gold)",
                      borderRadius: "var(--radius-xs)",
                      padding: "var(--space-2) var(--space-4)",
                    }}
                  >
                    Ouvrir {t.title} →
                  </Link>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function FourMat({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <span
        style={{
          display: "block",
          fontSize: "var(--text-xs)",
          fontWeight: 600,
          letterSpacing: "var(--tracking-wider)",
          textTransform: "uppercase",
          color: "var(--color-gold)",
          marginBottom: "var(--space-1)",
        }}
      >
        {label}
      </span>
      <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
        {text}
      </p>
    </div>
  );
}
