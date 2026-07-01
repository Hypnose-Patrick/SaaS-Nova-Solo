// Garde-fou serveur : décide si un abonné a le droit d'utiliser les
// fonctionnalités payantes. L'accès est ACTIF tant que l'abonnement est actif
// ET que la date d'expiration (subscription_end) est dans le futur.
//
// À appeler dans TOUTE Edge Function payante, juste après requireUser() :
//     const user = await requireUser(req);
//     await assertActiveEntitlement(user.id);   // lève EntitlementError -> 402
//
// Pourquoi côté serveur : le frontend est du JavaScript public. Le paywall
// visuel (redirection vers /subscribe) est du confort, pas une barrière. La
// vraie barrière est ici, hors de portée du navigateur.

import { adminClient } from "./admin.ts";

export interface Entitlement {
  active: boolean;
  reason: "admin" | "active" | "expired" | "inactive" | "unknown";
  subscriptionEnd: string | null;
}

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/** Lit l'état de licence de l'abonné, sans lever d'erreur. */
export async function getEntitlement(userId: string): Promise<Entitlement> {
  const { data, error } = await adminClient()
    .from("profiles")
    .select("subscription_status, subscription_end, is_admin")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return { active: false, reason: "unknown", subscriptionEnd: null };
  }

  // Les comptes admin passent toujours (usage interne, démos).
  if (data.is_admin === true) {
    return {
      active: true,
      reason: "admin",
      subscriptionEnd: data.subscription_end ?? null,
    };
  }

  // Statut d'abonnement.
  if (!ACTIVE_STATUSES.has(String(data.subscription_status ?? ""))) {
    return {
      active: false,
      reason: "inactive",
      subscriptionEnd: data.subscription_end ?? null,
    };
  }

  // Contrôle d'EXPIRATION — cœur de la licence renouvelable.
  // Pas de date = refus prudent (on ne laisse pas passer un accès sans borne).
  const end = data.subscription_end
    ? new Date(data.subscription_end).getTime()
    : 0;
  if (!end || end <= Date.now()) {
    return {
      active: false,
      reason: "expired",
      subscriptionEnd: data.subscription_end ?? null,
    };
  }

  return { active: true, reason: "active", subscriptionEnd: data.subscription_end };
}

/** Erreur normalisée à mapper en HTTP 402 (Payment Required). */
export class EntitlementError extends Error {
  readonly status = 402;
  readonly reason: string;
  constructor(reason: string) {
    super(`PAYMENT_REQUIRED: ${reason}`);
    this.name = "EntitlementError";
    this.reason = reason;
  }
}

/** Lève EntitlementError si la licence n'est pas active. Sinon renvoie l'état. */
export async function assertActiveEntitlement(
  userId: string,
): Promise<Entitlement> {
  const ent = await getEntitlement(userId);
  if (!ent.active) throw new EntitlementError(ent.reason);
  return ent;
}
