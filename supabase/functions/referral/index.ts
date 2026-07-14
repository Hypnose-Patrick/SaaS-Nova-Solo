// Edge Function : referral
// Parrainage Nova Solo Suisse — 3 paliers progressifs (migration 020). Toutes les
// écritures de parrainage passent ici (service_role), la RLS des tables referral_*
// étant SELECT-only côté client.
//
// API (POST only) :
//   { action: "claim", code }           -> verrouille la relation parrain->filleul
//                                          À L'INSCRIPTION (jamais rétroactif).
//   { action: "summary" }               -> données du tableau de bord parrainage
//                                          (mon code/lien, mes filleuls, récompenses,
//                                          progression 3 paliers, partage débloqué ?).
//   { action: "unlock-share", trigger } -> révèle le module de partage après le pic
//                                          émotionnel (1er client ajouté / 1ère facture).

import { handleOptions, json } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { adminClient } from "../_shared/admin.ts";
import { applyReferralRewards, refreshRefereeStatus, logReferralEvent } from "../_shared/referral.ts";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
});

function appUrl(): string {
  return Deno.env.get("APP_URL") ?? "https://start-mybusiness.com";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    const user = await requireUser(req);
    const db = adminClient();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "summary");

    const { data: account } = await db
      .from("accounts")
      .select("id, plan, subscription_status, paid_invoices_count, is_admin")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!account) return json({ error: "Compte introuvable", code: "ACCOUNT_NOT_FOUND" }, 404);

    // ------------------------------------------------------------------ claim
    if (action === "claim") {
      const code = String(body.code ?? "").trim().toUpperCase();
      if (!code) return json({ error: "Code manquant", code: "NO_CODE" }, 400);

      // Le code ne s'applique qu'À L'INSCRIPTION : jamais si le compte a déjà payé
      // (rétroactif interdit, même règle que côté France).
      if (Number(account.paid_invoices_count ?? 0) > 0) {
        return json({ error: "Le code n'est applicable qu'à l'inscription", code: "TOO_LATE" }, 409);
      }

      // Un filleul = un seul parrain, verrouillé.
      const { data: existing } = await db
        .from("referrals").select("id").eq("referee_account_id", account.id).maybeSingle();
      if (existing) return json({ error: "Un parrain est déjà enregistré", code: "ALREADY_REFERRED" }, 409);

      // Résout le code -> compte parrain.
      const { data: codeRow } = await db
        .from("referral_codes").select("account_id").eq("code", code).maybeSingle();
      if (!codeRow) return json({ error: "Code de parrainage inconnu", code: "INVALID_CODE" }, 404);
      const referrerId = codeRow.account_id as string;

      if (referrerId === account.id) {
        return json({ error: "Impossible de se parrainer soi-même", code: "SELF_REFERRAL" }, 409);
      }

      // Le palier BYOK ("solo" en interne) ne peut pas parrainer — on refuse plutôt
      // que de verrouiller le filleul à un parrain jamais éligible.
      const { data: referrer } = await db
        .from("accounts").select("plan").eq("id", referrerId).maybeSingle();
      if (!referrer || referrer.plan === "solo") {
        return json({ error: "Ce code ne permet pas de parrainer", code: "REFERRER_NOT_ELIGIBLE" }, 409);
      }

      const { error: insErr } = await db.from("referrals").insert({
        referrer_account_id: referrerId,
        referee_account_id: account.id,
        code_used: code,
        status: "trial",
      });
      if (insErr) {
        if (String(insErr.message).includes("duplicate")) {
          return json({ error: "Un parrain est déjà enregistré", code: "ALREADY_REFERRED" }, 409);
        }
        return json({ error: "Échec de l'enregistrement", detail: insErr.message }, 500);
      }

      await logReferralEvent(db, {
        type: "claim", account_id: account.id,
        referrer_account_id: referrerId, referee_account_id: account.id, meta: { code },
      });

      // Recalage du statut (le compte peut déjà être en month1_paid) + éventuelle
      // réévaluation des récompenses du parrain.
      const res = await refreshRefereeStatus(db, account.id);
      if (res?.referrerId) await applyReferralRewards(db, stripe, res.referrerId);

      return json({ ok: true });
    }

    // ----------------------------------------------------------- unlock-share
    if (action === "unlock-share") {
      const trigger = String(body.trigger ?? "");
      if (!["first_client_added", "first_invoice_sent"].includes(trigger)) {
        return json({ error: "Trigger invalide", code: "BAD_TRIGGER" }, 400);
      }
      const { data: already } = await db
        .from("referral_share_unlocks").select("account_id").eq("account_id", account.id).maybeSingle();
      if (!already) {
        await db.from("referral_share_unlocks").insert({ account_id: account.id, trigger });
        await logReferralEvent(db, { type: "share_unlocked", account_id: account.id, meta: { trigger } });
      }
      return json({ ok: true, unlocked: true });
    }

    // ---------------------------------------------------------------- summary
    if (action === "summary") {
      let { data: codeRow } = await db
        .from("referral_codes").select("code").eq("account_id", account.id).maybeSingle();

      // Génère le code au premier accès au tableau de bord (pas à l'inscription —
      // évite de créer un code pour un compte qui n'ouvrira jamais l'onglet parrainage).
      if (!codeRow) {
        const code = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
        const { data: created, error: codeErr } = await db
          .from("referral_codes").insert({ account_id: account.id, code }).select("code").single();
        if (!codeErr) codeRow = created;
      }
      const code = codeRow?.code ?? null;

      const { data: filleuls } = await db
        .from("referrals")
        .select("status, created_at, qualified_at")
        .eq("referrer_account_id", account.id)
        .order("created_at", { ascending: true });

      const { data: grants } = await db
        .from("referral_reward_grants")
        .select("type, milestone, status, starts_at, ends_at")
        .eq("referrer_account_id", account.id);

      const { data: desiredRows } = await db.rpc("referral_desired_rewards", { p_referrer: account.id });
      const desired = Array.isArray(desiredRows) ? desiredRows[0] : desiredRows;

      const { data: unlock } = await db
        .from("referral_share_unlocks").select("unlocked_at, trigger").eq("account_id", account.id).maybeSingle();

      const eligible = account.plan && ["pro", "trio"].includes(String(account.plan))
        && Number(account.paid_invoices_count ?? 0) >= 2;

      return json({
        code,
        link: code ? `${appUrl()}/?ref=${code}` : null,
        eligible_to_refer: eligible,
        share_unlocked: !!unlock,
        share_trigger: unlock?.trigger ?? null,
        counts: {
          n_actifs: desired?.n_actifs ?? 0,
          want_upgrade: desired?.want_upgrade ?? false,
          want_discount5: desired?.want_discount5 ?? false,
          cash_eligible_count: Array.isArray(desired?.cash_eligible_referees)
            ? desired.cash_eligible_referees.length : 0,
        },
        filleuls: (filleuls ?? []).map((f) => ({
          status: f.status,
          created_at: f.created_at,
          qualified_at: f.qualified_at,
        })),
        rewards: grants ?? [],
      });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith("UNAUTHENTICATED") ? 401 : 500;
    return json({ error: msg.split(":")[0], detail: msg }, status);
  }
});
