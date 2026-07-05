import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useUserStore } from "@/stores/useUserStore";

const SECTION_TITLE: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--text-base)",
  fontWeight: 400,
  color: "var(--color-danger)",
  margin: "0 0 var(--space-2) 0",
};

// Réinitialisation et suppression — deux actions distinctes et irréversibles
// à des degrés différents : le reset vide UN projet (le compte reste actif),
// la suppression programme la purge du COMPTE entier à +30 jours (délai de
// grâce — cf. CGU §8, migration 014/015).
export function DangerZoneCard() {
  const account = useUserStore((s) => s.account);
  const profile = useUserStore((s) => s.profile);
  const resetProject = useUserStore((s) => s.resetProject);
  const deleteAccount = useUserStore((s) => s.deleteAccount);

  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // BYOK ("solo" en interne) exclu du reset — palier sans IA managée.
  const canReset = account?.plan === "pro" || account?.plan === "trio";

  async function handleReset() {
    if (!profile) return;
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setResetting(true);
    setResetMsg(null);
    const { error } = await resetProject(profile.id);
    setResetting(false);
    setConfirmReset(false);
    setResetMsg(
      error
        ? { kind: "err", text: error }
        : { kind: "ok", text: `« ${profile.project_name || "Mon activité"} » a été réinitialisé.` },
    );
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setDeleteMsg(null);
    const { purgeAt, error } = await deleteAccount();
    setDeleting(false);
    if (error) {
      setConfirmDelete(false);
      setDeleteMsg({ kind: "err", text: error });
      return;
    }
    const date = purgeAt ? new Date(purgeAt).toLocaleDateString("fr-CH") : "dans 30 jours";
    setDeleteMsg({
      kind: "ok",
      text: `Abonnement résilié, suppression définitive programmée pour le ${date}. Reconnectez-vous et réabonnez-vous avant cette date pour annuler et récupérer vos données. Vous pouvez continuer à consulter vos données jusqu'à votre déconnexion (bouton « Quitter »).`,
    });
  }

  return (
    <Card glass style={{ border: "1px solid rgba(168,90,90,0.25)" }}>
      <p style={SECTION_TITLE}>Zone de danger</p>

      {/* Reset d'un projet — palier Pro/Trio uniquement */}
      <div style={{ paddingBottom: "var(--space-4)", marginBottom: "var(--space-4)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)", fontWeight: 500, margin: "0 0 var(--space-1) 0" }}>
          Réinitialiser ce projet
        </p>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: "0 0 var(--space-3) 0", lineHeight: "var(--leading-normal)" }}>
          Efface toutes les données de « {profile?.project_name || "ce projet"} » (BMC, business plan,
          prospection, finances, documents…) pour repartir de zéro. Le compte et les autres projets
          ne sont pas affectés.
          {!canReset && " Non inclus dans le palier BYOK — passez à Pro ou Trio pour y accéder."}
        </p>
        {resetMsg && (
          <p style={{ fontSize: "var(--text-sm)", margin: "0 0 var(--space-3) 0", color: resetMsg.kind === "ok" ? "var(--color-success)" : "var(--color-danger)" }}>
            {resetMsg.text}
          </p>
        )}
        <Button
          variant={confirmReset ? "danger" : "ghost"}
          loading={resetting}
          disabled={!canReset}
          onClick={handleReset}
        >
          {confirmReset ? "Confirmer — efface définitivement ce projet" : "Réinitialiser ce projet"}
        </Button>
      </div>

      {/* Suppression du compte — délai de grâce 30 jours */}
      <div>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)", fontWeight: 500, margin: "0 0 var(--space-1) 0" }}>
          Supprimer mon compte
        </p>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: "0 0 var(--space-3) 0", lineHeight: "var(--leading-normal)" }}>
          Résilie l'abonnement et programme la suppression de toutes vos données (tous vos projets)
          dans 30 jours. Vous pouvez annuler en vous reconnectant et en vous réabonnant avant cette
          échéance — passé ce délai, l'effacement est définitif et irréversible.{" "}
          <strong style={{ color: "var(--color-text-secondary)" }}>
            Vos factures et écritures comptables seront aussi définitivement effacées : si vous devez
            les conserver pour votre propre comptabilité, exportez-les avant la fin du délai de grâce.
          </strong>
        </p>
        {deleteMsg && (
          <p style={{ fontSize: "var(--text-sm)", margin: "0 0 var(--space-3) 0", color: deleteMsg.kind === "ok" ? "var(--color-success)" : "var(--color-danger)" }}>
            {deleteMsg.text}
          </p>
        )}
        <Button variant={confirmDelete ? "danger" : "ghost"} loading={deleting} onClick={handleDelete}>
          {confirmDelete ? "Confirmer — supprimer mon compte" : "Supprimer mon compte"}
        </Button>
      </div>
    </Card>
  );
}
