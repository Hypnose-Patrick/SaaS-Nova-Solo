import { NavLink } from "react-router-dom";
import { useUserStore } from "@/stores/useUserStore";
import type { Profile } from "@/types";

// Navigation regroupée par thématique de parcours (pilotage → stratégie →
// acquisition → gestion → compte). Générique : aucun lien personnel.
const SECTIONS: { title: string; items: { to: string; label: string; icon: string }[] }[] = [
  {
    title: "Pilotage",
    items: [
      { to: "/", label: "Tableau de bord", icon: "◈" },
      { to: "/diagnostic", label: "Diagnostic", icon: "◎" },
    ],
  },
  {
    title: "Stratégie",
    items: [
      { to: "/bmc", label: "BMC", icon: "⊞" },
      { to: "/business-plan", label: "Business Plan", icon: "◻" },
      { to: "/symbolique", label: "Vision symbolique", icon: "✦" },
      { to: "/pricing", label: "Offre & Pricing", icon: "◇" },
    ],
  },
  {
    title: "Acquisition",
    items: [
      { to: "/cv", label: "CV personnalisé", icon: "◻" },
      { to: "/dossier", label: "Dossier", icon: "◻" },
      { to: "/contrat", label: "Contrat", icon: "◻" },
      { to: "/pipeline", label: "Pipeline", icon: "◈" },
      { to: "/marketing", label: "Marketing & Visibilité", icon: "◫" },
      { to: "/mirrorfisch", label: "Test d'audience", icon: "◎" },
      { to: "/hermes", label: "Cabinet Hermès", icon: "♟" },
    ],
  },
  {
    title: "Gestion",
    items: [
      { to: "/finances", label: "Finances", icon: "◇" },
      { to: "/compta", label: "Comptabilité", icon: "◈" },
      { to: "/facture", label: "Factures", icon: "◻" },
      { to: "/agenda", label: "Agenda", icon: "◎" },
      { to: "/documents", label: "Documents", icon: "◻" },
    ],
  },
  {
    title: "Compte",
    items: [{ to: "/settings", label: "Réglages", icon: "◈" }],
  },
];

// Étapes de mise en route — jalons dérivés du profil et des livrables.
// Barre vide pour un nouvel abonné, se remplit au fil de sa progression.
const MILESTONES: { label: string; done: (p: Profile) => boolean }[] = [
  { label: "Profil renseigné", done: (p) => Boolean(p.name && p.domaine) },
  { label: "Statut & situation", done: (p) => Boolean(p.statut && p.situation) },
  { label: "Localisation", done: (p) => Boolean(p.ville || p.canton) },
  { label: "Marque définie", done: (p) => Boolean(p.brand_name || p.slogan) },
  { label: "Offre tarifée", done: (p) => Boolean(p.pricing_tarif) },
  { label: "Présentation rédigée", done: (p) => Boolean(p.bio || p.profil) },
];

function initials(p: Profile | null): string {
  const src = p?.name || p?.email || "";
  const parts = src.trim().split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function Sidebar() {
  const profile = useUserStore((s) => s.profile);

  const doneCount = profile ? MILESTONES.filter((m) => m.done(profile)).length : 0;
  const progress = Math.round((doneCount / MILESTONES.length) * 100);

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

      {/* Carte profil + plan de route */}
      <NavLink
        to="/settings"
        style={{
          textDecoration: "none",
          padding: "var(--space-4) var(--space-6)",
          borderBottom: "var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "rgba(197,165,114,0.12)",
              border: "var(--border-gold)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-gold)",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              letterSpacing: "var(--tracking-wide)",
              flexShrink: 0,
            }}
          >
            {initials(profile)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-primary)",
                fontWeight: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {profile?.name || profile?.email || "Mon profil"}
            </div>
            {profile?.statut && (
              <div
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {profile.statut}
              </div>
            )}
          </div>
        </div>

        {/* Plan de route — barre de progression */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: "var(--color-text-muted)",
              letterSpacing: "var(--tracking-wide)",
              textTransform: "uppercase",
            }}
          >
            <span>Plan de route</span>
            <span style={{ color: "var(--color-gold)" }}>{progress}%</span>
          </div>
          <div
            style={{
              height: 4,
              borderRadius: 2,
              background: "rgba(255,255,255,0.06)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "var(--color-gold)",
                transition: "width var(--transition-base)",
              }}
            />
          </div>
        </div>
      </NavLink>

      {/* Nav par sections */}
      <nav style={{ flex: 1, padding: "var(--space-3) 0" }}>
        {SECTIONS.map((section) => (
          <div key={section.title} style={{ marginBottom: "var(--space-3)" }}>
            <div
              style={{
                padding: "var(--space-2) var(--space-6)",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "var(--tracking-wider)",
                textTransform: "uppercase",
                color: "var(--color-text-muted)",
                opacity: 0.7,
              }}
            >
              {section.title}
            </div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                style={({ isActive }) => ({
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  padding: "var(--space-2) var(--space-6)",
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
          </div>
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
