-- Nova Solo — Stripe Subscription
-- Ajoute les colonnes nécessaires au suivi des abonnements Stripe sur nova.profiles

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id    TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status   TEXT DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS subscription_id       TEXT,
  ADD COLUMN IF NOT EXISTS subscription_end      TIMESTAMPTZ;

-- Index pour lookup rapide par customer_id (webhook Stripe)
CREATE INDEX IF NOT EXISTS profiles_stripe_customer_idx
  ON profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- RLS : l'utilisateur ne peut lire que son propre statut
-- (les policies existantes de la 001 couvrent déjà profiles, pas besoin de recréer)
