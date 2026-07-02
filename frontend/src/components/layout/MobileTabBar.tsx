import { NavLink } from "react-router-dom";

// Barre d'onglets basse — visible uniquement en mobile (montée par AppShell).
// Câblée aux routes existantes ; l'onglet actif passe en or.
type TabDef = { to: string; label: string; end?: boolean; icon: React.ReactNode };

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const TABS: TabDef[] = [
  {
    to: "/", label: "Tableau", end: true,
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" {...stroke}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    to: "/diagnostic", label: "Diagnostic",
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" {...stroke}>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    to: "/pipeline", label: "Pipeline",
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" {...stroke}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: "/finances", label: "Finances",
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" {...stroke}>
        <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    to: "/settings", label: "Plus",
    icon: (
      <svg width="21" height="21" viewBox="0 0 24 24" {...stroke}>
        <circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" />
      </svg>
    ),
  },
];

export function MobileTabBar() {
  return (
    <nav
      style={{
        flexShrink: 0,
        display: "flex",
        background: "var(--color-bg-surface)",
        borderTop: "var(--border-subtle)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          style={({ isActive }) => ({
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            padding: "8px 4px 10px",
            textDecoration: "none",
            color: isActive ? "var(--color-gold)" : "var(--color-text-muted)",
            fontFamily: "var(--font-body)",
            fontSize: 10,
            fontWeight: isActive ? 600 : 400,
            letterSpacing: "0.01em",
            transition: "color var(--transition-base)",
          })}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
