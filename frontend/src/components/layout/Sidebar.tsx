import { NavLink } from "react-router-dom";
import { useUserStore } from "@/stores/useUserStore";

const NAV = [
  { to: "/", label: "Tableau de bord", icon: "◈" },
  { to: "/diagnostic", label: "Diagnostic", icon: "◎" },
  { to: "/bmc", label: "BMC", icon: "⊞" },
  { to: "/business-plan", label: "Business Plan", icon: "◻" },
  { to: "/symbolique", label: "Vision symbolique", icon: "✦" },
  { to: "/pricing", label: "Offre & Pricing", icon: "◇" },
  { to: "/cv", label: "CV personnalisé", icon: "◻" },
  { to: "/dossier", label: "Dossier", icon: "◻" },
  { to: "/contrat", label: "Contrat", icon: "◻" },
  { to: "/pipeline", label: "Pipeline", icon: "◈" },
  { to: "/marketing", label: "Marketing & Visibilité", icon: "◫" },
  { to: "/mirrorfisch", label: "Test d'audience", icon: "◎" },
  { to: "/hermes", label: "Cabinet Hermès", icon: "♟" },
  { to: "/finances", label: "Finances", icon: "◇" },
  { to: "/compta", label: "Comptabilité", icon: "◈" },
  { to: "/facture", label: "Factures", icon: "◻" },
  { to: "/agenda", label: "Agenda", icon: "◎" },
  { to: "/documents", label: "Documents", icon: "◻" },
  { to: "/settings", label: "Réglages", icon: "◈" },
];

export function Sidebar() {
  const profile = useUserStore((s) => s.profile);

  return (
    <aside
      style={{
        width: 240,
        minHeight: "100vh",
        background: "#0d0d0d",
        borderRight: "var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "var(--space-6) var(--space-6) var(--space-4)",
          borderBottom: "var(--border-subtle)",
        }}
      >
        {profile?.logo_url ? (
          <img
            src={profile.logo_url}
            alt={profile.brand_name ?? "Logo"}
            style={{ maxHeight: 40, maxWidth: "100%", objectFit: "contain", display: "block" }}
          />
        ) : (
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-xl)",
              color: "var(--color-gold)",
              letterSpacing: "var(--tracking-tight)",
            }}
          >
            {profile?.brand_name || "Nova Solo"}
          </span>
        )}
        {profile?.logo_url && profile?.brand_name && (
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-text-muted)",
              marginTop: "var(--space-2)",
              letterSpacing: "var(--tracking-wide)",
            }}
          >
            {profile.brand_name}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "var(--space-3) 0" }}>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              padding: "var(--space-3) var(--space-6)",
              color: isActive ? "var(--color-gold)" : "var(--color-text-secondary)",
              textDecoration: "none",
              fontSize: "var(--text-sm)",
              fontWeight: isActive ? 500 : 400,
              borderLeft: isActive ? "2px solid var(--color-gold)" : "2px solid transparent",
              background: isActive ? "rgba(197,165,114,0.05)" : "transparent",
              transition: "all var(--transition-fast)",
            })}
          >
            <span style={{ fontSize: 14, opacity: 0.7 }}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div
        style={{
          padding: "var(--space-4) var(--space-6)",
          borderTop: "var(--border-subtle)",
          fontSize: "var(--text-xs)",
          color: "var(--color-text-muted)",
        }}
      >
        {profile?.name ?? profile?.email ?? "—"}
      </div>
    </aside>
  );
}
