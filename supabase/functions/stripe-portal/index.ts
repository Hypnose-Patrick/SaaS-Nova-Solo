// Edge Function : stripe-portal
// Rôle : ouvrir le Portail Client Stripe pour l'abonné authentifié — upgrade
// / downgrade entre paliers (BYOK/Pro/Trio), mise à jour moyen de paiement,
// résiliation. Toute la logique de proration et de changement de plan est
// déléguée à Stripe (aucun code de proration ici) — cf. configuration
// obligatoire dans Stripe Dashboard → Settings → Billing → Customer Portal
// (activer "Update subscription" et lister les 3 prix comme options).
//
// API (POST only, conforme aux CORS partagés) : {} -> { url }

import Stripe from "https://esm.sh/stripe@14?target=deno";
import { handleOptions, json } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { adminClient } from "../_shared/admin.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16" });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    const user = await requireUser(req);
    const db = adminClient();

    const { data: account, error: accErr } = await db
      .from("accounts")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (accErr || !account?.stripe_customer_id) {
      return json({ error: "Aucun abonnement Stripe associé à ce compte", code: "NO_CUSTOMER" }, 404);
    }

    const appUrl = Deno.env.get("APP_URL") ?? "https://start-mybusiness.com";
    const session = await stripe.billingPortal.sessions.create({
      customer: account.stripe_customer_id,
      return_url: `${appUrl}/settings`,
    });

    return json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith("UNAUTHENTICATED") ? 401 : 500;
    return json({ error: msg.split(":")[0], detail: msg }, status);
  }
});
