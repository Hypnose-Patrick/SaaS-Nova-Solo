# Migrations GELÉES — la base suisse est pilotée depuis SaaS-Nova-France

**Ne rien appliquer depuis ce dossier.** Depuis le 2026-07-31,
`start-mybusiness.com` est bâti et déployé par le dépôt
[`Hypnose-Patrick/SaaS-Nova-France`](https://github.com/Hypnose-Patrick/SaaS-Nova-France),
qui porte les migrations réellement appliquées sur le projet Supabase
`lkulymxkcfiugjdawjnc`.

Ce dossier reste en place pour l'historique : les migrations `000` à `018` ont
bien créé le schéma que la base porte aujourd'hui. Ce sont les **suivantes**
qui posent problème.

## Les numéros 019 et suivants sont déjà pris

Relevé sur la base le 2026-07-31, côté serveur :

| Numéro | Appliqué sur la base | Ce que ce dépôt appelle 019/020 |
|---|---|---|
| 019 | `game_progress` | `019_paid_invoices_tracking.sql` |
| 020 | `premium_engine` | `020_referral_paliers_ch.sql` |
| 021 → 031 | parrainage, connexions bancaires, tour d'accueil, quotas IA | — |

Les deux fichiers de droite **n'ont jamais été appliqués**, et ils ne le seront
pas : leurs numéros désignent désormais autre chose, et leur contenu entrerait
en collision avec le schéma en place.

- `019_paid_invoices_tracking.sql` — le suivi des factures payées est repris
  par la migration `022` du dépôt France.
- `020_referral_paliers_ch.sql` — paliers de parrainage en francs. Créait les
  mêmes cinq tables `referral_*` que les migrations `021` à `025` françaises,
  avec des colonnes différentes.

## ⚠️ Ils ne sont pas sur `master`

Ces deux fichiers vivent sur la branche **`fix/aide-link-vers-presentation`**,
jamais fusionnée (cinq commits d'avance sur `master` au 2026-07-31). Les
archiver ici aurait voulu dire les ajouter à un endroit où ils n'ont jamais
été.

**Si cette branche est fusionnée un jour**, retirer ces deux fichiers avant.
Le reste de son travail — essai gratuit de 14 jours, `ExportGate`,
`unlockShare`, paliers progressifs — a son équivalent dans le dépôt France ;
c'est à vérifier fichier par fichier avant de décider quoi en faire.

## Où regarder à la place

| Question | Réponse |
|---|---|
| Schéma appliqué sur `lkulymxkcfiugjdawjnc` | `SaaS-Nova-France/supabase/migrations/` |
| Ce qui diffère entre la France et la Suisse | `SaaS-Nova-France/frontend/src/lib/regime.ts` |
| Le récit complet de l'alignement | `SaaS-Nova-France/docs/ALIGNEMENT-SUISSE.md` |
