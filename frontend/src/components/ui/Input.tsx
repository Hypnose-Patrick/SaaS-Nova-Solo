import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, style, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize: "var(--text-xs)",
              fontWeight: 500,
              letterSpacing: "var(--tracking-wider)",
              textTransform: "uppercase",
              color: "var(--color-text-muted)",
            }}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          style={{
            background: "var(--color-bg-input)",
            border: error ? "1px solid var(--color-danger)" : "var(--border-subtle)",
            borderRadius: "var(--radius-sm)",
            color: "var(--color-text-primary)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-sm)",
            padding: "var(--space-3) var(--space-4)",
            outline: "none",
            width: "100%",
            boxSizing: "border-box",
            transition: "border-color var(--transition-fast)",
            ...style,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "rgba(197,165,114,0.4)";
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error
              ? "var(--color-danger)"
              : "rgba(255,255,255,0.06)";
            props.onBlur?.(e);
          }}
          {...props}
        />
        {(error || hint) && (
          <span
            style={{
              fontSize: "var(--text-xs)",
              color: error ? "var(--color-danger)" : "var(--color-text-muted)",
            }}
          >
            {error ?? hint}
          </span>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";
