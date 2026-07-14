import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSubscription, exportLockInfo } from "@/lib/useSubscription";
import { DocumentPreview } from "@/components/DocumentPreview";

interface Props {
  children: React.ReactNode;
  // Chargeur paresseux du HTML du document — appelé uniquement pendant l'essai
  // (isActive && !canExport), pour afficher un aperçu à la place du verrou.
  previewHtml?: () => string | Promise<string>;
}

export function ExportGate({ children, previewHtml }: Props) {
  const { canExport, isActive, account } = useSubscription();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const showPreview = isActive && !canExport && !!previewHtml;

  useEffect(() => {
    if (!showPreview) return;
    let cancelled = false;
    setLoadingPreview(true);
    Promise.resolve(previewHtml!())
      .then((html) => { if (!cancelled) setPreview(html); })
      .finally(() => { if (!cancelled) setLoadingPreview(false); });
    return () => { cancelled = true; };
    // previewHtml est recréé à chaque rendu (closure) — on ne veut charger
    // l'aperçu qu'à l'entrée/sortie de l'état "essai en cours", pas à chaque frappe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPreview]);

  if (canExport) return <>{children}</>;

  const { label } = exportLockInfo(account);

  if (showPreview) {
    return <DocumentPreview html={preview} loading={loadingPreview} label={label} />;
  }

  // Pendant l'essai mais sans previewHtml fourni (page pas encore câblée),
  // ou aucun abonnement actif : verrou générique, inchangé.
  const showSubscribeCta = !isActive;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-2)",
          padding: "var(--space-2) var(--space-4)",
          background: "var(--color-bg-input)",
          border: "var(--border-subtle)",
          borderRadius: "var(--radius-sm)",
          fontSize: "var(--text-sm)",
          color: "var(--color-text-muted)",
          cursor: "not-allowed",
          opacity: 0.5,
        }}
      >
        <span style={{ fontSize: 14 }}>🔒</span>
        {label}
      </div>
      {showSubscribeCta && (
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
      )}
    </div>
  );
}
