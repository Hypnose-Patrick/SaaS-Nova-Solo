-- Nova Solo — Schéma complet (Audit Hermes §6.2)
-- Supabase project: lkulymxkcfiugjdawjnc
-- 14 tables + RLS policies

-- === PROFIL UTILISATEUR ===
CREATE TABLE profiles (
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
CREATE TABLE bmc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  block_key TEXT NOT NULL,  -- 'segments', 'valeur', 'canaux', 'relations', 'revenus', 'ressources', 'activites', 'partenaires', 'couts'
  content TEXT,
  challenge TEXT,            -- Réponse IA challenge
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, block_key)
);

-- === BUSINESS PLAN ===
CREATE TABLE business_plans (
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
CREATE TABLE prospects (
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
CREATE TABLE events (
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
CREATE TABLE finance_data (
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
CREATE TABLE compta_entries (
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
CREATE TABLE documents (
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
CREATE TABLE rituals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  done BOOLEAN DEFAULT FALSE,
  done_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === CHECKLIST (LACI / démarrage) ===
CREATE TABLE checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  done BOOLEAN DEFAULT FALSE,
  category TEXT,  -- 'laci', 'creation', 'general'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === CHAT HISTORY ===
CREATE TABLE chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL,  -- 'user', 'assistant'
  content TEXT NOT NULL,
  agent TEXT DEFAULT 'nova',  -- 'nova', 'juriste', 'strategist', 'financier', 'communicant', 'commercial', 'technicien'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === DIAGNOSTIC ===
CREATE TABLE diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  step INTEGER,
  question TEXT,
  answer TEXT,
  result TEXT,  -- Réponse IA
  created_at TIMESTAMPTZ DEFAULT now()
);

-- === FACTURES ===
CREATE TABLE invoices (
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
CREATE TABLE messaging_settings (
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
CREATE TABLE symbolic_maps (
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

CREATE TRIGGER profiles_updated_at   BEFORE UPDATE ON profiles        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER bp_updated_at         BEFORE UPDATE ON business_plans  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER prospects_updated_at  BEFORE UPDATE ON prospects        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER symbolic_updated_at   BEFORE UPDATE ON symbolic_maps   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
