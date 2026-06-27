import type { Config } from "tailwindcss";

// On réutilise les CSS variables de tokens.css — Tailwind sert uniquement
// pour les utilitaires de layout, spacing et flex. Les couleurs de marque
// viennent de :root (tokens.css), pas de Tailwind.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "bg-primary": "var(--color-bg-primary)",
        "bg-surface": "var(--color-bg-surface)",
        "bg-elevated": "var(--color-bg-elevated)",
        "bg-glass": "var(--color-bg-glass)",
        gold: "var(--color-gold)",
        "gold-light": "var(--color-gold-light)",
        "gold-muted": "var(--color-gold-muted)",
        "text-primary": "var(--color-text-primary)",
        "text-secondary": "var(--color-text-secondary)",
        "text-muted": "var(--color-text-muted)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
      },
      fontFamily: {
        display: "var(--font-display)",
        body: "var(--font-body)",
        mono: "var(--font-mono)",
      },
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },
    },
  },
  plugins: [],
} satisfies Config;
