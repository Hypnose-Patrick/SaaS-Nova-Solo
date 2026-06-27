type BadgeColor = "gold" | "success" | "warning" | "danger" | "muted";

interface BadgeProps {
  children: React.ReactNode;
  color?: BadgeColor;
}

const COLORS: Record<BadgeColor, React.CSSProperties> = {
  gold: { color: "var(--color-gold)", background: "rgba(197,165,114,0.12)", border: "1px solid rgba(197,165,114,0.25)" },
  success: { color: "var(--color-success)", background: "rgba(90,138,90,0.12)", border: "1px solid rgba(90,138,90,0.25)" },
  warning: { color: "var(--color-warning)", background: "rgba(184,146,58,0.12)", border: "1px solid rgba(184,146,58,0.25)" },
  danger: { color: "var(--color-danger)", background: "rgba(168,90,90,0.12)", border: "1px solid rgba(168,90,90,0.25)" },
  muted: { color: "var(--color-text-muted)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" },
};

export function Badge({ children, color = "muted" }: BadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: "var(--radius-xs)",
        fontSize: "var(--text-xs)",
        fontWeight: 500,
        letterSpacing: "var(--tracking-wide)",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        ...COLORS[color],
      }}
    >
      {children}
    </span>
  );
}
