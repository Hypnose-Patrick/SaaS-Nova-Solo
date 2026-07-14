-- Nova Solo Suisse — Suivi des prélèvements réussis sur nova.accounts
--
-- POURQUOI : socle technique manquant identifié dans la stratégie de
-- parrainage CH (Nova-Solo-CH_Synthese-Strategie.md §3/§5) — la qualification
-- "filleul actif" y est définie comme "2e mois d'abonnement payé", exactement
-- comme côté France (migration 021_referral_phase1.sql sur SaaS-Nova-France),
-- mais nova.accounts n'avait ici aucun compteur de paiement, et le webhook
-- Stripe ne traitait aucun événement invoice.*.
--
-- Cette migration ajoute UNIQUEMENT le compteur + l'idempotence webhook —
-- pas les tables de parrainage (referrals, referral_reward_grants, etc.),
-- qui restent un chantier séparé, non demandé à ce stade.
--
-- Portée : schéma "nova" uniquement. Additive only + idempotent (IF NOT
-- EXISTS / DROP ... IF EXISTS) => rejouable sans risque.

-- ============================================================================
-- 1. Compteurs de paiement sur nova.accounts
-- ============================================================================
ALTER TABLE nova.accounts
  ADD COLUMN IF NOT EXISTS paid_invoices_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_paid_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS second_paid_at TIMESTAMPTZ;

-- ============================================================================
-- 2. processed_stripe_events — idempotence des webhooks (un event Stripe ne
--    doit incrémenter le compteur qu'une seule fois, même en cas de redelivery).
--    Aucune policy RLS volontairement : service_role uniquement.
-- ============================================================================
CREATE TABLE IF NOT EXISTS nova.processed_stripe_events (
  event_id     TEXT PRIMARY KEY,
  type         TEXT,
  processed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE nova.processed_stripe_events ENABLE ROW LEVEL SECURITY;
-- Intentionnellement aucune policy => deny-all pour anon/authenticated,
-- seul le service_role (Edge Function stripe-webhook) peut y accéder.

GRANT SELECT, INSERT, UPDATE, DELETE ON nova.processed_stripe_events TO anon, authenticated, service_role;
