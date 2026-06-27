-- Extensions requises (doit s'exécuter AVANT 001_init_schema.sql)
-- gen_random_uuid() provient de pgcrypto.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Note : on NE fait PAS `ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY`.
-- Le schéma `auth` appartient à supabase_auth_admin et est déjà protégé par Supabase.
-- Toute tentative de le modifier depuis une migration applicative échoue (permission denied).

-- Journal d'audit applicatif (optionnel, utilisé par les triggers métier si besoin)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  action TEXT NOT NULL,            -- INSERT, UPDATE, DELETE
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_audit_logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
