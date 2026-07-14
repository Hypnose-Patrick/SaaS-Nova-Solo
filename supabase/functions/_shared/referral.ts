// Nova Solo Suisse — Parrainage, mécanique 3 paliers progressifs (CHF).
// Cf. migration 020_referral_paliers_ch.sql + Nova-Solo-CH_Synthese-Strategie.md §3.
// Transposition directe de SaaS-Nova-France/supabase/functions/_shared/referral.ts.
//
// Paliers (n_actifs = filleuls qualifiés, paid_invoices_count >= 2) :
//   - 2..4 filleuls -> upgrade trio(39 CHF) en payant pro(29 CHF), coupon -10 CHF forever.
//   - >= 5 filleuls -> REMPLACE le palier 1 : reste sur pro(29 CHF), coupon -10 CHF forever
//     (29 -> 19 CHF).
//   - >= 7 filleuls -> cash 7 CHF/mois, uniquement le 7e filleul qualifié et les suivants,
//     s'additionne au palier 2 (ne remplace rien).
//
// ⚠️⚠️ PALIER 3 (CASH) — PAS DE VIREMENT RÉEL IMPLÉMENTÉ. grantCash()/revertCash() ne
// font QUE du bookkeeping (une ligne dans referral_reward_grants + un log dans
// referral_events) — aucun appel Stripe Connect, aucun transfert d'argent. Gated par
// la variable d'env REFERRAL_CASH_ENABLED (absente/≠"true" par défaut => désactivé).
// Ne PAS activer ce flag avant (a) que Patrick puisse justifier son statut Sàrl/
// individuel côté Stripe Connect, ET (b) qu'un développeur ait câblé le virement réel.
// Même garde-fou que côté France — voir Nova-Solo-CH_Synthese-Strategie.md §3.
//
// ⚠️ Pas d'envoi d'email de notification ici (pas d'infra Resend transactionnelle côté
// SaaS-Nova-Solo à ce jour, cf. Nova-Solo-CH_Synthese-Strategie.md §5 point 5) — chaque
// changement de récompense est journalisé dans referral_events, à connecter à un envoi
// réel quand l'infra email sera posée.
//
// ⚠️ Limitation connue (héritée de la même conception côté France) : grantUpgrade /
// grantDiscount5 forcent le prix Stripe réel du parrain vers pro/trio. Un parrain déjà
// abonné Trio pour son propre usage (3 projets) verrait son abonnement retomber sur le
// prix Pro-remisé s'il devenait aussi éligible au parrainage — cas non traité ici, comme
// en France. À surveiller si des parrains Trio légitimes commencent à parrainer.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14?target=deno";

export const UPGRADE_COUPON_ID = "PARRAIN_UPGRADE_M10_CHF";
export const DISCOUNT5_COUPON_ID = "PARRAIN_DISCOUNT5_M10_CHF";
const COUPON_CURRENCY = "chf";
const CASH_ENABLED = Deno.env.get("REFERRAL_CASH_ENABLED") === "true";

// Crée les coupons Stripe (idempotent : retrieve puis create si absent) — à
// appeler avant tout premier usage d'un coupon, sans effet si déjà existants.
export async function ensureReferralCoupons(stripe: Stripe): Promise<void> {
  const coupons: { id: string; amount_off: number; name: string }[] = [
    { id: UPGRADE_COUPON_ID, amount_off: 1000, name: "Parrainage — upgrade Trio au prix Solo" },
    { id: DISCOUNT5_COUPON_ID, amount_off: 1000, name: "Parrainage — remise 5 filleuls" },
  ];
  for (const c of coupons) {
    try {
      await stripe.coupons.retrieve(c.id);
    } catch {
      await stripe.coupons.create({
        id: c.id,
        amount_off: c.amount_off,
        currency: COUPON_CURRENCY,
        duration: "forever",
        name: c.name,
      });
    }
  }
}

interface DesiredRewards {
  parrain_eligible: boolean;
  n_actifs: number;
  want_upgrade: boolean;
  want_discount5: boolean;
  cash_eligible_referees: string[];
}

// deno-lint-ignore no-explicit-any
function desiredRewards(row: any): DesiredRewards {
  return {
    parrain_eligible: !!row?.parrain_eligible,
    n_actifs: Number(row?.n_actifs ?? 0),
    want_upgrade: !!row?.want_upgrade,
    want_discount5: !!row?.want_discount5,
    cash_eligible_referees: Array.isArray(row?.cash_eligible_referees) ? row.cash_eligible_referees : [],
  };
}

export async function logReferralEvent(
  db: SupabaseClient,
  event: {
    type: string;
    account_id?: string;
    referrer_account_id?: string;
    referee_account_id?: string;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await db.from("referral_events").insert(event);
  if (error) console.error("[referral] logReferralEvent", error);
}

async function accountRow(db: SupabaseClient, id: string) {
  const { data } = await db
    .from("accounts")
    .select("id, plan, stripe_customer_id, subscription_id")
    .eq("id", id)
    .maybeSingle();
  return data;
}

async function currentItemId(stripe: Stripe, subscriptionId: string): Promise<string | null> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  return sub.items.data[0]?.id ?? null;
}

async function upsertGrant(
  db: SupabaseClient,
  referrerId: string,
  refereeId: string | null,
  type: "plan_upgrade" | "invoice_discount",
  milestone: "two_referrals" | "five_referrals",
  couponId: string,
): Promise<void> {
  const { data: existing } = await db
    .from("referral_reward_grants")
    .select("id")
    .eq("referrer_account_id", referrerId)
    .eq("type", type)
    .eq("status", "active")
    .maybeSingle();
  if (existing) return;
  const { error } = await db.from("referral_reward_grants").insert({
    referrer_account_id: referrerId,
    referee_account_id: refereeId,
    type,
    milestone,
    status: "active",
    stripe_coupon_id: couponId,
  });
  if (error) console.error("[referral] upsertGrant", error);
}

async function revokeGrant(
  db: SupabaseClient,
  referrerId: string,
  type: "plan_upgrade" | "invoice_discount",
): Promise<void> {
  const { error } = await db
    .from("referral_reward_grants")
    .update({ status: "revoked", ends_at: new Date().toISOString() })
    .eq("referrer_account_id", referrerId)
    .eq("type", type)
    .eq("status", "active");
  if (error) console.error("[referral] revokeGrant", error);
}

// ============================================================================
// Palier 1 — upgrade Trio (39 CHF) en payant Pro (29 CHF)
// ============================================================================
async function grantUpgrade(db: SupabaseClient, stripe: Stripe, referrerId: string): Promise<void> {
  const acc = await accountRow(db, referrerId);
  if (!acc?.subscription_id) return;
  const trioPrice = Deno.env.get("STRIPE_PRICE_ID_TRIO");
  if (!trioPrice) { console.error("[referral] STRIPE_PRICE_ID_TRIO absent"); return; }
  const itemId = await currentItemId(stripe, acc.subscription_id);
  if (!itemId) return;
  await ensureReferralCoupons(stripe);
  await stripe.subscriptions.update(acc.subscription_id, {
    items: [{ id: itemId, price: trioPrice }],
    coupon: UPGRADE_COUPON_ID,
    proration_behavior: "none",
  });
  await db.from("accounts").update({ plan: "trio", max_projects: 3 }).eq("id", referrerId);
  await upsertGrant(db, referrerId, null, "plan_upgrade", "two_referrals", UPGRADE_COUPON_ID);
  await logReferralEvent(db, { type: "grant_upgrade", referrer_account_id: referrerId });
}

async function revertUpgrade(db: SupabaseClient, stripe: Stripe, referrerId: string): Promise<void> {
  const acc = await accountRow(db, referrerId);
  if (!acc?.subscription_id) return;
  const proPrice = Deno.env.get("STRIPE_PRICE_ID_PRO") ?? Deno.env.get("STRIPE_PRICE_ID");
  if (!proPrice) { console.error("[referral] STRIPE_PRICE_ID_PRO absent"); return; }
  const itemId = await currentItemId(stripe, acc.subscription_id);
  if (itemId) {
    await stripe.subscriptions.update(acc.subscription_id, {
      items: [{ id: itemId, price: proPrice }],
      proration_behavior: "none",
    });
  }
  try { await stripe.subscriptions.deleteDiscount(acc.subscription_id); } catch { /* pas de discount actif */ }
  await db.from("accounts").update({ plan: "pro", max_projects: 1 }).eq("id", referrerId);
  await revokeGrant(db, referrerId, "plan_upgrade");
  await logReferralEvent(db, { type: "revert_upgrade", referrer_account_id: referrerId });
}

// ============================================================================
// Palier 2 — remise récurrente -10 CHF/mois (29 -> 19 CHF), remplace le palier 1
// ============================================================================
async function grantDiscount5(db: SupabaseClient, stripe: Stripe, referrerId: string): Promise<void> {
  const acc = await accountRow(db, referrerId);
  if (!acc?.subscription_id) return;
  const proPrice = Deno.env.get("STRIPE_PRICE_ID_PRO") ?? Deno.env.get("STRIPE_PRICE_ID");
  if (!proPrice) { console.error("[referral] STRIPE_PRICE_ID_PRO absent"); return; }
  const itemId = await currentItemId(stripe, acc.subscription_id);
  if (!itemId) return;
  await ensureReferralCoupons(stripe);
  await stripe.subscriptions.update(acc.subscription_id, {
    items: [{ id: itemId, price: proPrice }],
    coupon: DISCOUNT5_COUPON_ID,
    proration_behavior: "none",
  });
  await db.from("accounts").update({ plan: "pro", max_projects: 1 }).eq("id", referrerId);
  await upsertGrant(db, referrerId, null, "invoice_discount", "five_referrals", DISCOUNT5_COUPON_ID);
  await logReferralEvent(db, { type: "grant_discount5", referrer_account_id: referrerId });
}

async function revertDiscount5(db: SupabaseClient, stripe: Stripe, referrerId: string): Promise<void> {
  const acc = await accountRow(db, referrerId);
  if (acc?.subscription_id) {
    try { await stripe.subscriptions.deleteDiscount(acc.subscription_id); } catch { /* pas de discount actif */ }
  }
  await revokeGrant(db, referrerId, "invoice_discount");
  await logReferralEvent(db, { type: "revert_discount5", referrer_account_id: referrerId });
}

// ============================================================================
// Palier 3 — cash 7 CHF/mois par filleul (bookkeeping only, cf. avertissement en tête)
// ============================================================================
async function grantCash(db: SupabaseClient, referrerId: string, refereeId: string): Promise<void> {
  const { data: existing } = await db
    .from("referral_reward_grants")
    .select("id")
    .eq("referrer_account_id", referrerId)
    .eq("referee_account_id", refereeId)
    .eq("type", "cash_commission")
    .eq("status", "active")
    .maybeSingle();
  if (existing) return;
  const { error } = await db.from("referral_reward_grants").insert({
    referrer_account_id: referrerId,
    referee_account_id: refereeId,
    type: "cash_commission",
    milestone: "seven_referrals_cash",
    status: "active",
    stripe_coupon_id: null,
  });
  if (error) console.error("[referral] grantCash", error);
  await logReferralEvent(db, {
    type: "grant_cash",
    referrer_account_id: referrerId,
    referee_account_id: refereeId,
    meta: { note: "bookkeeping only, no transfer" },
  });
}

async function revertCash(db: SupabaseClient, referrerId: string, refereeId: string): Promise<void> {
  const { error } = await db
    .from("referral_reward_grants")
    .update({ status: "revoked", ends_at: new Date().toISOString() })
    .eq("referrer_account_id", referrerId)
    .eq("referee_account_id", refereeId)
    .eq("type", "cash_commission")
    .eq("status", "active");
  if (error) console.error("[referral] revertCash", error);
  await logReferralEvent(db, { type: "revert_cash", referrer_account_id: referrerId, referee_account_id: refereeId });
}

// ============================================================================
// Orchestrateur — lit l'état désiré (SQL, pur) et applique le delta (Stripe + DB).
// Idempotent : rejouable sans effet si l'état est déjà correct.
// ============================================================================
export async function applyReferralRewards(db: SupabaseClient, stripe: Stripe, referrerId: string): Promise<void> {
  const { data: rows } = await db.rpc("referral_desired_rewards", { p_referrer: referrerId });
  const row = Array.isArray(rows) ? rows[0] : rows;
  const d = desiredRewards(row);

  const { data: activeGrants } = await db
    .from("referral_reward_grants")
    .select("type, referee_account_id")
    .eq("referrer_account_id", referrerId)
    .eq("status", "active");
  const grants = activeGrants ?? [];
  const activeUpgrade = grants.some((g) => g.type === "plan_upgrade");
  const activeDiscount5 = grants.some((g) => g.type === "invoice_discount");
  const activeCashRefereeIds = new Set(
    grants.filter((g) => g.type === "cash_commission").map((g) => g.referee_account_id as string),
  );

  if (!d.parrain_eligible) {
    if (activeUpgrade) await revertUpgrade(db, stripe, referrerId);
    if (activeDiscount5) await revertDiscount5(db, stripe, referrerId);
    for (const refId of activeCashRefereeIds) await revertCash(db, referrerId, refId);
    return;
  }

  // Paliers 1/2 mutuellement exclusifs — le palier 2 (discount5) gagne s'il est atteint.
  if (d.want_discount5) {
    if (activeUpgrade) await revertUpgrade(db, stripe, referrerId);
    if (!activeDiscount5) await grantDiscount5(db, stripe, referrerId);
  } else if (d.want_upgrade) {
    if (activeDiscount5) await revertDiscount5(db, stripe, referrerId);
    if (!activeUpgrade) await grantUpgrade(db, stripe, referrerId);
  } else {
    if (activeUpgrade) await revertUpgrade(db, stripe, referrerId);
    if (activeDiscount5) await revertDiscount5(db, stripe, referrerId);
  }

  // Palier 3 — cash, gated. Diff entre désiré et actif, par filleul.
  const desiredCashIds = new Set(d.cash_eligible_referees);
  if (!CASH_ENABLED) {
    if (desiredCashIds.size > 0 && activeCashRefereeIds.size === 0) {
      await logReferralEvent(db, {
        type: "cash_pending_activation",
        referrer_account_id: referrerId,
        meta: { eligible_count: desiredCashIds.size, note: "REFERRAL_CASH_ENABLED désactivé" },
      });
    }
    return;
  }
  for (const refId of desiredCashIds) {
    if (!activeCashRefereeIds.has(refId)) await grantCash(db, referrerId, refId);
  }
  for (const refId of activeCashRefereeIds) {
    if (!desiredCashIds.has(refId)) await revertCash(db, referrerId, refId);
  }
}

// ============================================================================
// Réévalue le statut d'un FILLEUL (trial -> month1_paid -> qualified / churned /
// on_byok) à partir de son propre compte. Retourne le parrain, pour permettre à
// l'appelant de réévaluer ensuite les récompenses de ce parrain.
// ============================================================================
export async function refreshRefereeStatus(
  db: SupabaseClient,
  refereeAccountId: string,
): Promise<{ referrerId: string | null }> {
  const { data: referral } = await db
    .from("referrals")
    .select("id, referrer_account_id, status, qualified_at")
    .eq("referee_account_id", refereeAccountId)
    .maybeSingle();
  if (!referral) return { referrerId: null };

  const { data: acc } = await db
    .from("accounts")
    .select("plan, subscription_status, paid_invoices_count")
    .eq("id", refereeAccountId)
    .maybeSingle();
  if (!acc) return { referrerId: referral.referrer_account_id };

  const count = Number(acc.paid_invoices_count ?? 0);
  let status: string;
  if (acc.plan === "solo") status = "on_byok"; // BYOK exclu de la qualification
  else if (acc.subscription_status === "canceled" || acc.subscription_status === "inactive") status = "churned";
  else if (count >= 2) status = "qualified";
  else if (count >= 1) status = "month1_paid";
  else status = "trial";

  const patch: Record<string, unknown> = {};
  if (status !== referral.status) patch.status = status;
  if (status === "qualified" && !referral.qualified_at) patch.qualified_at = new Date().toISOString();

  if (Object.keys(patch).length > 0) {
    const { error } = await db.from("referrals").update(patch).eq("id", referral.id);
    if (error) console.error("[referral] refreshRefereeStatus update", error);
  }

  return { referrerId: referral.referrer_account_id };
}
