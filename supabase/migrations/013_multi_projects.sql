-- Nova Solo — Multi-projets par palier
-- Découple "compte/abonnement" (1 par utilisateur) de "projet" (N par compte,
-- plafonné par nova.accounts.max_projects). Palier BYOK/Pro = 1, palier Trio = 3.
--
-- Portée : schéma "nova" UNIQUEMENT. Ne touche jamais public.* (La Trajectoire)
-- ni auth.users. Idempotent (IF NOT EXISTS / DROP IF EXISTS) pour rejouabilité.
--
-- IMPORTANT : additive only. Aucune colonne de nova.profiles n'est supprimée
-- dans cette migration (stripe_customer_id, subscription_status, subscription_id,
-- subscription_end, plan, is_admin restent en place, en lecture seule côté code
-- après bascule) — rollback = ne pas déployer le code qui lit nova.accounts.

-- ============================================================================
-- 1. Table accounts — 1 par utilisateur, porte l'abonnement/plan/quota
-- ============================================================================
CREATE TABLE IF NOT EXISTS nova.accounts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan                 TEXT DEFAULT 'solo',          -- 'solo' (BYOK, nom historique conservé) | 'pro' | 'trio'
  max_projects         INTEGER NOT NULL DEFAULT 1,
  stripe_customer_id   TEXT,
  subscription_status  TEXT DEFAULT 'inactive',
  subscription_id      TEXT,
  subscription_end     TIMESTAMPTZ,
  is_admin             BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nova_accounts_stripe_customer_idx
  ON nova.accounts (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- ============================================================================
-- 2. Backfill — 1 account par profil existant (tous les comptes restent à 1
--    projet ; c'est une opération de lecture, aucune donnée métier déplacée)
-- ============================================================================
INSERT INTO nova.accounts (user_id, plan, max_projects, stripe_customer_id,
                            subscription_status, subscription_id, subscription_end, is_admin)
SELECT p.user_id,
       COALESCE(p.plan, 'solo'),
       1,
       p.stripe_customer_id, p.subscription_status, p.subscription_id, p.subscription_end, p.is_admin
FROM nova.profiles p
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- 3. profiles devient "un projet" : ajoute account_id, retire l'UNIQUE(user_id)
-- ============================================================================
ALTER TABLE nova.profiles ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES nova.accounts(id) ON DELETE CASCADE;
ALTER TABLE nova.profiles ADD COLUMN IF NOT EXISTS project_name TEXT NOT NULL DEFAULT 'Mon activité';

UPDATE nova.profiles p SET account_id = a.id
FROM nova.accounts a
WHERE a.user_id = p.user_id AND p.account_id IS NULL;

ALTER TABLE nova.profiles ALTER COLUMN account_id SET NOT NULL;

-- Lève la contrainte 1:1 héritée de la migration 006 (nom de contrainte auto-généré
-- par Postgres pour `user_id UUID NOT NULL UNIQUE` = "profiles_user_id_key").
ALTER TABLE nova.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_key;

CREATE INDEX IF NOT EXISTS nova_profiles_account_idx ON nova.profiles (account_id);

-- ============================================================================
-- 4. RLS — accounts (nouvelle table)
-- ============================================================================
ALTER TABLE nova.accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_account" ON nova.accounts;
CREATE POLICY "users_own_account" ON nova.accounts FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- 5. RLS — profiles : accès par account plutôt que par user_id direct.
--    (nova.profiles.user_id reste une colonne dénormalisée, non contrainte —
--    conservée pour compat des 14 tables filles qui filtrent déjà via
--    "profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())" :
--    cette sous-requête continue de fonctionner sans aucune modification,
--    elle renverra simplement TOUS les profils (projets) de l'utilisateur.)
-- ============================================================================
DROP POLICY IF EXISTS "users_own_profiles" ON nova.profiles;
CREATE POLICY "users_own_profiles" ON nova.profiles FOR ALL
  USING (account_id IN (SELECT id FROM nova.accounts WHERE user_id = auth.uid()));

-- ============================================================================
-- 6. Garde-fou quota — trigger BEFORE INSERT (défense en profondeur : la RLS
--    autorise l'insert d'un propriétaire légitime, elle ne limite pas le NOMBRE
--    de projets ; le vrai contrôle métier est dans l'Edge Function create-project,
--    ce trigger empêche un contournement par appel direct à l'API Supabase).
-- ============================================================================
CREATE OR REPLACE FUNCTION nova.enforce_project_quota()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  allowed INTEGER;
BEGIN
  SELECT max_projects INTO allowed FROM nova.accounts WHERE id = NEW.account_id;
  SELECT COUNT(*) INTO current_count FROM nova.profiles WHERE account_id = NEW.account_id;
  IF allowed IS NULL THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: account_id % introuvable', NEW.account_id;
  END IF;
  IF current_count >= allowed THEN
    RAISE EXCEPTION 'PROJECT_LIMIT_REACHED: limite % projet(s) atteinte pour ce compte', allowed;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = nova, pg_temp;

DROP TRIGGER IF EXISTS profiles_quota_check ON nova.profiles;
CREATE TRIGGER profiles_quota_check
  BEFORE INSERT ON nova.profiles
  FOR EACH ROW EXECUTE FUNCTION nova.enforce_project_quota();

-- Trigger updated_at sur accounts (réutilise nova.update_updated_at définie en 006).
DROP TRIGGER IF EXISTS accounts_updated_at ON nova.accounts;
CREATE TRIGGER accounts_updated_at BEFORE UPDATE ON nova.accounts
  FOR EACH ROW EXECUTE FUNCTION nova.update_updated_at();
