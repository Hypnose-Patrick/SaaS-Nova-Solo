import { Button } from "@/components/ui/Button";

interface Props {
  content: string | null;
  loading: boolean;
  error: string | null;
  onUse?: (content: string) => void;
  useLabel?: string;
  emptyHint?: string;
}

/** Affichage standard d'une sortie IA (chargement / erreur / contenu). Style sombre/doré. */
export function AiResult({ content, loading, error, onUse, useLabel = "Utiliser", emptyHint }: Props) {
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", color: "var(--color-text-muted)", fontSize: "var(--text-sm)", padding: "var(--space-4) 0" }}>
        <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid var(--color-gold)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        Génération en cours…
      </div>
    );
  }
  if (error) {
    return (
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-danger)", margin: 0, lineHeight: "var(--leading-normal)" }}>
        {error}
      </p>
    );
  }
  if (!content) {
    return emptyHint ? (
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: 0 }}>{emptyHint}</p>
    ) : null;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: "var(--leading-normal)", whiteSpace: "pre-wrap", margin: 0 }}>
        {content}
      </p>
      {onUse && (
        <div>
          <Button size="sm" variant="ghost" onClick={() => onUse(content)}>{useLabel}</Button>
        </div>
      )}
    </div>
  );
}
