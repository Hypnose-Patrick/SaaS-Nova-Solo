import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { db: { schema: "nova" } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, email, name")
      .eq("user_id", user.id)
      .single();

    const appUrl = Deno.env.get("APP_URL") ?? "https://start-mybusiness.com";

    // Palier choisi : Solo = CHF 9/mois (BYOK) ; Pro = CHF 29/mois (IA managée,
    // c'est l'offre historique déjà vendue sur la landing avant l'ajout de Solo).
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const plan = body?.plan === "pro" ? "pro" : "solo";
    // STRIPE_PRICE_ID = ancien secret mono-tarif (CHF 29/mois, déjà en place) —
    // conservé en repli pour Pro tant que STRIPE_PRICE_ID_PRO n'est pas posé,
    // afin de ne pas casser le bouton "Commencer — Solo" déjà public sur la landing.
    const priceId = plan === "pro"
      ? (Deno.env.get("STRIPE_PRICE_ID_PRO") ?? Deno.env.get("STRIPE_PRICE_ID"))
      : Deno.env.get("STRIPE_PRICE_ID_SOLO");
    if (!priceId) {
      const missing = plan === "pro" ? "STRIPE_PRICE_ID_PRO / STRIPE_PRICE_ID" : "STRIPE_PRICE_ID_SOLO";
      return new Response(JSON.stringify({ error: `Configuration manquante : ${missing}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? profile?.email,
        name: profile?.name ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      metadata: { plan },
      subscription_data: { metadata: { plan } },
      // `/` est servi par Hostinger comme la landing (via .htaccess) — il faut une
      // route SPA, sinon l'utilisateur retombe sur la landing après paiement.
      // /login (connecté) passe le gate → dashboard une fois l'abonnement actif.
      success_url: `${appUrl}/login?subscription=success`,
      cancel_url: `${appUrl}/subscribe?subscription=cancelled`,
      locale: "fr",
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("[stripe-checkout]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
