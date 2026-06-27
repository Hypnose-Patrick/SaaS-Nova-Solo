interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "flat";
  trendValue?: string;
  color?: "gold" | "success" | "warning" | "danger" | "default";
}

const TREND_ICON = { up: "↑", down: "↓", flat: "→" };
const TREND_COLOR = {
  up: "var(--color-success)",
  down: "var(--color-danger)",
  flat: "var(--color-text-muted)",
};
const VALUE_COLOR: Record<string, string> = {
  gold: "var(--color-gold)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  default: "var(--color-text-primary)",
};

export function KpiCard({ label, value, unit, trend, trendValue, color = "default" }: KpiCardProps) {
  return (
    <div
      style={{
        background: "var(--color-bg-surface)",
        border: "var(--border-subtle)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-5) var(--space-6)",
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
      }}
    >
      <span
        style={{
          fontSize: "var(--text-xs)",
          fontWeight: 500,
          letterSpacing: "var(--tracking-wider)",
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-1)" }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-2xl)",
            fontWeight: 400,
            color: VALUE_COLOR[color],
            lineHeight: 1,
          }}
        >
          {typeof value === "number" ? value.toLocaleString("fr-CH") : value}
        </span>
        {unit && (
          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
            {unit}
          </span>
        )}
      </div>
      {trend && trendValue && (
        <span style={{ fontSize: "var(--text-xs)", color: TREND_COLOR[trend] }}>
          {TREND_ICON[trend]} {trendValue}
        </span>
      )}
    </div>
  );
}
