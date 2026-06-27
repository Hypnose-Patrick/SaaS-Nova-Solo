import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useUserStore } from "@/stores/useUserStore";
import { AppShell } from "@/components/layout/AppShell";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { Bmc } from "@/pages/Bmc";
import { Pipeline } from "@/pages/Pipeline";

// Pages stub — seront remplacées par leurs implémentations complètes.
function PageStub({ name }: { name: string }) {
  return (
    <div style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-body)", padding: "var(--space-4)" }}>
      <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", color: "var(--color-gold)" }}>
        {name}
      </span>
      <p style={{ marginTop: "var(--space-4)", fontSize: "var(--text-sm)" }}>
        Cette page est en cours de développement.
      </p>
    </div>
  );
}

// Pattern layout route react-router-dom v6 : AppShell utilise <Outlet /> internement.
function ProtectedRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="diagnostic" element={<PageStub name="Diagnostic" />} />
        <Route path="bmc" element={<Bmc />} />
        <Route path="business-plan" element={<PageStub name="Business Plan" />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="finances" element={<PageStub name="Finances" />} />
        <Route path="compta" element={<PageStub name="Comptabilité" />} />
        <Route path="facture" element={<PageStub name="Factures" />} />
        <Route path="agenda" element={<PageStub name="Agenda" />} />
        <Route path="documents" element={<PageStub name="Documents" />} />
        <Route path="settings" element={<PageStub name="Réglages" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | "loading">("loading");
  const { fetchProfile, reset } = useUserStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      if (data.session?.user.id) fetchProfile(data.session.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
      if (s?.user.id) {
        fetchProfile(s.user.id);
      } else {
        reset();
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === "loading") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--color-bg-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-xl)",
            color: "var(--color-gold)",
            opacity: 0.6,
          }}
        >
          Nova Solo
        </span>
      </div>
    );
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route
          path="/login"
          element={session ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/*"
          element={session ? <ProtectedRoutes /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
