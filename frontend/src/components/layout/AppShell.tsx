import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ChatOverlay } from "@/pages/ChatOverlay";
import { useUserStore } from "@/stores/useUserStore";
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

  // Recolore l'interface dès que la couleur d'accent du profil change.
  useEffect(() => {
    applyAccent(accent);
  }, [accent]);

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
      </div>
      <ChatOverlay />
    </div>
  );
}
