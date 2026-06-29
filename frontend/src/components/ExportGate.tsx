import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/lib/useSubscription";

interface Props {
  children: React.ReactNode;
}

export function ExportGate({ children }: Props) {
  const { isActive } = useSubscription();
  const navigate = useNavigate();

  if (isActive) return <>{children}</>;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-2)",
          padding: "var(--space-2) var(--space-4)",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "var(--radius-sm)",
          fontSize: "var(--text-sm)",
          color: "var(--color-text-muted)",
          cursor: "not-allowed",
          opacity: 0.5,
        }}
      >
        <span style={{ fontSize: 14 }}>🔒</span>
        Export réservé aux abonnés
      </div>
      <button
        onClick={() => navigate("/settings")}
        style={{
          background: "none",
          border: "none",
          color: "var(--color-gold)",
          fontSize: "var(--text-sm)",
          cursor: "pointer",
          textDecoration: "underline",
          padding: 0,
          fontFamily: "var(--font-body)",
        }}
      >
        S'abonner — 29 CHF/mois →
      </button>
    </div>
  );
}
