-- Nova Solo — Stripe Subscription
-- Ajoute les colonnes de suivi abonnement Stripe sur nova.profiles

ALTER TABLE nova.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id  TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS subscription_id     TEXT,
  ADD COLUMN IF NOT EXISTS subscription_end    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS nova_profiles_stripe_customer_idx
  ON nova.profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
