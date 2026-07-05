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

export function useSubscription() {
  const { account } = useUserStore();
  const isActive = hasAccess(account);
  return { isActive };
}
