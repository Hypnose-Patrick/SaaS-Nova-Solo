-- Nova Solo — Schéma DÉDIÉ « nova » (isolation totale dans le projet partagé)
-- Project: lkulymxkcfiugjdawjnc (DDC-DASHBOARD, partagé avec La Trajectoire)
--
-- POURQUOI : la table public.profiles appartient à La Trajectoire (colonnes role,
-- coach_id, fva_*, id NOT NULL sans défaut…). Nova Solo y était à l'étroit :
-- l'insertion d'un profil échouait (id obligatoire sans défaut) → profil jamais
-- chargé → toutes les pages bloquées sur « Chargement… ».
--
-- SOLUTION : Nova vit désormais dans son PROPRE schéma Postgres « nova ». Tables,
-- RLS et clés étrangères 100 % séparées de public.* (La Trajectoire). Aucune
-- fuite croisée possible. Le pool de comptes auth.users reste partagé (acceptable :
-- même personne, même login ; séparable plus tard via projet dédié).
--
-- Côté code : le client Supabase pointe sur le schéma « nova » (db.schema), donc
-- tous les .from("profiles" | "bmc" | …) visent automatiquement nova.*.

-- ============================================================================
-- 0. Schéma + droits
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS nova;

GRANT USAGE ON SCHEMA nova TO anon, authenticated, service_role;

-- RLS gouverne l'accès aux LIGNES ; les GRANT donnent l'accès aux TABLES.
ALTER DEFAULT PRIVILEGES IN SCHEMA nova
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;

-- Fonction updated_at locale au schéma nova.
CREATE OR REPLACE FUNCTION nova.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. PROFIL UTILISATEUR — id auto, user_id UNIQUE NOT NULL (corrige le bug)
-- ============================================================================
CREATE TABLE IF NOT EXISTS nova.profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT,
  email           TEXT,
  statut          TEXT,          -- 'laci', 'reconversion', 'creation', 'existant'
  domaine         TEXT,
  situation       TEXT,
  ville           TEXT,
  canton          TEXT,
  is_laci         BOOLEAN DEFAULT FALSE,
  capital         NUMERIC DEFAULT 0,
  charges_fixes   NUMERIC DEFAULT 0,
  runway_months   INTEGER,
  slogan          TEXT,
  logo_url        TEXT,
  accent_color    TEXT,
  brand_name      TEXT,
  tagline         TEXT,
  contact_email   TEXT,
  contact_tel     TEXT,
  contact_adresse TEXT,
  website         TEXT,
  dob             TEXT,
  bio             TEXT,
  profil          TEXT,           -- Résultat diagnostic IA
  pricing_tarif   NUMERIC,
  pricing_clients INTEGER,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 2. Tables filles (FK -> nova.profiles)
-- ============================================================================
CREATE TABLE IF NOT EXISTS nova.bmc (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES nova.profiles(id) ON DELETE CASCADE,
  block_key  TEXT NOT NULL,
  content    TEXT,
  challenge  TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, block_key)
);

CREATE TABLE IF NOT EXISTS nova.business_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID REFERENCES nova.profiles(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  content     TEXT,
  status      TEXT DEFAULT 'pending',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, section_key)
);

CREATE TABLE IF NOT EXISTS nova.prospects (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES nova.profiles(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  company    TEXT,
  email      TEXT,
  phone      TEXT,
  notes      TEXT,
  column_key TEXT DEFAULT 'nouveau',
  soncas     TEXT,
  est_value  NUMERIC DEFAULT 0,
  research   JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nova.events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES nova.profiles(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  date       DATE NOT NULL,
  time_start TEXT,
  time_end   TEXT,
  type       TEXT,
  location   TEXT,
  all_day    BOOLEAN DEFAULT FALSE,
  color      TEXT,
  gcal_id    TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nova.finance_data (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID REFERENCES nova.profiles(id) ON DELETE CASCADE,
  year              INTEGER NOT NULL,
  scenario          TEXT DEFAULT 'base',
  months            JSONB,
  capital_injection NUMERIC DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, year, scenario)
);

CREATE TABLE IF NOT EXISTS nova.compta_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID REFERENCES nova.profiles(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  description TEXT,
  amount      NUMERIC NOT NULL,
  type        TEXT NOT NULL,
  tva         NUMERIC,
  fournisseur TEXT,
  category    TEXT,
  receipt_url TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nova.documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id       UUID REFERENCES nova.profiles(id) ON DELETE CASCADE,
  filename         TEXT NOT NULL,
  storage_url      TEXT,
  storage_provider TEXT,
  file_type        TEXT,
  file_size        INTEGER,
  analysis         TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nova.rituals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES nova.profiles(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  done       BOOLEAN DEFAULT FALSE,
  done_date  DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nova.checklist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES nova.profiles(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  done       BOOLEAN DEFAULT FALSE,
  category   TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nova.chat_history (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES nova.profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  agent      TEXT DEFAULT 'nova',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nova.diagnostics (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES nova.profiles(id) ON DELETE CASCADE,
  step       INTEGER,
  question   TEXT,
  answer     TEXT,
  result     TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nova.invoices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   UUID REFERENCES nova.profiles(id) ON DELETE CASCADE,
  number       TEXT NOT NULL,
  client_name  TEXT,
  client_email TEXT,
  date         DATE NOT NULL,
  amount_ht    NUMERIC,
  tva_rate     NUMERIC DEFAULT 8.1,
  amount_ttc   NUMERIC,
  items        JSONB,
  status       TEXT DEFAULT 'draft',
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nova.messaging_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          UUID REFERENCES nova.profiles(id) ON DELETE CASCADE,
  telegram_chat_id    TEXT,
  whatsapp_phone      TEXT,
  bank_api_url        TEXT,
  bank_api_connected  BOOLEAN DEFAULT FALSE,
  ai_proxy_url        TEXT,
  ai_model            TEXT,
  ai_provider         TEXT,
  ai_base_url         TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nova.symbolic_maps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES nova.profiles(id) ON DELETE CASCADE,
  intake     JSONB,
  nodes      JSONB,
  links      JSONB,
  lecture    TEXT,
  questions  JSONB,
  actions    JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 3. Secrets par abonné (BYOK + Telegram BYO) — RLS deny, service_role seul
-- ============================================================================
CREATE TABLE IF NOT EXISTS nova.user_ai_config (
  user_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mode           TEXT NOT NULL DEFAULT 'managed',
  provider       TEXT,
  base_url       TEXT,
  model          TEXT,
  key_ciphertext TEXT,
  key_iv         TEXT,
  key_last4      TEXT,
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nova.user_telegram_config (
  user_id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_token_ciphertext TEXT,
  bot_token_iv         TEXT,
  bot_token_last4      TEXT,
  chat_id              TEXT,
  updated_at           TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 4. RLS — chaque utilisateur ne voit QUE ses données
-- ============================================================================
ALTER TABLE nova.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE nova.bmc                ENABLE ROW LEVEL SECURITY;
ALTER TABLE nova.business_plans     ENABLE ROW LEVEL SECURITY;
ALTER TABLE nova.prospects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE nova.events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE nova.finance_data       ENABLE ROW LEVEL SECURITY;
ALTER TABLE nova.compta_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE nova.documents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE nova.rituals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE nova.checklist          ENABLE ROW LEVEL SECURITY;
ALTER TABLE nova.chat_history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE nova.diagnostics        ENABLE ROW LEVEL SECURITY;
ALTER TABLE nova.invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE nova.messaging_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE nova.symbolic_maps      ENABLE ROW LEVEL SECURITY;
-- Secrets : RLS deny total (aucune policy) => service_role uniquement.
ALTER TABLE nova.user_ai_config       ENABLE ROW LEVEL SECURITY;
ALTER TABLE nova.user_telegram_config ENABLE ROW LEVEL SECURITY;

-- Profil : possède la ligne via user_id = auth.uid() (USING + WITH CHECK).
DROP POLICY IF EXISTS "own_profiles" ON nova.profiles;
CREATE POLICY "own_profiles" ON nova.profiles
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Tables filles : possède la ligne si le profile_id appartient à l'utilisateur.
DROP POLICY IF EXISTS "own_bmc"        ON nova.bmc;
DROP POLICY IF EXISTS "own_bp"         ON nova.business_plans;
DROP POLICY IF EXISTS "own_prospects"  ON nova.prospects;
DROP POLICY IF EXISTS "own_events"     ON nova.events;
DROP POLICY IF EXISTS "own_finance"    ON nova.finance_data;
DROP POLICY IF EXISTS "own_compta"     ON nova.compta_entries;
DROP POLICY IF EXISTS "own_documents"  ON nova.documents;
DROP POLICY IF EXISTS "own_rituals"    ON nova.rituals;
DROP POLICY IF EXISTS "own_checklist"  ON nova.checklist;
DROP POLICY IF EXISTS "own_chat"       ON nova.chat_history;
DROP POLICY IF EXISTS "own_diagnostics" ON nova.diagnostics;
DROP POLICY IF EXISTS "own_invoices"   ON nova.invoices;
DROP POLICY IF EXISTS "own_messaging"  ON nova.messaging_settings;
DROP POLICY IF EXISTS "own_symbolic"   ON nova.symbolic_maps;

CREATE POLICY "own_bmc"        ON nova.bmc              FOR ALL USING (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid())) WITH CHECK (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid()));
CREATE POLICY "own_bp"         ON nova.business_plans   FOR ALL USING (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid())) WITH CHECK (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid()));
CREATE POLICY "own_prospects"  ON nova.prospects        FOR ALL USING (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid())) WITH CHECK (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid()));
CREATE POLICY "own_events"     ON nova.events           FOR ALL USING (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid())) WITH CHECK (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid()));
CREATE POLICY "own_finance"    ON nova.finance_data     FOR ALL USING (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid())) WITH CHECK (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid()));
CREATE POLICY "own_compta"     ON nova.compta_entries   FOR ALL USING (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid())) WITH CHECK (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid()));
CREATE POLICY "own_documents"  ON nova.documents        FOR ALL USING (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid())) WITH CHECK (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid()));
CREATE POLICY "own_rituals"    ON nova.rituals          FOR ALL USING (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid())) WITH CHECK (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid()));
CREATE POLICY "own_checklist"  ON nova.checklist        FOR ALL USING (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid())) WITH CHECK (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid()));
CREATE POLICY "own_chat"       ON nova.chat_history     FOR ALL USING (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid())) WITH CHECK (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid()));
CREATE POLICY "own_diagnostics" ON nova.diagnostics     FOR ALL USING (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid())) WITH CHECK (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid()));
CREATE POLICY "own_invoices"   ON nova.invoices         FOR ALL USING (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid())) WITH CHECK (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid()));
CREATE POLICY "own_messaging"  ON nova.messaging_settings FOR ALL USING (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid())) WITH CHECK (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid()));
CREATE POLICY "own_symbolic"   ON nova.symbolic_maps    FOR ALL USING (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid())) WITH CHECK (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid()));

-- ============================================================================
-- 5. Triggers updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS profiles_updated_at  ON nova.profiles;
DROP TRIGGER IF EXISTS bp_updated_at        ON nova.business_plans;
DROP TRIGGER IF EXISTS prospects_updated_at ON nova.prospects;
DROP TRIGGER IF EXISTS symbolic_updated_at  ON nova.symbolic_maps;
DROP TRIGGER IF EXISTS ai_config_updated_at ON nova.user_ai_config;
DROP TRIGGER IF EXISTS tg_config_updated_at ON nova.user_telegram_config;

CREATE TRIGGER profiles_updated_at   BEFORE UPDATE ON nova.profiles             FOR EACH ROW EXECUTE FUNCTION nova.update_updated_at();
CREATE TRIGGER bp_updated_at         BEFORE UPDATE ON nova.business_plans       FOR EACH ROW EXECUTE FUNCTION nova.update_updated_at();
CREATE TRIGGER prospects_updated_at  BEFORE UPDATE ON nova.prospects            FOR EACH ROW EXECUTE FUNCTION nova.update_updated_at();
CREATE TRIGGER symbolic_updated_at   BEFORE UPDATE ON nova.symbolic_maps        FOR EACH ROW EXECUTE FUNCTION nova.update_updated_at();
CREATE TRIGGER ai_config_updated_at  BEFORE UPDATE ON nova.user_ai_config       FOR EACH ROW EXECUTE FUNCTION nova.update_updated_at();
CREATE TRIGGER tg_config_updated_at  BEFORE UPDATE ON nova.user_telegram_config FOR EACH ROW EXECUTE FUNCTION nova.update_updated_at();

-- Filet de sécurité : si des tables ont été créées avant les GRANT par défaut.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA nova TO anon, authenticated, service_role;
