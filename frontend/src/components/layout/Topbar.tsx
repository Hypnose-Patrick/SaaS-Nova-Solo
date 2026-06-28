import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useUserStore } from "@/stores/useUserStore";
import { useChatStore } from "@/stores/useChatStore";
import { Button } from "@/components/ui/Button";

interface TopbarProps {
  title: string;
}

const STATUT_LABEL: Record<string, string> = {
  laci: "Demandeur d'emploi (LACI)",
  reconversion: "Reconversion",
  creation: "Création d'activité",
  existant: "Activité existante",
};

export function Topbar({ title }: TopbarProps) {
  const navigate = useNavigate();
  const profile = useUserStore((s) => s.profile);
  const reset = useUserStore((s) => s.reset);
  const chatReset = useChatStore((s) => s.clearLocal);
  const setOpen = useChatStore((s) => s.setOpen);

  async function handleSignOut() {
    await supabase.auth.signOut();
    reset();
    chatReset();
  }

  // Indicateur de contexte : ce que Nova « sait » de l'utilisateur.
  const ctxParts = [
    profile?.statut ? STATUT_LABEL[profile.statut] ?? profile.statut : null,
    profile?.domaine,
    profile?.ville || profile?.canton,
  ].filter(Boolean) as string[];
  const hasContext = ctxParts.length > 0;

  return (
    <header
      style={{
        height: 56,
        borderBottom: "var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 var(--space-6)",
        background: "var(--color-bg-primary)",
        flexShrink: 0,
        gap: "var(--space-4)",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-lg)",
          fontWeight: 400,
          color: "var(--color-text-primary)",
          margin: 0,
          flexShrink: 0,
        }}
      >
        {title}
      </h1>

      {/* Indicateur de contexte */}
      <button
        onClick={() => navigate("/settings")}
        title={hasContext ? "Contexte pris en compte par Nova — cliquez pour ajuster" : "Renseignez votre profil pour personnaliser Nova"}
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--color-text-muted)",
          fontSize: "var(--text-xs)",
          padding: 0,
          overflow: "hidden",
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: hasContext ? "var(--color-success)" : "var(--color-warning)",
            flexShrink: 0,
            boxShadow: hasContext ? "0 0 6px var(--color-success)" : "none",
          }}
        />
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            letterSpacing: "var(--tracking-wide)",
          }}
        >
          {hasContext ? ctxParts.join(" · ") : "Profil à compléter"}
        </span>
      </button>

      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexShrink: 0 }}>
        <Button size="sm" variant="ghost" onClick={() => navigate("/diagnostic")} aria-label="Lancer le diagnostic">
          Diagnostic
        </Button>
        <Button size="sm" variant="gold" onClick={() => setOpen(true)} aria-label="Ouvrir Nova">
          Nova
        </Button>
        <Button size="sm" variant="ghost" onClick={handleSignOut}>
          Quitter
        </Button>
      </div>
    </header>
  );
}
