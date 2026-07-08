-- Nova Solo — Préférence de thème (clair / sombre / système)
--
-- Ajoute le choix de thème visuel de l'utilisateur, sur le même modèle que
-- accent_color (006_nova_schema.sql) : une valeur par profil/projet, lue et
-- appliquée en direct côté client via document.documentElement[data-theme].
--
-- Défaut 'dark' : préserve le rendu actuel pour tous les profils existants
-- (le thème sombre est l'unique thème depuis le lancement) — aucun flash ni
-- changement visuel au moment du déploiement de cette migration.
--
-- Portée : schéma "nova" uniquement. Idempotent.

ALTER TABLE nova.profiles
  ADD COLUMN IF NOT EXISTS theme_preference TEXT NOT NULL DEFAULT 'dark'
  CHECK (theme_preference IN ('dark', 'light', 'system'));
