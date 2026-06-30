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

  async function updateByCustomer(customerId: string, patch: Record<string, unknown>) {
    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("stripe_customer_id", customerId);
    if (error) console.error("[stripe-webhook] update error", error);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.customer) {
        await updateByCustomer(String(session.customer), {
          subscription_status: "active",
          subscription_id: String(session.subscription),
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await updateByCustomer(String(sub.customer), {
        subscription_status: sub.status === "active" || sub.status === "trialing"
          ? sub.status
          : "inactive",
        subscription_id: sub.id,
        subscription_end: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
      });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await updateByCustomer(String(sub.customer), {
        subscription_status: "canceled",
        subscription_id: null,
        subscription_end: null,
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
