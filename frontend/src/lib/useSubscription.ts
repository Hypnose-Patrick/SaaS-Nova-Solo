import { useUserStore } from "@/stores/useUserStore";
import type { Account } from "@/types";

// Source unique de vérité côté frontend pour le paywall visuel. Ce n'est QUE
// du confort d'affichage : la vraie barrière est le garde-fou serveur
// (assertActiveEntitlement dans supabase/functions/_shared/entitlement.ts).
// Depuis la migration 013, l'abonnement vit sur Account (plus sur Profile/projet).
export function hasAccess(account: Pick<Account, "subscription_status" | "subscription_end" | "is_admin"> | null | undefined): boolean {
  if (!account) return false;
  if (account.is_admin) return true;
  const statusOk = account.subscription_status === "active" || account.subscription_status === "trialing";
  const end = account.subscription_end ? new Date(account.subscription_end).getTime() : 0;
  return statusOk && end > Date.now();
}

// Accès à l'app (hasAccess) et droit d'exporter/imprimer un document sont deux
// choses différentes : pendant l'essai gratuit de 14 jours ("trialing"),
// l'utilisateur a accès à tout l'app mais ne peut pas encore exporter — ce
// n'est débloqué qu'une fois le premier prélèvement effectué ("active").
export function canExport(account: Pick<Account, "subscription_status" | "subscription_end" | "is_admin"> | null | undefined): boolean {
  if (!account) return false;
  if (account.is_admin) return true;
  const end = account.subscription_end ? new Date(account.subscription_end).getTime() : 0;
  return account.subscription_status === "active" && end > Date.now();
}

export interface ExportLockInfo {
  locked: boolean;
  label: string;
}

// Texte centralisé pour tous les points de blocage d'export — garantit le
// même message partout (ExportGate, Factures, Compta, Marketing).
export function exportLockInfo(account: Pick<Account, "subscription_status" | "subscription_end" | "is_admin"> | null | undefined): ExportLockInfo {
  if (canExport(account)) return { locked: false, label: "" };
  if (account?.subscription_status === "trialing" && account.subscription_end) {
    const daysLeft = Math.max(1, Math.ceil((new Date(account.subscription_end).getTime() - Date.now()) / 86_400_000));
    return { locked: true, label: `Débloqué dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""} (fin de l'essai)` };
  }
  return { locked: true, label: "Export réservé aux abonnés" };
}

export function useSubscription() {
  const { account } = useUserStore();
  const isActive = hasAccess(account);
  return { isActive, canExport: canExport(account), account };
}
