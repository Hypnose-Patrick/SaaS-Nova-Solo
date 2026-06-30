import { useUserStore } from "@/stores/useUserStore";
import { supabase } from "@/lib/supabase";

const STRIPE_LINK = import.meta.env.VITE_STRIPE_PAYMENT_LINK ?? "#";

export function Subscribe() {
  const profile = useUserStore((s) => s.profile);

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
              margin: "0 0 var(--space-8)",
            }}
          >
            Bienvenue{profile?.name ? `, ${profile.name}` : ""}.
            Pour accéder à Nova Solo, activez votre abonnement.
            Accès immédiat après paiement.
          </p>

          <a
            href={STRIPE_LINK}
            style={{
              display: "block",
              width: "100%",
              padding: "12px var(--space-4)",
              background: "var(--color-gold)",
              color: "#1a1a17",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textDecoration: "none",
              textAlign: "center",
              textTransform: "uppercase",
              boxSizing: "border-box",
              marginBottom: "var(--space-4)",
            }}
          >
            S'abonner — CHF 29 / mois
          </a>

          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: "0 0 var(--space-6)" }}>
            Résiliable à tout moment · Paiement sécurisé Stripe · TVA CH incluse
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
