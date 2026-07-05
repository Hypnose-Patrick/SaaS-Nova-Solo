// Edge Function : account-delete
// Rôle : auto-suppression volontaire du compte (CGU §8 — "suppression du compte
// à tout moment dans Réglages"). Ne détruit RIEN immédiatement : résilie
// l'abonnement Stripe actif (sinon l'abonné continuerait d'être facturé pour
// un compte "supprimé") et programme une purge à +30 jours
// (nova.accounts.scheduled_purge_at), exécutée par le job planifié
// purge-expired-accounts. Un réabonnement avant cette échéance annule la purge
// (cf. stripe-webhook) et restaure l'accès aux données intactes.
//
// API (POST only, conforme aux CORS partagés) : { action: "delete" } -> { purgeAt }

import Stripe from "https://esm.sh/stripe@14?target=deno";
import { handleOptions, json } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { adminClient } from "../_shared/admin.ts";

const GRACE_PERIOD_DAYS = 30;
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16" });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    const user = await requireUser(req);
    const db = adminClient();

    const { data: account, error: accErr } = await db
      .from("accounts")
      .select("subscription_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (accErr) return json({ error: "Compte introuvable", detail: accErr.message }, 404);

    // Résilie l'abonnement Stripe s'il y en a un actif — sinon customer.subscription.deleted
    // arrivera plus tard (webhook) et reprogrammera la même purge, mais l'abonné
    // continuerait entre-temps d'être facturé pour un compte qu'il vient de supprimer.
    if (account?.subscription_id) {
      try {
        await stripe.subscriptions.cancel(account.subscription_id);
      } catch (err) {
        // Déjà annulé côté Stripe (ex. via portail client) — pas bloquant.
        console.warn("[account-delete] annulation Stripe:", err);
      }
    }

    const purgeAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await db
      .from("accounts")
      .update({ subscription_status: "canceled", scheduled_purge_at: purgeAt })
      .eq("user_id", user.id);
    if (error) return json({ error: "Échec de la programmation", detail: error.message }, 500);

    return json({ purgeAt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith("UNAUTHENTICATED") ? 401 : 500;
    return json({ error: msg.split(":")[0], detail: msg }, status);
  }
});
