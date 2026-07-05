-- Nova Solo — Archive de facturation (survit à la purge de compte)
--
-- POURQUOI : Politique de confidentialité §2 engage à conserver la
-- "Référence transaction" 10 ans (obligation comptable suisse CO 958f).
-- Le job purge-expired-accounts (migration 014) supprime définitivement
-- nova.accounts après le délai de grâce de 30 jours — sans ce garde-fou,
-- cette suppression cascaderait sur stripe_customer_id/subscription_id et
-- violerait l'engagement de rétention comptable.
--
-- Cette table ne conserve QUE la référence transactionnelle (pas les données
-- de profil/business/IA du sous-crit — celles-ci sont légitimement effacées
-- à la purge, l'utilisateur en a fait la demande). Aucune RLS policy créée
-- volontairement : accès service_role uniquement (comptabilité de Patrick),
-- jamais exposée au frontend ni à un abonné.
--
-- ⚠️ Hypothèse à confirmer par Patrick (cf. revue hermes-lex du 2026-07-05) :
-- cette archive part du principe que "Référence transaction" désigne la
-- rétention COMPTABLE PROPRE à Patrick/SeedJobs Sàrl (revenu Nova Solo), pas
-- une obligation de conserver les données business du sous-crit lui-même.

CREATE TABLE IF NOT EXISTS nova.billing_archive (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_user_id    UUID NOT NULL,
  email               TEXT,
  plan                TEXT,
  stripe_customer_id  TEXT,
  subscription_id     TEXT,
  account_created_at  TIMESTAMPTZ,
  purged_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE nova.billing_archive ENABLE ROW LEVEL SECURITY;
-- Intentionnellement AUCUNE policy : deny-all pour anon/authenticated,
-- seul le service_role (adminClient, Edge Functions) peut y accéder.
