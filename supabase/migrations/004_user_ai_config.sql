-- Nova Solo — Configuration du moteur IA par abonné (BYOK)
-- Project: lkulymxkcfiugjdawjnc
--
-- La clé du fournisseur de l'abonné est stockée CHIFFRÉE au repos (AES-GCM,
-- secret maître AI_CONFIG_ENC_KEY côté Edge Function). Exception assumée à la
-- règle « pas de secret en DB » (audit Hermès) : le secret est chiffré, écrit
-- en write-only, et JAMAIS renvoyé au navigateur (seul key_last4 sert l'affichage).
--
-- RLS activé SANS policy => deny par défaut pour authenticated/anon. Seules les
-- Edge Functions (service_role, qui bypass RLS) lisent/écrivent cette table.
-- Le chiffré ne transite donc jamais par un client.

CREATE TABLE IF NOT EXISTS user_ai_config (
  user_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mode           TEXT NOT NULL DEFAULT 'managed',  -- 'managed' | 'byok_remote' | 'byok_local'
  provider       TEXT,                             -- 'openai' (compatible) | 'anthropic'
  base_url       TEXT,                             -- endpoint compatible OpenAI / LLM local
  model          TEXT,                             -- slug du modèle choisi par l'abonné
  key_ciphertext TEXT,                             -- clé fournisseur chiffrée (AES-GCM, base64)
  key_iv         TEXT,                             -- IV base64 du chiffrement
  key_last4      TEXT,                             -- 4 derniers caractères (affichage seul)
  updated_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_ai_config ENABLE ROW LEVEL SECURITY;
-- Volontairement aucune policy : aucun accès client direct. service_role uniquement.

-- update_updated_at() est défini dans 001_init_schema.sql.
DROP TRIGGER IF EXISTS user_ai_config_updated_at ON user_ai_config;
CREATE TRIGGER user_ai_config_updated_at BEFORE UPDATE ON user_ai_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
