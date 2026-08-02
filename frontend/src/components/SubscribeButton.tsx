import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface Props {
  subscriptionStatus?: string | null;
  plan?: string | null;
}

// Libellés commerciaux : Solo = 29 / mois · Trio = 39 / mois · BYOK = 108 / an.
// Les clés `pro`, `trio`, `solo` restent TECHNIQUES (base, secrets Stripe) : `pro`
// porte le palier Solo, `solo` porte le BYOK.
const PLAN_LABELS: Record<string, string> = {
  solo: "BYOK — 9 CHF / mois",
  pro: "Solo — 29 CHF / mois",
  trio: "Trio — 39 CHF / mois",
};

export function SubscribeButton({ subscriptionStatus, plan }: Props) {
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = subscriptionStatus === "active";
  const planLabel = (plan && PLAN_LABELS[plan]) || "abonnement actif";

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non authentifié");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          // Ce bouton vend l'offre Pro (29 CHF/mois, cf. libellé ci-dessous) —
          // sans ce plan, le backend défaut sur "solo" (stripe-checkout/index.ts).
          body: JSON.stringify({ plan: "pro" }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur checkout");
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setLoading(false);
    }
  }

  // Ouvre le Portail Client Stripe — upgrade/downgrade entre paliers, moyen
  // de paiement, résiliation : toute la logique de proration est gérée par
  // Stripe, pas par Nova Solo (cf. supabase/functions/stripe-portal).
  async function handleManage() {
    setPortalLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non authentifié");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-portal`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur portail");
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setPortalLoading(false);
    }
  }

  if (isActive) {
    return (
      <div>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          padding: "var(--space-3) var(--space-4)",
          background: "rgba(197,165,114,0.08)",
          border: "1px solid rgba(197,165,114,0.25)",
          borderRadius: "var(--radius-sm)",
          fontSize: "var(--text-sm)",
          color: "var(--color-gold)",
          marginBottom: "var(--space-3)",
        }}>
          <span style={{ fontSize: 16 }}>✓</span>
          Abonnement actif — {planLabel}
        </div>
        <button
          onClick={handleManage}
          disabled={portalLoading}
          style={{
            padding: "var(--space-3) var(--space-6)",
            background: "transparent",
            color: "var(--color-gold)",
            border: "1px solid rgba(197,165,114,0.5)",
            borderRadius: "var(--radius-sm)",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            letterSpacing: "0.08em",
            cursor: portalLoading ? "not-allowed" : "pointer",
            opacity: portalLoading ? 0.7 : 1,
            transition: "opacity var(--transition-fast)",
          }}
        >
          {portalLoading ? "Redirection…" : "Gérer mon abonnement — changer de palier, résilier"}
        </button>
        {error && (
          <p style={{ marginTop: "var(--space-2)", fontSize: "var(--text-xs)", color: "var(--color-error, #ef4444)" }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleSubscribe}
        disabled={loading}
        style={{
          padding: "var(--space-3) var(--space-6)",
          background: "var(--color-gold)",
          color: "#1a1008",
          border: "none",
          borderRadius: "var(--radius-sm)",
          fontSize: "var(--text-sm)",
          fontWeight: 600,
          letterSpacing: "0.08em",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
          transition: "opacity var(--transition-fast)",
        }}
      >
        {loading ? "Redirection…" : "S'abonner — 29 CHF / mois"}
      </button>
      {error && (
        <p style={{ marginTop: "var(--space-2)", fontSize: "var(--text-xs)", color: "var(--color-error, #ef4444)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
