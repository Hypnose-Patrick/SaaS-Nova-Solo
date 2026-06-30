import { useState } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// Le client Nova cible le schéma « nova » ; le composant Auth est typé pour
// « public » mais n'utilise que l'auth (pas la BDD). Cast sûr.
const authClient = supabase as unknown as SupabaseClient;

const APP_URL =
  import.meta.env.VITE_APP_URL ??
  (window.location.hostname === "localhost" ? "http://localhost:5174" : "");

if (!import.meta.env.VITE_APP_URL && window.location.hostname !== "localhost") {
  console.error("[Nova] VITE_APP_URL est obligatoire en production — OAuth redirect manquant");
}

async function signInWithGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
}

export function Login() {
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogle() {
    setGoogleLoading(true);
    await signInWithGoogle();
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
          {/* Bouton Google custom — redirectTo explicite */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--space-3)",
              padding: "10px var(--space-4)",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: "var(--radius-sm)",
              color: "var(--color-text-primary)",
              fontSize: "var(--text-sm)",
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              letterSpacing: "0.08em",
              cursor: googleLoading ? "not-allowed" : "pointer",
              opacity: googleLoading ? 0.6 : 1,
              transition: "background var(--transition-fast)",
              marginBottom: "var(--space-5)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            {googleLoading ? "Redirection…" : "Continuer avec Google"}
          </button>

          {/* Séparateur */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", letterSpacing: "0.1em" }}>OU</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
          </div>

          <Auth
            supabaseClient={authClient}
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
            providers={[]}
            redirectTo={window.location.origin}
            localization={{
              variables: {
                sign_in: {
                  email_label: "Adresse e-mail",
                  password_label: "Mot de passe",
                  button_label: "Se connecter",
                  link_text: "Vous avez déjà un compte ? Se connecter",
                },
                sign_up: {
                  email_label: "Adresse e-mail",
                  password_label: "Mot de passe",
                  button_label: "Créer un compte",
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

        <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
          {[
            { label: "Mentions légales", hash: "" },
            { label: "CGU", hash: "?tab=cgu" },
            { label: "Confidentialité", hash: "?tab=privacy" },
          ].map(({ label, hash }) => (
            <a
              key={label}
              href={`/legal${hash}`}
              style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textDecoration: "none", opacity: 0.6 }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "0.6")}
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
