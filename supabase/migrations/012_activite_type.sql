-- Type d'activité : pilote les labels, unités de calcul et templates OPEX
-- pour rendre l'app agnostique aux métiers (artisanat / services / commerce).
-- Nullable : NULL = comportement historique (mode « prestation »).
ALTER TABLE nova.profiles
  ADD COLUMN IF NOT EXISTS activite_type TEXT;
-- valeurs attendues : 'prestation' | 'artisanat' | 'commerce' | NULL
