-- Nova Solo — Configuration Telegram par abonné (BYO bot)
-- Chaque abonné branche SON propre bot Telegram (@BotFather). Le token du bot
-- est un SECRET → chiffré au repos (AES-GCM, secret AI_CONFIG_ENC_KEY réutilisé).
-- chat_id non secret. RLS deny total => service_role seul (Edge Functions) ;
-- ni le token chiffré ni rien n'est lisible par un client. Le token n'est jamais
-- renvoyé au navigateur (seul bot_token_last4 pour l'affichage).

CREATE TABLE IF NOT EXISTS user_telegram_config (
  user_id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_token_ciphertext TEXT,         -- token du bot de l'abonné, chiffré (base64)
  bot_token_iv         TEXT,         -- IV base64
  bot_token_last4      TEXT,         -- 4 derniers caractères (affichage seul)
  chat_id              TEXT,         -- identifiant de chat (non secret)
  updated_at           TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_telegram_config ENABLE ROW LEVEL SECURITY;
-- Volontairement aucune policy : aucun accès client direct. service_role uniquement.

-- update_updated_at() défini dans 001_init_schema.sql.
DROP TRIGGER IF EXISTS user_telegram_config_updated_at ON user_telegram_config;
CREATE TRIGGER user_telegram_config_updated_at BEFORE UPDATE ON user_telegram_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
