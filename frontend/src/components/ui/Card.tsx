import { type HTMLAttributes, type ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  action?: ReactNode;
  glass?: boolean;
}

export function Card({ title, action, glass, children, style, ...props }: CardProps) {
  return (
    <div
      style={{
        background: glass ? "var(--color-bg-glass)" : "var(--color-bg-surface)",
        backdropFilter: glass ? "blur(12px)" : undefined,
        border: glass ? "var(--border-gold)" : "var(--border-subtle)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-6)",
        boxShadow: "var(--shadow-md)",
        transition: "border-color var(--transition-base)",
        ...style,
      }}
      {...props}
    >
      {(title || action) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--space-4)",
          }}
        >
          {title && (
            <span
              style={{
                fontSize: "var(--text-xs)",
                fontWeight: 500,
                letterSpacing: "var(--tracking-wider)",
                textTransform: "uppercase",
                color: "var(--color-text-muted)",
              }}
            >
              {title}
            </span>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
