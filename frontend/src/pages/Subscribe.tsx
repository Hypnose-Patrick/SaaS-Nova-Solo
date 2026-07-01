import { useState } from "react";
import { useUserStore } from "@/stores/useUserStore";
import { supabase } from "@/lib/supabase";

export function Subscribe() {
  const profile = useUserStore((s) => s.profile);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setLoading(true);
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
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur serveur");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
      setLoading(false);
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
      <div style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>
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
            marginBottom: "var(--space-10)",
          }}
        >
          L'assistant des indépendants
        </p>

        <div
          style={{
            background: "var(--color-bg-surface)",
            border: "var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-10)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "rgba(197,165,114,0.12)",
              border: "1px solid rgba(197,165,114,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto var(--space-6)",
              fontSize: 22,
            }}
          >
            ✦
          </div>

          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-xl)",
              fontWeight: 400,
              color: "var(--color-text-primary)",
              margin: "0 0 var(--space-3)",
            }}
          >
            Activez votre accès
          </h2>

          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-secondary)",
              lineHeight: "var(--leading-relaxed)",
              margin: "0 0 var(--space-6)",
            }}
          >
            Bienvenue{profile?.name ? `, ${profile.name}` : ""}.
            Pour accéder à Nova Solo, activez votre abonnement.
            Accès immédiat après paiement.
          </p>

          <p
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-text-muted)",
              lineHeight: "var(--leading-relaxed)",
              margin: "0 0 var(--space-8)",
              padding: "var(--space-3)",
              background: "rgba(197,165,114,0.08)",
              borderRadius: "var(--radius-sm)",
              textAlign: "left",
            }}
          >
            <strong style={{ color: "var(--color-text-secondary)" }}>Édition Solo — BYOK.</strong>{" "}
            Tous les modules inclus. Vous apportez votre propre clé IA
            (OpenAI, OpenRouter, Anthropic…) : vous payez directement votre fournisseur,
            en plus de l'abonnement. Configuration dans Réglages → Moteur IA après l'abonnement.
            Facturation <strong>annuelle</strong> (CHF 108/an), affichée en équivalent mensuel ci-dessous.
          </p>

          {error && (
            <p style={{
              fontSize: "var(--text-xs)",
              color: "#e57373",
              marginBottom: "var(--space-4)",
              padding: "var(--space-3)",
              background: "rgba(229,115,115,0.08)",
              borderRadius: "var(--radius-sm)",
            }}>
              {error}
            </p>
          )}

          <button
            onClick={handleCheckout}
            disabled={loading}
            style={{
              display: "block",
              width: "100%",
              padding: "12px var(--space-4)",
              background: loading ? "rgba(197,165,114,0.5)" : "var(--color-gold)",
              color: "#1a1a17",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              letterSpacing: "0.08em",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              textAlign: "center",
              textTransform: "uppercase",
              boxSizing: "border-box",
              marginBottom: "var(--space-4)",
            } as React.CSSProperties}
          >
            {loading ? "Redirection…" : "S'abonner — CHF 9 / mois (facturé CHF 108 / an)"}
          </button>

          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: "0 0 var(--space-6)" }}>
            Facturation annuelle · non renouvelé au terme si résilié avant l'échéance · Paiement sécurisé Stripe · TVA CH incluse
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
        </div>

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
