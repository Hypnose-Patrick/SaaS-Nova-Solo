import { useRef } from "react";

interface DocumentPreviewProps {
  html: string | null;
  loading?: boolean;
  label: string;
  // Si fourni, l'aperçu se rend en modale plein écran (cf. Factures.tsx) ;
  // sinon il s'insère dans le flux de la page (cf. ExportGate).
  onClose?: () => void;
}

// Injecte une CSS anti-sélection dans le HTML du document — friction volontaire,
// pas une protection absolue (une capture d'écran suffit à la contourner, ce qui
// est un compromis assumé plutôt qu'une faille à corriger).
function noCopyHtml(html: string): string {
  const css = "<style>*{user-select:none!important;-webkit-user-select:none!important;-moz-user-select:none!important;-ms-user-select:none!important;}</style>";
  return html.includes("</head>") ? html.replace("</head>", `${css}</head>`) : css + html;
}

function blockClipboardEvents(doc: Document) {
  const block = (e: Event) => e.preventDefault();
  doc.addEventListener("contextmenu", block);
  doc.addEventListener("copy", block);
  doc.addEventListener("cut", block);
  doc.addEventListener("selectstart", block);
}

function Frame({ html, loading, label, tall }: { html: string | null; loading?: boolean; label: string; tall?: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  function handleLoad() {
    const doc = iframeRef.current?.contentDocument;
    if (doc) blockClipboardEvents(doc);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: "var(--space-2)",
          padding: "var(--space-2) var(--space-3)", background: "var(--color-bg-input)",
          border: "var(--border-subtle)", borderRadius: "var(--radius-sm)",
          fontSize: "var(--text-xs)", color: "var(--color-text-muted)",
        }}
      >
        <span>🔒</span>
        <span>Aperçu — {label}. Copie, clic droit et export désactivés pendant l'essai.</span>
      </div>
      <div style={{ border: "var(--border-subtle)", borderRadius: "var(--radius-sm)", overflow: "hidden", background: "#fff", height: tall ? "70vh" : 420 }}>
        {loading || !html ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#999", fontSize: "var(--text-sm)" }}>
            Chargement de l'aperçu…
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            onLoad={handleLoad}
            srcDoc={noCopyHtml(html)}
            sandbox="allow-same-origin"
            title="Aperçu du document"
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        )}
      </div>
    </div>
  );
}

export function DocumentPreview({ html, loading, label, onClose }: DocumentPreviewProps) {
  if (!onClose) return <Frame html={html} loading={loading} label={label} />;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-6)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--color-bg-elevated)", border: "var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "var(--space-4)", width: "100%", maxWidth: 680, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--color-text-muted)", cursor: "pointer", fontSize: "var(--text-sm)", padding: 0 }}
          >
            ✕ Fermer
          </button>
        </div>
        <Frame html={html} loading={loading} label={label} tall />
      </div>
    </div>
  );
}
