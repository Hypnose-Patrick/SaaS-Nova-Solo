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
import { Finances } from "@/pages/Finances";
import { Factures } from "@/pages/Factures";
import { Compta } from "@/pages/Compta";
import { Settings } from "@/pages/Settings";
import { Agenda } from "@/pages/Agenda";
import { Documents } from "@/pages/Documents";
import { Diagnostic } from "@/pages/Diagnostic";
import { BusinessPlan } from "@/pages/BusinessPlan";
import { Symbolique } from "@/pages/Symbolique";
import { Oracle } from "@/pages/Oracle";
import { Pricing } from "@/pages/Pricing";
import { Cv } from "@/pages/Cv";
import { Dossier } from "@/pages/Dossier";
import { MirrorFisch } from "@/pages/MirrorFisch";
import { Contrat } from "@/pages/Contrat";
import { Marketing } from "@/pages/Marketing";
import { Hermes } from "@/pages/Hermes";
import { Simulation } from "@/pages/Simulation";
import { GobanCoach } from "@/pages/GobanCoach";
import { Legal } from "@/pages/Legal";
import { Subscribe } from "@/pages/Subscribe";
import { hasAccess } from "@/lib/useSubscription";

// Pattern layout route react-router-dom v6 : AppShell utilise <Outlet /> internement.
function ProtectedRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="diagnostic" element={<Diagnostic />} />
        <Route path="bmc" element={<Bmc />} />
        <Route path="business-plan" element={<BusinessPlan />} />
        <Route path="symbolique" element={<Symbolique />} />
        <Route path="oracle" element={<Oracle />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="cv" element={<Cv />} />
        <Route path="dossier" element={<Dossier />} />
        <Route path="contrat" element={<Contrat />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="marketing" element={<Marketing />} />
        <Route path="mirrorfisch" element={<MirrorFisch />} />
        <Route path="hermes" element={<Hermes />} />
        <Route path="simulation" element={<Simulation />} />
        <Route path="goban-coach" element={<GobanCoach />} />
        <Route path="finances" element={<Finances />} />
        <Route path="compta" element={<Compta />} />
        <Route path="facture" element={<Factures />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="documents" element={<Documents />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | "loading">("loading");
  const { fetchProfile, reset, profile } = useUserStore();

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
  }, [fetchProfile, reset]);

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
        <Route path="/legal" element={<Legal />} />
        <Route
          path="/login"
          element={session ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/subscribe"
          element={
            !session
              ? <Navigate to="/login" replace />
              : hasAccess(profile)
                ? <Navigate to="/" replace />
                : <Subscribe />
          }
        />
        <Route
          path="/*"
          element={
            !session
              ? <Navigate to="/login" replace />
              : (profile && !hasAccess(profile))
                ? <Navigate to="/subscribe" replace />
                : <ProtectedRoutes />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
