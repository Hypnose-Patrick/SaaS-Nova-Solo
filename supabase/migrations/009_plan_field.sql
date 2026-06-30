-- Ajout du champ plan pour distinguer Solo (CHF 9) et Pro (CHF 29)
ALTER TABLE nova.profiles
  ADD COLUMN IF NOT EXISTS plan TEXT;
