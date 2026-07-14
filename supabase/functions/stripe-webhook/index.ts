import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { refreshRefereeStatus, applyReferralRewards } from "../_shared/referral.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
  } catch (err) {
    console.error("[stripe-webhook] signature invalide", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { db: { schema: "nova" } }
  );

  // Idempotence (migration 019) : un event Stripe n'est traité qu'une fois.
  // Rejeu (redelivery Stripe) => on court-circuite avant tout effet de bord
  // (compteur de paiement) grâce à la PK event_id.
  {
    const { error: dupErr } = await supabase
      .from("processed_stripe_events")
      .insert({ event_id: event.id, type: event.type });
    if (dupErr) {
      // 23505 = unique_violation => déjà traité.
      if ((dupErr as { code?: string }).code === "23505") {
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      console.error("[stripe-webhook] processed_stripe_events insert", dupErr);
    }
  }

  // Depuis la migration 013 (multi-projets), l'abonnement vit sur nova.accounts
  // (1 par utilisateur) — nova.profiles est désormais "un projet" et ne porte
  // plus stripe_customer_id/subscription_*.
  const PLAN_MAX_PROJECTS: Record<string, number> = { solo: 1, pro: 1, trio: 3 };
  const GRACE_PERIOD_DAYS = 30;

  async function updateByCustomer(customerId: string, patch: Record<string, unknown>) {
    const { error } = await supabase
      .from("accounts")
      .update(patch)
      .eq("stripe_customer_id", customerId);
    if (error) console.error("[stripe-webhook] update error", error);
  }

  async function accountByCustomer(customerId: string) {
    const { data } = await supabase
      .from("accounts")
      .select("id, paid_invoices_count, first_paid_at, second_paid_at")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    return data;
  }

  // Parrainage (migration 020) : ce compte peut être un FILLEUL (recalcule son
  // statut de qualification, puis les récompenses de SON parrain si qualifié/
  // déqualifié) ET un PARRAIN (son propre plan/statut a pu changer — ex.
  // downgrade vers BYOK — recalcule alors SES PROPRES récompenses). Idempotent
  // des deux côtés — sans effet si rien n'a changé depuis le dernier appel.
  async function reevaluateAround(accountId: string) {
    const res = await refreshRefereeStatus(supabase, accountId);
    if (res?.referrerId) await applyReferralRewards(supabase, stripe, res.referrerId);
    await applyReferralRewards(supabase, stripe, accountId);
  }

  function withMaxProjects(patch: Record<string, unknown>): Record<string, unknown> {
    const plan = patch.plan as string | undefined;
    if (plan && PLAN_MAX_PROJECTS[plan]) {
      return { ...patch, max_projects: PLAN_MAX_PROJECTS[plan] };
    }
    return patch;
  }

  // Les versions récentes de l'API Stripe ont déplacé `current_period_end` de
  // la racine de l'objet Subscription vers `items.data[0].current_period_end`.
  // On lit les deux emplacements pour rester compatible dans tous les cas.
  function periodEnd(sub: Stripe.Subscription): number | null {
    const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
    if (legacy) return legacy;
    const itemEnd = sub.items?.data?.[0]?.current_period_end;
    return itemEnd ?? null;
  }

  // Déduit le palier depuis le PRIX Stripe réel de l'abonnement, pas les
  // metadata (qui ne changent pas quand l'abonné bascule de palier via le
  // Portail Client Stripe — cf. stripe-portal). Les metadata ne servent que
  // de repli si le prix ne correspond à aucun palier connu.
  const PRICE_TO_PLAN: Record<string, string> = {};
  if (Deno.env.get("STRIPE_PRICE_ID_SOLO")) PRICE_TO_PLAN[Deno.env.get("STRIPE_PRICE_ID_SOLO")!] = "solo";
  if (Deno.env.get("STRIPE_PRICE_ID_PRO")) PRICE_TO_PLAN[Deno.env.get("STRIPE_PRICE_ID_PRO")!] = "pro";
  if (Deno.env.get("STRIPE_PRICE_ID")) PRICE_TO_PLAN[Deno.env.get("STRIPE_PRICE_ID")!] = "pro";
  if (Deno.env.get("STRIPE_PRICE_ID_TRIO")) PRICE_TO_PLAN[Deno.env.get("STRIPE_PRICE_ID_TRIO")!] = "trio";

  function resolvePlan(sub: Stripe.Subscription): string | undefined {
    const priceId = sub.items?.data?.[0]?.price?.id;
    if (priceId && PRICE_TO_PLAN[priceId]) return PRICE_TO_PLAN[priceId];
    const metaPlan = sub.metadata?.plan;
    if (metaPlan === "solo" || metaPlan === "pro" || metaPlan === "trio") return metaPlan;
    return undefined;
  }

  // Logique de synchro partagée entre la création et la mise à jour d'un
  // abonnement — c'est elle qui écrit le vrai statut Stripe ("trialing" pendant
  // l'essai de 14 jours, "active" une fois le premier prélèvement effectué).
  async function syncFromSubscription(sub: Stripe.Subscription) {
    const end = periodEnd(sub);
    const isActive = sub.status === "active" || sub.status === "trialing";
    const patch: Record<string, unknown> = {
      subscription_status: isActive ? sub.status : "inactive",
      subscription_id: sub.id,
      subscription_end: end ? new Date(end * 1000).toISOString() : null,
    };
    // Reprise d'un abonnement (ex. carte régularisée après échec de paiement) =
    // annule une purge déjà programmée.
    if (isActive) patch.scheduled_purge_at = null;
    // Déduit le palier du prix réel — couvre aussi bien un changement fait
    // depuis le Portail Client Stripe (upgrade/downgrade) qu'un événement
    // de renouvellement standard.
    const plan = resolvePlan(sub);
    if (plan) patch.plan = plan;
    await updateByCustomer(String(sub.customer), withMaxProjects(patch));
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.customer) {
        // Ne PAS écrire subscription_status ici : avec l'essai de 14 jours,
        // Stripe envoie ce webhook en même temps que customer.subscription.created,
        // qui seul connaît le vrai statut ("trialing" vs "active") via syncFromSubscription.
        const patch: Record<string, unknown> = {
          subscription_id: String(session.subscription),
          // Réabonnement = annule une éventuelle purge programmée (résiliation
          // précédente ou auto-suppression volontaire, cf. account-delete).
          scheduled_purge_at: null,
        };
        const plan = session.metadata?.plan;
        if (plan === "solo" || plan === "pro" || plan === "trio") patch.plan = plan;
        await updateByCustomer(String(session.customer), withMaxProjects(patch));
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await syncFromSubscription(sub);
      // Un changement de plan/statut peut (dé)qualifier un filleul ou
      // (dés)éligibiliser un parrain (ex. downgrade vers BYOK = plan "solo").
      const acc = await accountByCustomer(String(sub.customer));
      if (acc) await reevaluateAround(acc.id);
      break;
    }

    case "invoice.paid": {
      // Socle du "2e mois payé" (qualification parrainage CH, cf.
      // Nova-Solo-CH_Synthese-Strategie.md §3) : on compte les prélèvements
      // réussis. "2e mois" = paid_invoices_count atteint 2 (second_paid_at renseigné).
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer ? String(invoice.customer) : null;
      // Compat multi-versions d'API : depuis 2025-03-31.basil, `invoice.subscription`
      // est déplacé sous `parent.subscription_details.subscription`. On lit les deux
      // emplacements. Seuls les prélèvements d'ABONNEMENT comptent (pas une facture
      // ponctuelle hors abonnement, s'il devait un jour en exister).
      const inv = invoice as unknown as {
        subscription?: string;
        parent?: { subscription_details?: { subscription?: string } };
      };
      const subFromInvoice = inv.subscription ?? inv.parent?.subscription_details?.subscription ?? null;
      if (customerId && subFromInvoice) {
        const acc = await accountByCustomer(customerId);
        if (acc) {
          const count = Number(acc.paid_invoices_count ?? 0) + 1;
          const at = new Date((invoice.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString();
          const patch: Record<string, unknown> = { paid_invoices_count: count };
          if (!acc.first_paid_at) patch.first_paid_at = at;
          if (count === 2 && !acc.second_paid_at) patch.second_paid_at = at;
          const { error } = await supabase.from("accounts").update(patch).eq("id", acc.id);
          if (error) console.error("[stripe-webhook] paid_invoices_count update error", error);
          // Cœur de la mécanique parrainage : "2e mois payé" = filleul qualifié.
          await reevaluateAround(acc.id);
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      // Résiliation = délai de grâce de 30 jours avant purge définitive
      // (cf. migration 014 + purge-expired-accounts), pas un effacement immédiat.
      const purgeAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const accBeforeCancel = await accountByCustomer(String(sub.customer));
      await updateByCustomer(String(sub.customer), {
        subscription_status: "canceled",
        subscription_id: null,
        subscription_end: null,
        scheduled_purge_at: purgeAt,
      });
      // Résiliation = filleul potentiellement "churned" -> réévalue les
      // récompenses de son parrain (dégressivité, cf. stratégie §3).
      if (accBeforeCancel) await reevaluateAround(accBeforeCancel.id);
      break;
    }

    default:
      console.log(`[stripe-webhook] event ignoré: ${event.type}`);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" }
  });
});
