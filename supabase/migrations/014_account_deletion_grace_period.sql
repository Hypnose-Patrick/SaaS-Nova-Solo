-- Nova Solo — Délai de grâce avant suppression définitive du compte
-- Résiliation (annulation Stripe) OU auto-suppression volontaire (Réglages)
-- ne détruisent pas les données immédiatement : nova.accounts.scheduled_purge_at
-- programme une purge à +30 jours. Un réabonnement avant cette échéance efface
-- la date programmée (stripe-webhook) et restaure l'accès aux données intactes.
--
-- Portée : schéma "nova" uniquement. Additive only.

ALTER TABLE nova.accounts ADD COLUMN IF NOT EXISTS scheduled_purge_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS nova_accounts_purge_idx
  ON nova.accounts (scheduled_purge_at)
  WHERE scheduled_purge_at IS NOT NULL;
