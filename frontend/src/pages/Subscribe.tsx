import { useState } from "react";
import { useUserStore } from "@/stores/useUserStore";
import { supabase } from "@/lib/supabase";

type Plan = "solo" | "pro";

export function Subscribe() {
  const profile = useUserStore((s) => s.profile);
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout(plan: Plan) {
    setLoadingPlan(plan);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expirée — reconnectez-vous.");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ plan }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur serveur");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
      setLoadingPlan(null);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-bg-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-6)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 800, textAlign: "center" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-3xl)",
            fontWeight: 400,
            color: "var(--color-gold)",
            letterSpacing: "var(--tracking-tight)",
            margin: "0 0 var(--space-2)",
          }}
        >
          Nova Solo
        </h1>
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-muted)",
            letterSpacing: "var(--tracking-wide)",
            textTransform: "uppercase",
            marginBottom: "var(--space-4)",
          }}
        >
          L'assistant des indépendants
        </p>

        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--color-text-secondary)",
            lineHeight: "var(--leading-relaxed)",
            margin: "0 0 var(--space-8)",
          }}
        >
          Bienvenue{profile?.name ? `, ${profile.name}` : ""}.
          Choisissez votre édition — accès immédiat après paiement.
        </p>

        {error && (
          <p style={{
            fontSize: "var(--text-xs)",
            color: "#e57373",
            marginBottom: "var(--space-4)",
            padding: "var(--space-3)",
            background: "rgba(229,115,115,0.08)",
            borderRadius: "var(--radius-sm)",
            maxWidth: 480,
            marginLeft: "auto",
            marginRight: "auto",
          }}>
            {error}
          </p>
        )}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-6)",
            justifyContent: "center",
            marginBottom: "var(--space-6)",
          }}
        >
          {/* Pro — IA managée */}
          <div
            style={{
              flex: "1 1 320px",
              maxWidth: 360,
              background: "var(--color-bg-surface)",
              border: "var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-8)",
              boxShadow: "var(--shadow-lg)",
              textAlign: "left",
            }}
          >
            <p style={{ fontSize: "var(--text-xs)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: "0 0 var(--space-2)" }}>
              Pro
            </p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", color: "var(--color-text-primary)", margin: "0 0 var(--space-2)" }}>
              CHF 29 <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>/ mois</span>
            </p>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", lineHeight: "var(--leading-relaxed)", margin: "0 0 var(--space-6)" }}>
              Accès complet, tous les modules. <strong style={{ color: "var(--color-text-primary)" }}>IA incluse</strong> — mode
              managé, rien à configurer.
            </p>
            <button
              onClick={() => handleCheckout("pro")}
              disabled={loadingPlan !== null}
              style={{
                display: "block",
                width: "100%",
                padding: "12px var(--space-4)",
                background: loadingPlan === "pro" ? "rgba(197,165,114,0.5)" : "var(--color-gold)",
                color: "#1a1a17",
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                letterSpacing: "0.08em",
                border: "none",
                cursor: loadingPlan !== null ? "not-allowed" : "pointer",
                textAlign: "center",
                textTransform: "uppercase",
                boxSizing: "border-box",
              } as React.CSSProperties}
            >
              {loadingPlan === "pro" ? "Redirection…" : "Commencer — Pro"}
            </button>
          </div>

          {/* Solo — BYOK */}
          <div
            style={{
              flex: "1 1 320px",
              maxWidth: 360,
              background: "var(--color-bg-surface)",
              border: "1px solid rgba(197,165,114,0.35)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-8)",
              boxShadow: "var(--shadow-lg)",
              textAlign: "left",
            }}
          >
            <p style={{ fontSize: "var(--text-xs)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-gold)", margin: "0 0 var(--space-2)" }}>
              Solo — BYOK
            </p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", color: "var(--color-text-primary)", margin: "0 0 var(--space-1)" }}>
              CHF 9 <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>/ mois</span>
            </p>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: "0 0 var(--space-2)" }}>
              Licence annuelle — CHF 108 payable en 1×
            </p>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", lineHeight: "var(--leading-relaxed)", margin: "0 0 var(--space-6)" }}>
              Tous les modules inclus. Vous apportez votre propre clé IA
              (OpenAI, OpenRouter, Anthropic…) : vous payez directement votre fournisseur,
              en plus de l'abonnement. Configuration dans Réglages → Moteur IA après l'abonnement.
            </p>
            <button
              onClick={() => handleCheckout("solo")}
              disabled={loadingPlan !== null}
              style={{
                display: "block",
                width: "100%",
                padding: "12px var(--space-4)",
                background: "transparent",
                color: "var(--color-gold)",
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                letterSpacing: "0.08em",
                border: "1px solid rgba(197,165,114,0.5)",
                cursor: loadingPlan !== null ? "not-allowed" : "pointer",
                textAlign: "center",
                textTransform: "uppercase",
                boxSizing: "border-box",
                opacity: loadingPlan !== null && loadingPlan !== "solo" ? 0.5 : 1,
              } as React.CSSProperties}
            >
              {loadingPlan === "solo" ? "Redirection…" : "Commencer — Solo (BYOK)"}
            </button>
          </div>
        </div>

        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: "0 0 var(--space-6)" }}>
          Facturation annuelle · résiliable avant l'échéance (non renouvelé) · Paiement sécurisé Stripe · TVA CH incluse
        </p>

        <button
          onClick={handleSignOut}
          style={{
            background: "none",
            border: "none",
            color: "var(--color-text-muted)",
            fontSize: "var(--text-xs)",
            cursor: "pointer",
            textDecoration: "underline",
            opacity: 0.6,
          }}
        >
          Se déconnecter
        </button>

        <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-4)", marginTop: "var(--space-6)" }}>
          {[
            { label: "Mentions légales", hash: "" },
            { label: "CGU", hash: "?tab=cgu" },
            { label: "Confidentialité", hash: "?tab=privacy" },
          ].map(({ label, hash }) => (
            <a
              key={label}
              href={`/legal${hash}`}
              style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textDecoration: "none", opacity: 0.5 }}
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
