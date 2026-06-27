import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useUserStore } from "@/stores/useUserStore";
import { supabase } from "@/lib/supabase";

const BUCKET = "nova-docs";

interface StorageFile {
  name: string;
  id: string | null;
  updated_at: string | null;
  metadata: Record<string, unknown> | null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

function fileExt(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function extBadgeColor(ext: string): string {
  if (ext === "pdf") return "var(--color-danger)";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "var(--color-success)";
  if (["doc", "docx"].includes(ext)) return "rgba(59,130,246,0.8)";
  if (["xls", "xlsx", "csv"].includes(ext)) return "var(--color-success)";
  return "var(--color-text-muted)";
}

export function Documents() {
  const profile = useUserStore((s) => s.profile);
  const [files, setFiles]       = useState<StorageFile[]>([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [signing, setSigning]   = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const folder = profile?.user_id ?? null;

  useEffect(() => {
    if (folder) loadFiles();
  }, [folder]);

  async function loadFiles() {
    if (!folder) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.storage.from(BUCKET).list(folder, {
      sortBy: { column: "updated_at", order: "desc" },
    });
    if (err) setError(err.message);
    setFiles((data ?? []).filter((f) => f.name !== ".emptyFolderPlaceholder") as StorageFile[]);
    setLoading(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !folder) return;
    setUploading(true);
    setError(null);
    const path = `${folder}/${file.name}`;
    const { error: err } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (err) setError(err.message);
    else await loadFiles();
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function downloadFile(name: string) {
    if (!folder) return;
    setSigning(name);
    const { data, error: err } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(`${folder}/${name}`, 3600);
    setSigning(null);
    if (err || !data?.signedUrl) { setError(err?.message ?? "Impossible de générer le lien."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function deleteFile(name: string) {
    if (!folder) return;
    const { error: err } = await supabase.storage.from(BUCKET).remove([`${folder}/${name}`]);
    if (err) { setError(err.message); return; }
    setFiles((f) => f.filter((file) => file.name !== name));
  }

  const totalSize = files.reduce((s, f) => s + ((f.metadata?.size as number) ?? 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 400, color: "var(--color-text-primary)", margin: 0 }}>
            Documents
          </h2>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", marginTop: "var(--space-1)" }}>
            Stockage privé chiffré (Supabase Storage). Vos fichiers, personne d'autre.
          </p>
        </div>

        <div>
          <input
            ref={inputRef}
            type="file"
            onChange={handleUpload}
            style={{ display: "none" }}
          />
          <Button
            size="sm"
            variant="gold"
            loading={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? "Envoi…" : "+ Téléverser"}
          </Button>
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div style={{ padding: "var(--space-3)", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-sm)", color: "var(--color-danger)" }}>
          {error}
        </div>
      )}

      {/* Stats */}
      {files.length > 0 && (
        <div style={{ display: "flex", gap: "var(--space-6)" }}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
            <span style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}>{files.length}</span> fichier{files.length !== 1 ? "s" : ""}
          </span>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
            <span style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}>{formatSize(totalSize)}</span> utilisés
          </span>
        </div>
      )}

      {/* Liste */}
      <Card glass>
        {loading ? (
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", padding: "var(--space-4)" }}>
            Chargement…
          </p>
        ) : files.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--space-4)", padding: "var(--space-12) var(--space-6)", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, border: "2px dashed rgba(197,165,114,0.25)", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 20, color: "rgba(197,165,114,0.4)" }}>↑</span>
            </div>
            <div>
              <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", margin: 0 }}>
                Aucun fichier. Cliquez sur <strong style={{ color: "var(--color-gold)" }}>+ Téléverser</strong> pour commencer.
              </p>
              <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)", marginTop: "var(--space-2)" }}>
                PDF, images, Word, Excel — tout format accepté.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {/* En-tête */}
            <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 80px 160px 120px", gap: "var(--space-3)", padding: "var(--space-2) var(--space-3)", borderBottom: "var(--border-subtle)" }}>
              {["", "Nom", "Taille", "Modifié", ""].map((h, i) => (
                <span key={i} style={{ fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
                  {h}
                </span>
              ))}
            </div>

            {files.map((file) => {
              const ext  = fileExt(file.name);
              const size = (file.metadata?.size as number) ?? 0;
              const date = file.updated_at
                ? new Date(file.updated_at).toLocaleDateString("fr-CH", { day: "2-digit", month: "short", year: "numeric" })
                : "—";

              return (
                <div
                  key={file.name}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px 1fr 80px 160px 120px",
                    gap: "var(--space-3)",
                    padding: "var(--space-3)",
                    borderBottom: "var(--border-subtle)",
                    alignItems: "center",
                  }}
                >
                  {/* Badge type */}
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <span style={{
                      display: "inline-block",
                      padding: "2px 5px",
                      borderRadius: "var(--radius-xs)",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      background: extBadgeColor(ext) + "20",
                      color: extBadgeColor(ext),
                      border: `1px solid ${extBadgeColor(ext)}40`,
                    }}>
                      {ext || "—"}
                    </span>
                  </div>

                  {/* Nom */}
                  <span style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontWeight: 500,
                  }}
                    title={file.name}
                  >
                    {file.name}
                  </span>

                  {/* Taille */}
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                    {size > 0 ? formatSize(size) : "—"}
                  </span>

                  {/* Date */}
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                    {date}
                  </span>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={signing === file.name}
                      onClick={() => downloadFile(file.name)}
                      style={{ fontSize: "var(--text-xs)", padding: "2px 8px" }}
                    >
                      Ouvrir
                    </Button>
                    <button
                      onClick={() => deleteFile(file.name)}
                      title="Supprimer"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", fontSize: 11, opacity: 0.4, padding: 2, lineHeight: 1 }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Note sécurité */}
      <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", paddingTop: "var(--space-2)" }}>
        Vos fichiers sont stockés dans un bucket privé — inaccessibles sans authentification. Les liens d'ouverture expirent après 1 heure.
      </p>
    </div>
  );
}
