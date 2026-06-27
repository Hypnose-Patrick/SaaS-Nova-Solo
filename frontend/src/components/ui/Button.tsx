import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "gold" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
}

const SIZE = {
  sm: { padding: "var(--space-2) var(--space-4)", fontSize: "var(--text-xs)" },
  md: { padding: "var(--space-3) var(--space-6)", fontSize: "var(--text-xs)" },
  lg: { padding: "var(--space-4) var(--space-8)", fontSize: "var(--text-sm)" },
};

const VARIANT: Record<string, React.CSSProperties> = {
  gold: {
    background: "transparent",
    color: "var(--color-gold)",
    border: "1px solid var(--color-gold)",
    borderRadius: "var(--radius-xs)",
  },
  ghost: {
    background: "transparent",
    color: "var(--color-text-secondary)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "var(--radius-xs)",
  },
  danger: {
    background: "transparent",
    color: "var(--color-danger)",
    border: "1px solid var(--color-danger)",
    borderRadius: "var(--radius-xs)",
  },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "gold",
      size = "md",
      loading = false,
      icon,
      children,
      disabled,
      style,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-2)",
          fontFamily: "var(--font-body)",
          fontWeight: 500,
          letterSpacing: "var(--tracking-wider)",
          textTransform: "uppercase",
          cursor: disabled || loading ? "not-allowed" : "pointer",
          opacity: disabled || loading ? 0.4 : 1,
          transition: "all var(--transition-base)",
          ...VARIANT[variant],
          ...SIZE[size],
          ...style,
        }}
        {...props}
      >
        {loading ? <Spinner size={14} /> : icon}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: "spin 0.8s linear infinite" }}
    >
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="8" strokeLinecap="round" />
    </svg>
  );
}
