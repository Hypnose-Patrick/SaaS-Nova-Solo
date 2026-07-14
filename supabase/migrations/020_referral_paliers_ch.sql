-- 020_referral_paliers_ch.sql
-- Nova Solo Suisse — Parrainage, démarrage progressif en 3 paliers (CHF).
--
-- Transposition directe de la mécanique validée côté France
-- (SaaS-Nova-France/supabase/migrations/027_referral_paliers_progressifs.sql),
-- documentée dans Nova-Solo-CH_Synthese-Strategie.md §3. Contrairement à la
-- France, il n'y a ici AUCUN historique de parrainage à préserver (pas de
-- migration 021/022 CH) — le schéma va directement à sa forme finale à 3
-- paliers, pas d'évolution en plusieurs temps.
--
-- Paliers (filleuls actifs qualifiés = paid_invoices_count >= 2, cf.
-- migration 019_paid_invoices_tracking.sql) :
--   - >= 2 filleuls -> upgrade trio(39 CHF) en payant pro(29 CHF, "Solo" business).
--   - >= 5 filleuls -> REMPLACE le palier 1 : remise récurrente -10 CHF/mois.
--   - >= 7 filleuls -> cash 7 CHF/mois, uniquement le 7e filleul qualifié et
--     les suivants (pas de rétroactivité sur les 6 premiers), s'additionne
--     au palier 2. Cash = BOOKKEEPING SEUL à l'implémentation (_shared/referral.ts) —
--     aucun virement Stripe Connect réel, gated par REFERRAL_CASH_ENABLED.
--
-- Rappel plans (nova.accounts.plan) : 'solo' = BYOK (9 CHF, nom historique
-- conservé, EXCLU du parrainage — ne parraine pas, ne qualifie pas) ;
-- 'pro' = Solo commercial (29 CHF, éligible) ; 'trio' = 39 CHF (éligible,
-- aussi cible de l'upgrade récompense). Voir Nova-Solo-CH_Synthese-Strategie.md §2
-- pour le piège de nommage business vs clé DB.
--
-- Portée : schéma "nova" uniquement. Additive only + idempotent (IF NOT
-- EXISTS / DROP ... IF EXISTS / garde DO) => rejouable sans risque.
-- nova.processed_stripe_events existe déjà (migration 019) — réutilisée ici
-- pour l'idempotence webhook, pas recréée.

-- ============================================================================
-- 0. Types énumérés (gardes idempotentes)
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'nova' AND t.typname = 'referral_status') THEN
    CREATE TYPE nova.referral_status AS ENUM
      ('trial', 'month1_paid', 'qualified', 'churned', 'on_byok');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'nova' AND t.typname = 'referral_reward_type') THEN
    CREATE TYPE nova.referral_reward_type AS ENUM
      ('plan_upgrade', 'invoice_discount', 'cash_commission');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'nova' AND t.typname = 'referral_milestone') THEN
    CREATE TYPE nova.referral_milestone AS ENUM
      ('two_referrals', 'five_referrals', 'seven_referrals_cash');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'nova' AND t.typname = 'referral_grant_status') THEN
    CREATE TYPE nova.referral_grant_status AS ENUM
      ('active', 'expired', 'revoked');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'nova' AND t.typname = 'share_unlock_trigger') THEN
    -- Signaux CH (Pipeline + Factures), différents de la France (prospects/devis).
    CREATE TYPE nova.share_unlock_trigger AS ENUM
      ('first_client_added', 'first_invoice_sent');
  END IF;
END $$;

-- ============================================================================
-- 1. referral_codes — un code par compte.
-- ============================================================================
CREATE TABLE IF NOT EXISTS nova.referral_codes (
  account_id UUID NOT NULL UNIQUE REFERENCES nova.accounts(id) ON DELETE CASCADE,
  code       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 2. referrals — une ligne par filleul (relation verrouillée à l'inscription).
-- ============================================================================
CREATE TABLE IF NOT EXISTS nova.referrals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_account_id UUID NOT NULL REFERENCES nova.accounts(id) ON DELETE CASCADE,
  referee_account_id  UUID NOT NULL UNIQUE REFERENCES nova.accounts(id) ON DELETE CASCADE,
  code_used           TEXT NOT NULL,
  status              nova.referral_status NOT NULL DEFAULT 'trial',
  qualified_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT referrals_no_self CHECK (referee_account_id <> referrer_account_id)
);

CREATE INDEX IF NOT EXISTS nova_referrals_referrer_idx ON nova.referrals (referrer_account_id);
CREATE INDEX IF NOT EXISTS nova_referrals_status_idx   ON nova.referrals (status);

-- ============================================================================
-- 3. referral_reward_grants — une ligne par récompense accordée au parrain.
--    referee_account_id sert au palier cash (grant PAR FILLEUL, pas par
--    parrain) — NULL pour les grants upgrade/discount (par parrain).
-- ============================================================================
CREATE TABLE IF NOT EXISTS nova.referral_reward_grants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_account_id UUID NOT NULL REFERENCES nova.accounts(id) ON DELETE CASCADE,
  referee_account_id  UUID REFERENCES nova.accounts(id) ON DELETE CASCADE,
  type                nova.referral_reward_type NOT NULL,
  milestone           nova.referral_milestone   NOT NULL,
  status              nova.referral_grant_status NOT NULL DEFAULT 'active',
  stripe_coupon_id    TEXT,
  starts_at           TIMESTAMPTZ DEFAULT now(),
  ends_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nova_reward_grants_referrer_idx
  ON nova.referral_reward_grants (referrer_account_id);

-- Un seul grant actif par (parrain, type) pour upgrade/discount (paliers 1/2,
-- mutuellement exclusifs par construction dans _shared/referral.ts).
CREATE UNIQUE INDEX IF NOT EXISTS nova_reward_grants_active_single_uidx
  ON nova.referral_reward_grants (referrer_account_id, type)
  WHERE status = 'active' AND type IN ('plan_upgrade', 'invoice_discount');

-- Plusieurs grants cash actifs possibles par parrain, mais un seul par
-- (parrain, filleul) — le cash est par filleul (palier 3).
CREATE UNIQUE INDEX IF NOT EXISTS nova_reward_grants_active_cash_uidx
  ON nova.referral_reward_grants (referrer_account_id, referee_account_id)
  WHERE status = 'active' AND type = 'cash_commission';

-- ============================================================================
-- 4. referral_share_unlocks — révélation du bouton de partage après pic
--    émotionnel (1er client ajouté au Pipeline / 1ère facture envoyée).
-- ============================================================================
CREATE TABLE IF NOT EXISTS nova.referral_share_unlocks (
  account_id  UUID NOT NULL UNIQUE REFERENCES nova.accounts(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  trigger     nova.share_unlock_trigger NOT NULL
);

-- ============================================================================
-- 5. referral_events — audit log (mêmes besoins qu'en France : traçabilité
--    des grants/reverts/claims, y compris le bookkeeping cash "no transfer").
-- ============================================================================
CREATE TABLE IF NOT EXISTS nova.referral_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                TEXT NOT NULL,
  account_id          UUID REFERENCES nova.accounts(id) ON DELETE SET NULL,
  referrer_account_id UUID REFERENCES nova.accounts(id) ON DELETE SET NULL,
  referee_account_id  UUID REFERENCES nova.accounts(id) ON DELETE SET NULL,
  meta                JSONB,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nova_referral_events_referrer_idx
  ON nova.referral_events (referrer_account_id);

-- ============================================================================
-- 6. RLS — SELECT au propriétaire (parrain), écritures service_role only
--    (RLS activée sans policy INSERT/UPDATE/DELETE = deny pour authenticated ;
--    service_role bypass RLS).
-- ============================================================================
ALTER TABLE nova.referral_codes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE nova.referrals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE nova.referral_reward_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE nova.referral_share_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE nova.referral_events        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_referral_code" ON nova.referral_codes;
DROP POLICY IF EXISTS "own_referrals"     ON nova.referrals;
DROP POLICY IF EXISTS "own_reward_grants" ON nova.referral_reward_grants;
DROP POLICY IF EXISTS "own_share_unlock"  ON nova.referral_share_unlocks;

CREATE POLICY "own_referral_code" ON nova.referral_codes
  FOR SELECT USING (account_id IN (SELECT id FROM nova.accounts WHERE user_id = auth.uid()));

CREATE POLICY "own_referrals" ON nova.referrals
  FOR SELECT USING (referrer_account_id IN (SELECT id FROM nova.accounts WHERE user_id = auth.uid()));

CREATE POLICY "own_reward_grants" ON nova.referral_reward_grants
  FOR SELECT USING (referrer_account_id IN (SELECT id FROM nova.accounts WHERE user_id = auth.uid()));

CREATE POLICY "own_share_unlock" ON nova.referral_share_unlocks
  FOR SELECT USING (account_id IN (SELECT id FROM nova.accounts WHERE user_id = auth.uid()));

-- referral_events : aucune policy => deny total => service_role only (audit interne).

GRANT SELECT, INSERT, UPDATE, DELETE ON
  nova.referral_codes,
  nova.referrals,
  nova.referral_reward_grants,
  nova.referral_share_unlocks,
  nova.referral_events
TO anon, authenticated, service_role;

-- ============================================================================
-- 7. referral_desired_rewards(p_referrer) — état désiré (pur, sans effet de
--    bord). Seuils 2/5/7 directement (pas de forme intermédiaire à migrer).
-- ============================================================================
CREATE OR REPLACE FUNCTION nova.referral_desired_rewards(p_referrer UUID)
RETURNS TABLE (
  parrain_eligible        BOOLEAN,
  n_actifs                INTEGER,
  want_upgrade            BOOLEAN,
  want_discount5          BOOLEAN,
  cash_eligible_referees  UUID[]
) AS $$
WITH parrain AS (
  SELECT a.id, a.plan, a.subscription_status, a.paid_invoices_count,
         (a.plan IN ('pro', 'trio') AND a.subscription_status IN ('active', 'trialing')) AS eligible
  FROM nova.accounts a
  WHERE a.id = p_referrer
),
actifs_ranked AS (
  SELECT r.referee_account_id,
         row_number() OVER (ORDER BY r.qualified_at ASC) AS rang
  FROM nova.referrals r
  JOIN nova.accounts ra ON ra.id = r.referee_account_id
  WHERE r.referrer_account_id = p_referrer
    AND r.status = 'qualified'
    AND ra.paid_invoices_count >= 2
    AND ra.plan <> 'solo'  -- un filleul repassé en BYOK ne compte plus (cf. status 'on_byok')
),
cash_eligibles AS (
  SELECT array_agg(referee_account_id ORDER BY rang) AS ids
  FROM actifs_ranked
  WHERE rang >= 7
)
SELECT
  -- Le parrain lui-même doit être sur un plan payant éligible (pas BYOK) et
  -- avoir un abonnement actif — un compte 'solo' (BYOK) ne peut pas parrainer.
  parrain.eligible                                                                   AS parrain_eligible,
  (SELECT count(*)::INTEGER FROM actifs_ranked)                                       AS n_actifs,
  (parrain.eligible AND (SELECT count(*) FROM actifs_ranked) BETWEEN 2 AND 4)         AS want_upgrade,
  (parrain.eligible AND (SELECT count(*) FROM actifs_ranked) >= 5)                    AS want_discount5,
  CASE WHEN parrain.eligible
       THEN COALESCE((SELECT ids FROM cash_eligibles), ARRAY[]::UUID[])
       ELSE ARRAY[]::UUID[]
  END                                                                                 AS cash_eligible_referees
FROM parrain;
$$ LANGUAGE sql STABLE;
