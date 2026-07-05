import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

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

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.customer) {
        const patch: Record<string, unknown> = {
          subscription_status: "active",
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

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
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
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      // Résiliation = délai de grâce de 30 jours avant purge définitive
      // (cf. migration 014 + purge-expired-accounts), pas un effacement immédiat.
      const purgeAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
      await updateByCustomer(String(sub.customer), {
        subscription_status: "canceled",
        subscription_id: null,
        subscription_end: null,
        scheduled_purge_at: purgeAt,
      });
      break;
    }

    default:
      console.log(`[stripe-webhook] event ignoré: ${event.type}`);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" }
  });
});
