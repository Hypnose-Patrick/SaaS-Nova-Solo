interface Props {
  title: string;
  subtitle?: string;
}

export function PageHeader({ title, subtitle }: Props) {
  return (
    <div>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 400, color: "var(--color-text-primary)", margin: 0 }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", marginTop: "var(--space-1)" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
