import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabase";

export function Login() {
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
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* En-tête marque */}
        <div style={{ textAlign: "center", marginBottom: "var(--space-10)" }}>
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
              margin: 0,
            }}
          >
            L'assistant des indépendants
          </p>
        </div>

        {/* Auth UI Supabase */}
        <div
          style={{
            background: "var(--color-bg-surface)",
            border: "var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-8)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: "#c5a572",
                    brandAccent: "#d4b88a",
                    inputBackground: "rgba(255,255,255,0.04)",
                    inputText: "#f5f5f0",
                    inputPlaceholder: "#6b6b66",
                    inputBorder: "rgba(255,255,255,0.06)",
                    inputBorderFocus: "rgba(197,165,114,0.4)",
                    messageText: "#a8a89e",
                    anchorTextColor: "#c5a572",
                    dividerBackground: "rgba(255,255,255,0.06)",
                  },
                  radii: { borderRadiusButton: "2px", inputBorderRadius: "4px" },
                  fonts: { bodyFontFamily: "Inter, system-ui, sans-serif" },
                  fontSizes: { baseBodySize: "13px", baseLabelSize: "11px" },
                },
              },
              style: {
                container: { background: "transparent" },
                button: {
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  fontWeight: "500",
                },
                label: { letterSpacing: "0.1em", textTransform: "uppercase" },
              },
            }}
            providers={["google"]}
            redirectTo={window.location.origin}
            localization={{
              variables: {
                sign_in: {
                  email_label: "Adresse e-mail",
                  password_label: "Mot de passe",
                  button_label: "Se connecter",
                  social_provider_text: "Continuer avec {{provider}}",
                  link_text: "Vous avez déjà un compte ? Se connecter",
                },
                sign_up: {
                  email_label: "Adresse e-mail",
                  password_label: "Mot de passe",
                  button_label: "Créer un compte",
                  social_provider_text: "Continuer avec {{provider}}",
                  link_text: "Pas encore de compte ? S'inscrire",
                },
              },
            }}
          />
        </div>

        <p
          style={{
            textAlign: "center",
            fontSize: "var(--text-xs)",
            color: "var(--color-text-muted)",
            marginTop: "var(--space-6)",
          }}
        >
          Vos données restent privées — stockage Suisse, conforme nLPD.
        </p>
      </div>
    </div>
  );
}
