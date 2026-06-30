-- Ajoute le flag admin sur les profils Nova
-- Un admin bypass le gate d'abonnement Stripe (subscription_status ignoré)
ALTER TABLE nova.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
