import { useUserStore } from "@/stores/useUserStore";
import type { Profile } from "@/types";

// Source unique de vérité côté frontend pour le paywall visuel. Ce n'est QUE
// du confort d'affichage : la vraie barrière est le garde-fou serveur
// (assertActiveEntitlement dans supabase/functions/_shared/entitlement.ts).
export function hasAccess(profile: Pick<Profile, "subscription_status" | "subscription_end" | "is_admin"> | null | undefined): boolean {
  if (!profile) return false;
  if (profile.is_admin) return true;
  const statusOk = profile.subscription_status === "active" || profile.subscription_status === "trialing";
  const end = profile.subscription_end ? new Date(profile.subscription_end).getTime() : 0;
  return statusOk && end > Date.now();
}

export function useSubscription() {
  const { profile } = useUserStore();
  const isActive = hasAccess(profile);
  return { isActive };
}
