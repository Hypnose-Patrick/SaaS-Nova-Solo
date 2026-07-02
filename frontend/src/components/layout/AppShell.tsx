import { useEffect } from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileHeader } from "./MobileHeader";
import { MobileTabBar } from "./MobileTabBar";
import { ChatOverlay } from "@/pages/ChatOverlay";
import { useUserStore } from "@/stores/useUserStore";
import { useIsMobile } from "@/lib/useIsMobile";
import { applyAccent } from "@/lib/theme";

const PAGE_TITLES: Record<string, string> = {
  "/": "Tableau de bord",
  "/diagnostic": "Diagnostic",
  "/bmc": "Business Model Canvas",
  "/business-plan": "Business Plan",
  "/pipeline": "Pipeline commercial",
  "/finances": "Finances",
  "/compta": "Comptabilité",
  "/facture": "Factures",
  "/agenda": "Agenda",
  "/documents": "Documents",
  "/settings": "Réglages",
};

export function AppShell() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] ?? "Nova Solo";
  const accent = useUserStore((s) => s.profile?.accent_color);
  const isMobile = useIsMobile();

  // Recolore l'interface dès que la couleur d'accent du profil change.
  useEffect(() => {
    applyAccent(accent);
  }, [accent]);

  // Shell mobile : pas de sidebar, en-tête compact + barre d'onglets basse.
  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--color-bg-primary)" }}>
        <MobileHeader />
        <main style={{ flex: 1, overflowY: "auto", padding: "var(--space-4)", minHeight: 0 }}>
          <Outlet />
        </main>
        <MobileTabBar />
        <ChatOverlay />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--color-bg-primary)" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar title={title} />
        <main
          style={{
            flex: 1,
            padding: "var(--space-8)",
            overflowY: "auto",
          }}
        >
          <Outlet />
        </main>
        <footer style={{ padding: "var(--space-3) var(--space-8)", borderTop: "1px solid var(--color-border)", display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>© 2026 Patrick Beiner</span>
          <Link to="/legal" style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", textDecoration: "none", opacity: 0.7 }} onMouseEnter={e => (e.currentTarget.style.opacity = "1")} onMouseLeave={e => (e.currentTarget.style.opacity = "0.7")}>Mentions légales / Impressum / Note legali</Link>
          <Link to="/legal?tab=cgu" style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", textDecoration: "none", opacity: 0.7 }} onMouseEnter={e => (e.currentTarget.style.opacity = "1")} onMouseLeave={e => (e.currentTarget.style.opacity = "0.7")}>CGU</Link>
          <Link to="/legal?tab=privacy" style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", textDecoration: "none", opacity: 0.7 }} onMouseEnter={e => (e.currentTarget.style.opacity = "1")} onMouseLeave={e => (e.currentTarget.style.opacity = "0.7")}>Confidentialité</Link>
        </footer>
      </div>
      <ChatOverlay />
    </div>
  );
}
