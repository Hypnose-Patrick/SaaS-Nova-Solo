# SaaS Nova Solo — dépôt d'archive

> ## Le code de start-mybusiness.com n'est plus ici
>
> Depuis le **2026-07-31**, le site suisse est bâti et mis en ligne par
> [`Hypnose-Patrick/SaaS-Nova-France`](https://github.com/Hypnose-Patrick/SaaS-Nova-France),
> à partir du même code que nova-solo.fr. Ce qui diffère entre les deux pays
> passe par `frontend/src/lib/regime.ts`, `frontend/src/content/legal.ch.ts` et
> `frontend/statique-ch/` — dans ce dépôt-là.
>
> `frontend/`, `supabase/functions/` et `supabase/config.toml` ont été retirés
> ici le 2026-07-31. **Rien n'a été perdu** : la comparaison fichier par fichier
> est consignée dans `SaaS-Nova-France/docs/ALIGNEMENT-SUISSE.md`, tâche 9.
> L'historique git reste intact — `git log -- frontend/` fonctionne toujours.

## Ce qui reste, et pourquoi

| Ce qui reste | Pourquoi |
|---|---|
| `.github/workflows/purge-expired-accounts.yml` | **Le seul planificateur qui purge la base suisse.** Il appelle la fonction par HTTP, il ne dépend d'aucun code d'ici. À NE PAS supprimer tant que rien ne le remplace côté France. |
| `supabase/migrations/` | Les migrations `000` à `018` qui ont bâti la base. Identiques à celles du dépôt France. **Ne rien appliquer** — voir le `LISEZ-MOI.md` du dossier. |
| `docs/`, `DISCUSSION AVEC CLAUDE` | Documentation et notes de conception, sans équivalent ailleurs. |

## Ce qui a été retiré, et où le retrouver

| Retiré | Équivalent |
|---|---|
| `frontend/` | `SaaS-Nova-France/frontend/` |
| `supabase/functions/` | `SaaS-Nova-France/supabase/functions/` — les 18 fonctions Nova ont été redéployées depuis là le 2026-07-30 |
| `.github/workflows/build-deploy.yml` | `SaaS-Nova-France/.github/workflows/build-deploy-ch.yml` |
| `.github/workflows/test.yml` | `SaaS-Nova-France/.github/workflows/test.yml` |
| `clause responsabilité civile CGV.md` | `SaaS-Nova-France/docs/CLAUSE-RC-BROUILLON.md` — il n'était même pas commité ici |

Les deux workflows sont supprimés plutôt que désarmés : sans `frontend/`, ils
échoueraient à chaque exécution. **Le retour en arrière ne passe donc plus par
un clic** mais par l'historique : `git checkout 21ce9b8 -- frontend supabase`
restaure l'état d'avant le retrait.

## ⚠️ La branche `fix/aide-link-vers-presentation`

Cinq commits jamais fusionnés y dorment, plus les modifications non commitées
de l'arbre de travail local. **Tout a son équivalent dans le dépôt France** —
comparé fichier par fichier le 2026-07-31 :

- essai gratuit 14 jours et export verrouillé — `DocumentPreview.tsx` et
  `useSubscription.ts` sont identiques au caractère près ;
- `unlockShare` — même point de déclenchement, événements renommés pour
  correspondre au schéma appliqué ;
- vidéo héro de la page de présentation — **déjà en ligne** sur le site suisse ;
- parrainage 3 paliers CHF — remplacé par l'implémentation France, plus
  complète, déjà appliquée sur la base ;
- `chatKeys.ts` — identique, et câblé dans les quatre mêmes pages.

Ses migrations `019` et `020` ne doivent **jamais** être appliquées : ces
numéros désignent autre chose sur la base.
