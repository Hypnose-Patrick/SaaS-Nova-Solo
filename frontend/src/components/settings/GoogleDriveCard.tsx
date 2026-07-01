import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  isGoogleDriveConnected,
  backupToGoogleDrive,
  restoreFromGoogleDrive,
} from "@/lib/googleDrive";

const SECTION_TITLE: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--text-base)",
  fontWeight: 400,
  color: "var(--color-gold)",
  margin: 0,
};

export function GoogleDriveCard() {
  const [connected, setConnected] = useState(isGoogleDriveConnected());
  const [connecting, setConnecting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function connect() {
    setConnecting(true);
    setMsg(null);
    try {
      await connectGoogleDrive();
      setConnected(true);
      setMsg({ kind: "ok", text: "Google Drive connecté." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Échec de connexion." });
    }
    setConnecting(false);
  }

  function disconnect() {
    disconnectGoogleDrive();
    setConnected(false);
    setConfirmRestore(false);
    setMsg(null);
  }

  async function backup() {
    setBackingUp(true);
    setMsg(null);
    try {
      await backupToGoogleDrive();
      setMsg({ kind: "ok", text: "Sauvegarde enregistrée dans votre Google Drive (fichier « Nova_Solo_DB »)." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Échec de la sauvegarde." });
    }
    setBackingUp(false);
  }

  async function restore() {
    if (!confirmRestore) {
      setConfirmRestore(true);
      return;
    }
    setConfirmRestore(false);
    setRestoring(true);
    setMsg(null);
    try {
      const result = await restoreFromGoogleDrive();
      setMsg({
        kind: "ok",
        text: `Restauré (sauvegarde du ${new Date(result.savedAt).toLocaleString("fr-CH")}, ${result.blocksRestored} blocs BMC).`,
      });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Échec de la restauration." });
    }
    setRestoring(false);
  }

  return (
    <Card glass>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
        <p style={SECTION_TITLE}>Sauvegarde Google Drive personnelle</p>
        <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, letterSpacing: "var(--tracking-wide)", color: connected ? "var(--color-success)" : "var(--color-text-muted)", border: `1px solid ${connected ? "var(--color-success)" : "var(--border-subtle)"}`, borderRadius: "var(--radius-xs)", padding: "1px 8px" }}>
          {connected ? "Connecté" : "Non connecté"}
        </span>
      </div>
      <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: "0 0 var(--space-4) 0", lineHeight: "var(--leading-normal)" }}>
        Sauvegardez votre profil et vos blocs BMC/Business Plan dans <strong>votre propre Google
        Drive</strong> (fichier « Nova_Solo_DB »). Entièrement dans votre navigateur — aucun
        jeton Google ne transite par nos serveurs. Optionnel : Nova Solo continue de fonctionner
        normalement sans cette sauvegarde.
      </p>

      {msg && (
        <p style={{ fontSize: "var(--text-sm)", margin: "0 0 var(--space-4) 0", color: msg.kind === "ok" ? "var(--color-success)" : "var(--color-danger)" }}>
          {msg.text}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
        {!connected ? (
          <Button variant="gold" loading={connecting} onClick={connect}>
            Connecter mon Google Drive
          </Button>
        ) : (
          <>
            <Button variant="gold" loading={backingUp} onClick={backup}>
              Sauvegarder maintenant
            </Button>
            <Button variant={confirmRestore ? "danger" : "ghost"} loading={restoring} onClick={restore}>
              {confirmRestore ? "Confirmer — écrase les données actuelles" : "Restaurer"}
            </Button>
            <Button variant="ghost" onClick={disconnect}>
              Déconnecter
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
