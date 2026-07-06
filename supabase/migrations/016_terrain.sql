-- Nova Solo — Compagnon terrain : mandats, captures, time_entries
--
-- Spec validée 2026-07-06. Trois tables métier-agnostiques :
--   - mandats       : entité générique de rattachement (le libellé UI vient du
--                     preset activite_type : « chantier » / « mandat » / « commande »)
--   - captures      : photo / note vocale / note texte ; mandat_id NULL = orpheline,
--                     triaged_at NULL = dans l'inbox « à trier »
--   - time_entries  : chrono (ended_at NULL = en cours ; un seul actif par profil)
--
-- Portée : schéma "nova" UNIQUEMENT. Idempotent (IF NOT EXISTS / DROP IF EXISTS).
-- Storage : réutilise le bucket privé nova-docs (policies de 002 inchangées),
-- convention {user_id}/captures/{timestamp}_{photo|audio}.{ext}.

-- ============================================================================
-- 1. mandats — le chaînon manquant entre prospects (acquisition) et invoices
-- ============================================================================
CREATE TABLE IF NOT EXISTS nova.mandats (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   UUID NOT NULL REFERENCES nova.profiles(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  client_name  TEXT,                -- texte libre, aligné sur invoices.client_name
  prospect_id  UUID REFERENCES nova.prospects(id) ON DELETE SET NULL,
  hourly_rate  NUMERIC,             -- repli sur le tarif du profil si NULL
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'invoiced')),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nova_mandats_profile_status_idx
  ON nova.mandats (profile_id, status);

-- ============================================================================
-- 2. captures — pattern inbox : rattachement ET tri indépendants, tous deux
--    nullables (on peut archiver sans rattacher, rattacher = trier d'office)
-- ============================================================================
CREATE TABLE IF NOT EXISTS nova.captures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES nova.profiles(id) ON DELETE CASCADE,
  mandat_id       UUID REFERENCES nova.mandats(id) ON DELETE SET NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('photo', 'voice', 'note')),  -- 'devis' réservé V2
  storage_path    TEXT,             -- nova-docs ; NULL pour une note texte
  transcript      TEXT,             -- transcription vocale (V1-5), éditable au tri
  note            TEXT,             -- légende / texte libre
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,  -- mime, durée audio, OCR…
  compta_entry_id UUID REFERENCES nova.compta_entries(id) ON DELETE SET NULL,
  triaged_at      TIMESTAMPTZ,      -- NULL = inbox « à trier »
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nova_captures_inbox_idx
  ON nova.captures (profile_id, triaged_at);
CREATE INDEX IF NOT EXISTS nova_captures_mandat_idx
  ON nova.captures (mandat_id)
  WHERE mandat_id IS NOT NULL;

-- ============================================================================
-- 3. time_entries — chrono ; duration_min (éditable au stop) est la source de
--    vérité pour la facturation, pas ended_at - started_at
-- ============================================================================
CREATE TABLE IF NOT EXISTS nova.time_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   UUID NOT NULL REFERENCES nova.profiles(id) ON DELETE CASCADE,
  mandat_id    UUID REFERENCES nova.mandats(id) ON DELETE SET NULL,
  started_at   TIMESTAMPTZ NOT NULL,
  ended_at     TIMESTAMPTZ,         -- NULL = chrono en cours
  duration_min INTEGER,             -- figée au stop, éditable (rattrapage)
  hourly_rate  NUMERIC,             -- snapshot du taux au démarrage
  note         TEXT,
  billed       BOOLEAN NOT NULL DEFAULT false,  -- FK invoice_id en V2
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Un seul chrono actif par profil : rend déterministe le rattachement auto des
-- captures (« le mandat en cours » = l'unique time_entry ouverte).
CREATE UNIQUE INDEX IF NOT EXISTS nova_one_running_timer
  ON nova.time_entries (profile_id)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS nova_time_entries_mandat_idx
  ON nova.time_entries (mandat_id)
  WHERE mandat_id IS NOT NULL;

-- ============================================================================
-- 4. RLS — pattern identique aux 14 tables filles existantes
-- ============================================================================
ALTER TABLE nova.mandats      ENABLE ROW LEVEL SECURITY;
ALTER TABLE nova.captures     ENABLE ROW LEVEL SECURITY;
ALTER TABLE nova.time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_mandats" ON nova.mandats;
CREATE POLICY "users_own_mandats" ON nova.mandats FOR ALL
  USING (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "users_own_captures" ON nova.captures;
CREATE POLICY "users_own_captures" ON nova.captures FOR ALL
  USING (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "users_own_time_entries" ON nova.time_entries;
CREATE POLICY "users_own_time_entries" ON nova.time_entries FOR ALL
  USING (profile_id IN (SELECT id FROM nova.profiles WHERE user_id = auth.uid()));

-- ============================================================================
-- 5. Triggers updated_at (réutilise nova.update_updated_at définie en 006)
-- ============================================================================
DROP TRIGGER IF EXISTS mandats_updated_at ON nova.mandats;
CREATE TRIGGER mandats_updated_at BEFORE UPDATE ON nova.mandats
  FOR EACH ROW EXECUTE FUNCTION nova.update_updated_at();
