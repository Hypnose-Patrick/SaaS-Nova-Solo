import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/stores/useUserStore";

// Sélecteur de projet — n'affiche rien pour un compte à 1 seul projet (cas
// BYOK/Pro, l'immense majorité des abonnés) afin de ne pas alourdir l'UI.
// Visible dès qu'un compte a créé un 2e projet, ou dès que son palier
// autorise plusieurs projets (Trio) pour donner accès au bouton "+ Nouveau".
interface ProjectSwitcherProps {
  /** Rendu compact sans padding/bordure de bloc — pour une insertion dans une barre horizontale (MobileHeader). */
  compact?: boolean;
}

export function ProjectSwitcher({ compact = false }: ProjectSwitcherProps) {
  const navigate = useNavigate();
  const account = useUserStore((s) => s.account);
  const projects = useUserStore((s) => s.projects);
  const profile = useUserStore((s) => s.profile);
  const setActiveProject = useUserStore((s) => s.setActiveProject);
  const createProject = useUserStore((s) => s.createProject);

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const maxProjects = account?.max_projects ?? 1;
  const atLimit = projects.length >= maxProjects;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (maxProjects <= 1 && projects.length <= 1) return null;

  async function handleCreate() {
    if (atLimit) {
      setOpen(false);
      navigate("/subscribe");
      return;
    }
    setCreating(true);
    setError(null);
    const { error: err } = await createProject();
    setCreating(false);
    if (err) setError(err);
    else setOpen(false);
  }

  return (
    <div
      ref={rootRef}
      style={
        compact
          ? { position: "relative", minWidth: 160 }
          : { position: "relative", padding: "var(--space-3) var(--space-6)", borderBottom: "var(--border-subtle)" }
      }
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          width: "100%",
          padding: "var(--space-2) var(--space-3)",
          background: "rgba(197,165,114,0.06)",
          border: "1px solid rgba(197,165,114,0.2)",
          borderRadius: "var(--radius-xs)",
          color: "var(--color-text-primary)",
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-xs)",
          cursor: "pointer",
          textAlign: "left",
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {profile?.project_name || "Mon activité"}
        </span>
        <span style={{ color: "var(--color-text-muted)", fontSize: 10 }}>
          {projects.length}/{maxProjects}
        </span>
        <span style={{ color: "var(--color-gold)", fontSize: 10, transform: open ? "rotate(180deg)" : "none" }}>▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 30,
            background: "var(--color-bg-surface)",
            border: "var(--border-subtle)",
            borderRadius: "var(--radius-sm)",
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden",
          }}
        >
          {projects.map((p) => (
            <button
              key={p.id}
              role="option"
              aria-selected={p.id === profile?.id}
              onClick={() => {
                setActiveProject(p.id);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "var(--space-3) var(--space-4)",
                background: p.id === profile?.id ? "rgba(197,165,114,0.1)" : "transparent",
                border: "none",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                color: p.id === profile?.id ? "var(--color-gold)" : "var(--color-text-secondary)",
                fontSize: "var(--text-xs)",
                cursor: "pointer",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {p.project_name || "Mon activité"}
            </button>
          ))}
          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "var(--space-3) var(--space-4)",
              background: "transparent",
              border: "none",
              color: atLimit ? "var(--color-text-muted)" : "var(--color-gold)",
              fontSize: "var(--text-xs)",
              fontWeight: 500,
              cursor: creating ? "not-allowed" : "pointer",
            }}
          >
            {creating ? "Création…" : atLimit ? "Limite atteinte — passer au palier supérieur" : "+ Nouveau projet"}
          </button>
          {error && (
            <div style={{ padding: "var(--space-2) var(--space-4)", fontSize: "var(--text-xs)", color: "var(--color-danger, #ef4444)" }}>
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
