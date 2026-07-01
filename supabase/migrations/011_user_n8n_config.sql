-- Nova Solo — Configuration n8n par abonné (BYO webhooks)
-- Chaque abonné peut brancher SES propres webhooks n8n : un pour la recherche
-- d'entreprise (prospection), un pour l'envoi (mail/dossier). Les URLs ne sont
-- pas secrètes en soi, mais un jeton d'authentification optionnel (header
-- partagé) l'est → chiffré au repos (AES-GCM, secret AI_CONFIG_ENC_KEY réutilisé).
-- RLS deny total => service_role seul (Edge Functions) ; le secret n'est jamais
-- renvoyé au navigateur (seul *_secret_last4 pour l'affichage).

CREATE TABLE IF NOT EXISTS nova.user_n8n_config (
  user_id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  research_url               TEXT,         -- webhook n8n recherche d'entreprise
  research_secret_ciphertext TEXT,
  research_secret_iv         TEXT,
  research_secret_last4      TEXT,
  send_url                    TEXT,         -- webhook n8n envoi (dossier/mail)
  send_secret_ciphertext      TEXT,
  send_secret_iv              TEXT,
  send_secret_last4           TEXT,
  updated_at                  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE nova.user_n8n_config ENABLE ROW LEVEL SECURITY;
-- Volontairement aucune policy : aucun accès client direct. service_role uniquement.

GRANT SELECT, INSERT, UPDATE, DELETE ON nova.user_n8n_config TO anon, authenticated, service_role;

DROP TRIGGER IF EXISTS n8n_config_updated_at ON nova.user_n8n_config;
CREATE TRIGGER n8n_config_updated_at BEFORE UPDATE ON nova.user_n8n_config
  FOR EACH ROW EXECUTE FUNCTION nova.update_updated_at();
