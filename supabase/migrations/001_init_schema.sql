-- Nova Solo — Schéma complet (Audit Hermes §6.2)
-- Supabase project: lkulymxkcfiugjdawjnc
-- 15 tables + RLS policies
-- Idempotent : CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN IF NOT EXISTS

-- === PATCH tables existantes (colonnes manquantes) ===
-- Si profiles existe déjà avec un schéma différent (ex: DDC-DASHBOARD), on ajoute les colonnes Nova Solo.
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS statut TEXT;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS domaine TEXT;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS situation TEXT;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS ville TEXT;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS canton TEXT;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS is_laci BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS capital NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS charges_fixes NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS runway_months INTEGER;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS slogan TEXT;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS accent_color TEXT;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS brand_name TEXT;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS contact_tel TEXT;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS contact_adresse TEXT;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS dob TEXT;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS profil TEXT;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS pricing_tarif NUMERIC;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS pricing_clients INTEGER;
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS storage_url TEXT;
ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS storage_provider TEXT;
ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS file_size INTEGER;
ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS analysis TEXT;

ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS tva_rate NUMERIC DEFAULT 8.1;
ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS amount_ht NUMERIC;
ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS amount_ttc NUMERIC;
ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS items JSONB;
ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';

-- === PROFIL UTILISATEUR ===
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  statut TEXT,          -- 'laci', 'reconversion', 'creation', 'existant'
  domaine TEXT,
  situation TEXT,
  ville TEXT,
  canton TEXT,
  is_laci BOOLEAN DEFAULT FALSE,
  capital NUMERIC DEFAULT 0,
  charges_fixes NUMERIC DEFAULT 0,
  runway_months INTEGER,
  slogan TEXT,
  logo_url TEXT,
  accent_color TEXT,
  brand_name TEXT,
  tagline TEXT,
  contact_email TEXT,
  contact_tel TEXT,
  contact_adresse TEXT,
  website TEXT,
  dob TEXT,
  bio TEXT,
  profil TEXT,           -- Résultat diagnostic IA
  pricing_tarif NUMERIC,
  pricing_clients INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- === BUSINESS MODEL CANVAS ===
CREATE TABLE IF NOT EXISTS bmc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  block_key TEXT NOT NULL,  -- 'segments', 'valeur', 'canaux', 'relations', 'revenus', 'ressources', 'activites', 'partenaires', 'couts'
  content TEXT,
  challenge TEXT,            -- Réponse IA challenge
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, block_key)
);

-- === BUSINESS PLAN ===
CREATE TABLE IF NOT EXISTS business_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,  -- 'resume', 'marche', 'offre', 'acquisition', 'previsionnel'
  content TEXT,
  status TEXT DEFAULT 'pending',  -- 'pending', 'generating', 'done', 'error'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, section_key)
);

-- === PROSPECTION (Kanban) ===
CREATE TABLE IF NOT EXISTS prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  column_key TEXT DEFAULT 'nouveau',  -- 'nouveau', 'contacte', 'rdv', 'proposition', 'gagne', 'perdu'
  soncas TEXT,  -- 'sympathie', 'orgueil', 'nouveaute', 'confort', 'argent', 'securite'
  est_value NUMERIC DEFAULT 0,
  research JSONB,   -- {angle_de_vente, besoins_probables[], first_touch{}}
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- === AGENDA ===
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  time_start TEXT,
  time_end TEXT,
  type TEXT,  -- 'rdv', 'tache', 'formation', 'autre'
  location TEXT,
  all_day BOOLEAN DEFAULT FALSE,
  color TEXT,
  gcal_id TEXT,  -- ID Google Calendar pour synchro
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === FINANCES ===
CREATE TABLE IF NOT EXISTS finance_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  scenario TEXT DEFAULT 'base',  -- 'pessimiste', 'base', 'optimiste'
  months JSONB,  -- [{ca, charges, treso}] × 12
  capital_injection NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, year, scenario)
);

-- === COMPTABILITÉ ===
CREATE TABLE IF NOT EXISTS compta_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL,  -- 'revenu', 'depense'
  tva NUMERIC,  -- 8.1, 2.6, 0
  fournisseur TEXT,
  category TEXT,
  receipt_url TEXT,  -- URL Supabase Storage
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === DOCUMENTS ===
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_url TEXT,
  storage_provider TEXT,  -- 'supabase', 'gdrive', 'local'
  file_type TEXT,
  file_size INTEGER,
  analysis TEXT,  -- Réponse IA analyse
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === RITUELS ===
CREATE TABLE IF NOT EXISTS rituals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  done BOOLEAN DEFAULT FALSE,
  done_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === CHECKLIST (LACI / démarrage) ===
CREATE TABLE IF NOT EXISTS checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  done BOOLEAN DEFAULT FALSE,
  category TEXT,  -- 'laci', 'creation', 'general'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === CHAT HISTORY ===
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL,  -- 'user', 'assistant'
  content TEXT NOT NULL,
  agent TEXT DEFAULT 'nova',  -- 'nova', 'juriste', 'strategist', 'financier', 'communicant', 'commercial', 'technicien'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === DIAGNOSTIC ===
CREATE TABLE IF NOT EXISTS diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  step INTEGER,
  question TEXT,
  answer TEXT,
  result TEXT,  -- Réponse IA
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === FACTURES ===
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  client_name TEXT,
  client_email TEXT,
  date DATE NOT NULL,
  amount_ht NUMERIC,
  tva_rate NUMERIC DEFAULT 8.1,
  amount_ttc NUMERIC,
  items JSONB,  -- [{description, qty, unit_price}]
  status TEXT DEFAULT 'draft',  -- 'draft', 'sent', 'paid'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === MESSAGERIE (settings non-secrets) ===
-- Les tokens secrets (telegramToken, aiKey, etc.) NE sont pas stockés en DB.
-- Ils restent en sessionStorage côté client uniquement (décision sécurité audit Hermes).
CREATE TABLE IF NOT EXISTS messaging_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  telegram_chat_id TEXT,        -- Chat ID (pas le token — secret sessionStorage)
  whatsapp_phone TEXT,          -- Numéro (pas la clé — secret sessionStorage)
  bank_api_url TEXT,
  bank_api_connected BOOLEAN DEFAULT FALSE,
  ai_proxy_url TEXT,
  ai_model TEXT,
  ai_provider TEXT,
  ai_base_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === VISION SYMBOLIQUE ===
CREATE TABLE IF NOT EXISTS symbolic_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  intake JSONB,   -- {answers[], metaphore}
  nodes JSONB,    -- [{label, icon, kind, note}]
  links JSONB,    -- [{from, to, relation}]
  lecture TEXT,
  questions JSONB, -- string[]
  actions JSONB,   -- [{titre, echeance, mesure}]
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- === RLS — chaque utilisateur voit uniquement ses données ===
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bmc ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE compta_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rituals ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE symbolic_maps ENABLE ROW LEVEL SECURITY;

-- DROP IF EXISTS pour idempotence (re-exécution sûre)
DROP POLICY IF EXISTS "users_own_profiles"    ON profiles;
DROP POLICY IF EXISTS "users_own_bmc"         ON bmc;
DROP POLICY IF EXISTS "users_own_bp"          ON business_plans;
DROP POLICY IF EXISTS "users_own_prospects"   ON prospects;
DROP POLICY IF EXISTS "users_own_events"      ON events;
DROP POLICY IF EXISTS "users_own_finance"     ON finance_data;
DROP POLICY IF EXISTS "users_own_compta"      ON compta_entries;
DROP POLICY IF EXISTS "users_own_documents"   ON documents;
DROP POLICY IF EXISTS "users_own_rituals"     ON rituals;
DROP POLICY IF EXISTS "users_own_checklist"   ON checklist;
DROP POLICY IF EXISTS "users_own_chat"        ON chat_history;
DROP POLICY IF EXISTS "users_own_diagnostics" ON diagnostics;
DROP POLICY IF EXISTS "users_own_invoices"    ON invoices;
DROP POLICY IF EXISTS "users_own_messaging"   ON messaging_settings;
DROP POLICY IF EXISTS "users_own_symbolic"    ON symbolic_maps;

CREATE POLICY "users_own_profiles"       ON profiles         FOR ALL USING (user_id = auth.uid());
CREATE POLICY "users_own_bmc"            ON bmc              FOR ALL USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "users_own_bp"             ON business_plans   FOR ALL USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "users_own_prospects"      ON prospects        FOR ALL USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "users_own_events"         ON events           FOR ALL USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "users_own_finance"        ON finance_data     FOR ALL USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "users_own_compta"         ON compta_entries   FOR ALL USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "users_own_documents"      ON documents        FOR ALL USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "users_own_rituals"        ON rituals          FOR ALL USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "users_own_checklist"      ON checklist        FOR ALL USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "users_own_chat"           ON chat_history     FOR ALL USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "users_own_diagnostics"    ON diagnostics      FOR ALL USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "users_own_invoices"       ON invoices         FOR ALL USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "users_own_messaging"      ON messaging_settings FOR ALL USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "users_own_symbolic"       ON symbolic_maps    FOR ALL USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Trigger updated_at sur profiles
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at  ON profiles;
DROP TRIGGER IF EXISTS bp_updated_at        ON business_plans;
DROP TRIGGER IF EXISTS prospects_updated_at ON prospects;
DROP TRIGGER IF EXISTS symbolic_updated_at  ON symbolic_maps;

CREATE TRIGGER profiles_updated_at   BEFORE UPDATE ON profiles        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER bp_updated_at         BEFORE UPDATE ON business_plans  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER prospects_updated_at  BEFORE UPDATE ON prospects        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER symbolic_updated_at   BEFORE UPDATE ON symbolic_maps   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
