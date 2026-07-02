import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/stores/useUserStore";
import { useChatStore } from "@/stores/useChatStore";
import type { Profile } from "@/types";

// En-tête mobile compact — marque à gauche, accès Nova + profil à droite.
function initials(p: Profile | null): string {
  const src = p?.name || p?.email || "";
  const parts = src.trim().split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function MobileHeader() {
  const navigate = useNavigate();
  const profile = useUserStore((s) => s.profile);
  const setOpen = useChatStore((s) => s.setOpen);

  return (
    <header
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-3)",
        padding: "12px var(--space-5)",
        background: "var(--color-bg-surface)",
        borderBottom: "var(--border-subtle)",
      }}
    >
      {/* Marque */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        {profile?.logo_url ? (
          <img src={profile.logo_url} alt={profile.brand_name ?? "Logo"} style={{ maxHeight: 26, maxWidth: 120, objectFit: "contain" }} />
        ) : (
          <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", color: "var(--color-gold)", letterSpacing: "var(--tracking-tight)", whiteSpace: "nowrap" }}>
            {profile?.brand_name || "Nova Solo"}
          </span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexShrink: 0 }}>
        <button
          onClick={() => setOpen(true)}
          aria-label="Ouvrir Nova"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-gold)", background: "transparent",
            color: "var(--color-gold)", fontFamily: "var(--font-body)", fontSize: "var(--text-xs)",
            fontWeight: 500, letterSpacing: "var(--tracking-wide)", cursor: "pointer",
          }}
        >
          Nova
        </button>
        <button
          onClick={() => navigate("/settings")}
          aria-label="Mon profil"
          style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "var(--color-gold-glow)", border: "var(--border-gold)",
            color: "var(--color-gold)", fontFamily: "var(--font-display)", fontSize: "var(--text-xs)",
            fontWeight: 600, cursor: "pointer", flexShrink: 0,
          }}
        >
          {initials(profile)}
        </button>
      </div>
    </header>
  );
}
