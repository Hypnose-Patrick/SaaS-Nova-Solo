import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface Props {
  subscriptionStatus?: string | null;
}

export function SubscribeButton({ subscriptionStatus }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = subscriptionStatus === "active";

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

  if (isActive) {
    return (
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
      }}>
        <span style={{ fontSize: 16 }}>✓</span>
        Abonnement actif — 29 CHF / mois
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
