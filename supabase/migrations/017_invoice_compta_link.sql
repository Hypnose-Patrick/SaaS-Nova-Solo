-- Nova Solo — Rattachement facture → écriture comptable
--
-- Décision produit 2026-07-08 (validée par Patrick) : le revenu d'une facture
-- n'est comptabilisé qu'à l'ENCAISSEMENT (statut "paid"), pas à l'envoi —
-- comptabilité de caisse, cohérente avec la comptabilité simplifiée des
-- indépendants/RI (CO art. 957 al. 2) et sans risque de double comptage dans
-- le compte d'exploitation (Compta.tsx somme revenus - dépenses par type).
--
-- invoice_id est UNIQUE (mais nullable) : une facture ne génère au plus
-- qu'une seule écriture automatique — la contrainte protège contre les
-- doublons même en cas de double-clic / re-déclenchement du statut "Payée"
-- côté client. Postgres autorise plusieurs NULL sur une colonne UNIQUE, donc
-- les écritures saisies manuellement (invoice_id NULL) ne sont pas affectées.
--
-- Portée : schéma "nova" uniquement. Idempotent.

ALTER TABLE nova.compta_entries
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES nova.invoices(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS nova_compta_entries_invoice_unique
  ON nova.compta_entries (invoice_id)
  WHERE invoice_id IS NOT NULL;
