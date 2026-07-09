# Business Model Canvas — Nova Solo

> Dernière révision : 2026-07-09. Ce document couvre **uniquement Nova Solo** (SaaS-Nova-Solo, start-mybusiness.com). La Trajectoire / SeedJobs est un produit distinct avec sa propre gouvernance — ne pas mélanger les deux BMC.
>
> Priorité fondatrice : **70%+ du temps de Patrick alloué à Nova Solo**, le reste réparti sur les autres mandats (La Trajectoire, coaching personnel, etc.).

---

## 1. Segments clients

- **Segment 1 — Indépendant·e romand·e, tous métiers (priorité haute, cœur de cible)**
  Consultant, coach, artisan, commerçant solo — 30-55 ans, pilote seul son activité. Le pivot `activite_type` (migration `012_activite_type.sql`, 2026-07-02) a élargi le produit au-delà du coaching : labels, calculs, OPEX et contrats (art. 363 CO entreprise vs art. 394 mandat) s'adaptent au métier. Conversion cible : abonnement CHF 29-39/mois.

- **Segment 2 — Solopreneur multi-activités/multi-clients**
  Persona du plan **Trio** (CHF 39/mois) : un seul utilisateur qui gère jusqu'à 3 projets distincts (plusieurs activités, ou plusieurs clients pour un coach). *Ce n'est pas un plan équipe/PME* — l'app n'a aucune fonctionnalité multi-utilisateur.

- **Early adopters transversaux (priorité haute court terme)**
  Consultants, coachs, formateurs déjà actifs sur LinkedIn Romandie, habitués aux outils SaaS, prescripteurs naturels. Acquisition zéro coût (bouche-à-oreille, groupes professionnels). Objectif : 10-20 early adopters actifs → témoignages → crédibilité pour convertir le Segment 1.

**Hors scope Nova Solo** (appartiennent à La Trajectoire/SeedJobs) : demandeurs d'emploi en reconversion suivis ORP, structures d'accompagnement institutionnelles (ORP/SEMO), contrats-cadres B2B avec fondations cantonales.

---

## 2. Proposition de valeur

**Structure de plans réelle (landing.html, section pricing) :**

| Plan | Prix | Contenu |
|---|---|---|
| **Solo** | CHF 29/mois | 7 modules complets, Assistant Nova illimité, Cabinet Hermes (6 experts IA), mode managé (clé API gérée par Nova Solo) |
| **Trio** | CHF 39/mois | Tout Solo + jusqu'à 3 projets/clients séparés, sélecteur de projet en 1 clic |
| **BYOK — Licence** | CHF 9/mois (ou CHF 108/an) | Tout Solo + l'utilisateur connecte sa propre clé API IA + sauvegarde Google Drive personnelle optionnelle |

Le plan BYOK n'est **pas** une version entrée de gamme limitée — c'est l'inverse : mêmes fonctionnalités que Solo, coût réduit pour Nova Solo car l'utilisateur paie sa propre facture IA. C'est un levier de marge pour les power users, pas un produit d'appel.

**Différenciateur réel** : suite de gestion complète (Compta, Factures, Agenda, Finances, Pipeline, Contrats) + copilote IA contextualisé (Assistant Nova + Cabinet Hermes 6 experts) + conformité juridique suisse romande (contrats art. 363/394 CO selon métier, nLPD) — combinaison absente des concurrents génériques (Notion, Indy, etc.) qui n'ont ni l'IA contextualisée CH ni les contrats juridiques suisses adaptés au métier.

---

## 3. Canaux

| Phase | Canal | Coût |
|---|---|---|
| Découverte | LinkedIn organique, SEO longue traîne, bouche-à-oreille | CHF 0 |
| Évaluation | Site landing (start-mybusiness.com), essai gratuit 14 jours | CHF 0 |
| Achat | Onboarding self-service via Stripe Checkout | Frais Stripe (~2.9% + CHF 0.30) |
| Livraison | App web (SPA React) | Hébergement Hostinger |
| Après-vente | Email (Resend), support direct Patrick | CHF 0 en phase early |

Priorités : prospection directe indépendants/coachs romands (priorité 1) → SEO/contenu (priorité 2) → LinkedIn organique (priorité 3) → bouche-à-oreille/early users (priorité 4).

---

## 4. Relations clients

- **Essai gratuit 14 jours** — pas de freemium permanent. Email de bienvenue + check-in J+12 (automatisable via Supabase + Resend, déjà en place pour l'auth).
- **Abonnés actifs** — contact proactif mensuel léger (1 message de valeur + micro-sondage CSAT), cible CSAT ≥ 4/5.
- **Abonnés inactifs (0 connexion 14 jours)** — email de réactivation automatique, puis proposition d'appel 20 min si pas de réponse.
- **Communauté Slack/Discord** — *dépriorisé* tant que la base d'abonnés payants est < 20-30 : coût d'animation sans ROI avant masse critique.
- **NPS trimestriel** — outil gratuit (Tally/Google Forms), seuil d'alerte NPS < 30.

---

## 5. Ressources clés

- **Stack technique** : React + TypeScript + Vite, Supabase (schéma `nova`, EU Frankfurt), Stripe (edge functions `stripe-checkout` + `stripe-webhook`), hébergement **Hostinger** (Vercel retiré du CI le 2026-06-30). Auth Supabase + Google OAuth.
- **IA managée (Assistant Nova + Cabinet Hermes 6 experts)** — coût variable proportionnel à l'usage réel des abonnés via l'edge function `ai-proxy` (Claude API). **Ne pas modéliser comme un forfait fixe CHF 0-30/mois** : à mesurer par abonné actif dès les premiers utilisateurs payants. Le plan BYOK (CHF 9/mois) existe précisément pour transférer ce risque aux power users.
- **Temps fondateur** : 40-50h/semaine disponibles (statut LACI post-SAI), ≥ 70% alloué à Nova Solo (voir bloc 7).
- **Compétences techniques** : React, TypeScript, architecture SaaS, Supabase/Postgres, edge functions Deno — sans coût de recrutement.
- **Réseau et crédibilité** : communautés indépendants/coachs romands, communautés open-source React (crédibilité technique, pas canal d'acquisition direct).
- **Capital disponible** : zéro budget marketing payant — dépendance totale aux canaux organiques jusqu'aux premiers revenus récurrents.

---

## 6. Activités clés

Répartition pour garantir ≥ 70% du temps dev/business sur Nova Solo (à désagréger explicitement de La Trajectoire/autres mandats) :

| Activité | Temps cible | Produit |
|---|---|---|
| Développement produit Nova Solo | ~28-35h/mois | Nova Solo |
| Maintenance & support Nova Solo | ~8h/mois | Nova Solo |
| Prospection & démos Nova Solo | ~8h/mois | Nova Solo |
| Contenu SEO/LinkedIn Nova Solo | ~8h/mois | Nova Solo |
| **Sous-total Nova Solo** | **~52-59h/mois (≈ 70-75% d'un mois à 40-50h/sem)** | |
| La Trajectoire / autres mandats | ≤ 25-30% du temps restant | Autre |
| Coaching/onboarding clients Nova Solo | ~4h/mois | Nova Solo |
| Gestion administrative SAI/LACI | ~4h/mois | Personnel |

Indicateur de suivi : ratio heures Nova Solo / heures totales, calculé mensuellement — doit rester ≥ 70%.

---

## 7. Partenaires clés

- **Communautés open-source React** — retours produit, crédibilité technique. 1 issue/RFC par mois.
- **Formateurs et coachs indépendants romands** — co-création de cas d'usage, early adopters (recoupe directement le Segment 1). 5 profils LinkedIn ciblés/mois.
- **Hostinger, Supabase, Stripe** — infrastructure à coût zéro/faible en phase early.
- **Anthropic (Claude API)** — fournisseur clé : l'IA managée est cœur de produit (Assistant Nova, Cabinet Hermes), leur pricing conditionne directement la structure de coûts (bloc 9).
- **Affiliés consultants indépendants** — relais de vente sans budget publicitaire, à formaliser (accord simple par email).

**Hors scope Nova Solo** : ORP/SEMO Valais, incubateurs VS (Platinn, The Ark) — pertinents pour La Trajectoire/SeedJobs (accès institutionnel), pas pour Nova Solo qui est un produit B2C self-service.

---

## 8. Structure de coûts

```
COÛTS FIXES mensuels :
| Poste                            | Montant CHF estimé |
|------------------------------------|---------------------|
| Hébergement Hostinger              | 15-40               |
| Domaine (start-mybusiness.com)     | ~5-10                |
| Total fixe hors IA et transaction  | ~20-50               |

COÛTS VARIABLES :
| Poste                              | Driver                                    |
|--------------------------------------|---------------------------------------------|
| Claude API (Assistant Nova + Cabinet Hermes, plans Solo/Trio managés) | proportionnel à l'usage/abonné — coût dominant, à mesurer dès les 1ers abonnés payants |
| Frais Stripe                        | ~2.9% + CHF 0.30 par transaction            |

SEUIL DE RENTABILITÉ : ne peut pas être calculé de façon fiable tant que le coût IA/abonné actif n'est pas mesuré. Le plan BYOK (CHF 9/mois) existe pour plafonner ce risque sur les power users à forte consommation IA.
```

---

## 9. Sources de revenus

- **Solo** — CHF 29/mois, mode managé, 7 modules + IA illimitée.
- **Trio** — CHF 39/mois, jusqu'à 3 projets/clients, mode managé.
- **BYOK — Licence** — CHF 9/mois ou CHF 108/an, clé API personnelle, marge protégée pour Nova Solo.
- **Essai gratuit** — 14 jours, pas de plan gratuit permanent (pas de "freemium" au sens strict).
- **Onboarding/paramétrage payant** — pas de fonctionnalité de paiement one-shot dans le flow Stripe actuel (abonnements récurrents uniquement). Idée future, pas source de revenu actuelle.

**Indicateurs à suivre dès J1** : MRR (CHF), taux de churn mensuel, coût IA moyen par abonné actif (nouveau — absent du BMC initial), CAC organique, mix Solo/Trio/BYOK dans le MRR total.

Seuil MRR CHF 5'000 ≈ 172 abonnés Solo reste une bonne cible mathématique de référence, à ajuster une fois le mix de plans et le coût IA réel connus.

---

## Historique des révisions

- **2026-07-09** — Version initiale, corrigée à partir d'un BMC généré automatiquement qui mélangeait Nova Solo avec La Trajectoire/SeedJobs et sous-estimait le coût variable de l'IA managée. Vérifié contre le code de production (landing.html, README.md, migrations Supabase) plutôt que contre des hypothèses.

# Analyse Business Model Canvas — Nova Solo
**Patrick Beiner · Monthey VS · Cabinet Hermès**

---

## Cohérence globale : **6.5 / 10**

Le canvas est intellectuellement solide et techniquement bien construit. Le score est bridé par trois réalités concrètes : l'absence totale de budget acquisition dans un marché non encore éduqué, l'inconnue coût IA qui rend le modèle économique non calculable à ce stade, et une dépendance critique à un seul fondateur sans filet.

---

## 3 Forces

### 1. Différenciation réelle et défendable
La combinaison **gestion SaaS + IA contextualisée Suisse romande + contrats juridiques adaptés au métier** (art. 363/394 CO) n'existe pas chez les concurrents génériques. Ce n'est pas un positionnement marketing — c'est une barrière technique concrète. Notion n'a pas les contrats suisses. Indy n'a pas le Cabinet Hermes. Cette spécificité justifie le CHF 29/mois sans friction tarifaire excessive pour un indépendant romand.

### 2. Structure de coûts fixes remarquablement basse
CHF 20–50/mois de coûts fixes cash (hors IA variable) pour un SaaS fonctionnel est un avantage structurel réel. Le seuil de rentabilité sur les seuls coûts fixes est de **3 à 5 abonnés** — accessible dès les premières semaines post-lancement. Cela donne une marge de manœuvre temporelle précieuse dans le contexte LACI.

### 3. Plan BYOK comme levier de marge intelligent
Le plan BYOK à CHF 9/mois est bien conçu : il ne cannibalise pas le plan Solo (mêmes fonctionnalités, pas une version dégradée) et transfère le risque coût IA vers les power users. C'est une décision architecturale saine qui protège la marge sur le segment le plus consommateur.

---

## 3 Risques majeurs

### 1. 🔴 Coût IA inconnu = modèle économique non calculable
**C'est le risque n°1, non négociable à lever en priorité.**

Le coût Claude API par abonné actif n'est pas mesuré. Si un abonné Solo à CHF 29/mois génère CHF 18–22 de coût IA (scénario usage intensif Assistant Nova + 6 experts Cabinet Hermes), la marge nette tombe à **CHF 5–9/abonné** — soit un MRR réel de CHF 860–1'550 pour 172 abonnés au lieu des CHF 5'000 espérés. Le plan Solo devient non viable à grande échelle sans un plafond d'usage ou une mesure réelle.

*Chiffre de référence à obtenir : coût moyen Claude API par session de 30 min d'usage intensif (tokens input + output estimés).*

### 2. 🔴 Acquisition organique seule = croissance lente et non prévisible
Zéro budget publicitaire est une contrainte réelle, pas un choix stratégique optimal. Le SEO longue traîne produit des résultats en **4–9 mois** minimum. LinkedIn organique en Romandie sans réseau préexistant dense génère typiquement **1–3 leads/mois** les premiers mois. Avec un taux de conversion essai → payant de 20–30% (hypothèse raisonnable), cela donne **0–1 nouveau client/mois** — insuffisant pour atteindre 172 abonnés avant épuisement de la période LACI/SAI.

*Le risque n'est pas l'absence de budget : c'est l'absence d'un canal d'acquisition à effet levier identifié et testé.*

### 3. 🟠 Dépendance totale fondateur + incertitude SAI
Patrick est seul : développement, support, prospection, contenu, administration SAI/LACI. Une indisponibilité de 2–3 semaines (procédure SAI, problème de santé, surcharge) arrête tout. Par ailleurs, le statut SAI art. 70 LAI conditionne potentiellement les ressources disponibles — si la SAI est refusée ou retardée, le temps disponible et les revenus autorisés changent. Ce risque de dépendance personnelle n'est pas adressé dans le canvas.

---

## 2 Recommandations prioritaires

### Recommandation 1 : Mesurer le coût IA réel avant toute acquisition — délai 30 jours

**Action concrète :**
Créer un tableau de bord minimal (même un Google Sheet) qui loge, pour chaque session utilisateur test :
- Nombre de tokens input/output par interaction Assistant Nova et par expert Cabinet Hermes
- Coût Claude API correspondant (tarif Anthropic actuel : vérifier sur console.anthropic.com)
- Durée de session et nombre d'interactions

**Objectif :** obtenir une fourchette coût IA réaliste sur 3 profils d'usage : léger (1–2 interactions/semaine), moyen (5–10), intensif (20+).

**Décision à prendre selon le résultat :**
- Coût IA < CHF 5/abonné/mois → modèle Solo viable, pas de changement
- Coût IA CHF 5–12/abonné/mois → introduire un quota d'interactions dans le plan Solo (ex. 50 requêtes/mois), usage illimité réservé au plan Trio
- Coût IA > CHF 12/abonné/mois → revoir la tarification Solo à la hausse ou repositionner BYOK comme plan principal

Sans cette mesure, toute projection MRR est un château de sable.

---

### Recommandation 2 : Identifier et activer 5 partenaires-prescripteurs en 60 jours — canal d'acquisition à effet levier

**Contexte :** sans budget publicitaire, la croissance organique seule est trop lente. Le levier disponible est le **réseau humain ciblé** : un prescripteur actif vaut 10–20 leads qualifiés sans coût.

**Action concrète — protocole en 4 étapes :**

1. **Identifier 5 profils** parmi : formateurs indépendants actifs sur LinkedIn Romandie, coachs certifiés avec audience (newsletter, groupe Facebook/LinkedIn), comptables ou fiduciaires qui conseillent des indépendants, associations professionnelles VS/VD/GE (FER, Chambre vaudoise des arts et métiers, etc.)

2. **Approche directe** (pas de cold email générique) : message LinkedIn personnalisé en 3 lignes — problème qu'ils connaissent chez leurs clients, solution Nova Solo, proposition d'un accès gratuit 3 mois en échange de 2–3 retours et d'une mention à leur réseau si satisfaits

3. **Formaliser l'accord affilié** mentionné dans le canvas : accord email simple, commission CHF 5/mois par abonné actif référé (récurrent, pas one-shot) — suffisamment incitatif sans dégrader la marge

4. **Mesurer** : nombre de leads entrants par prescripteur/mois → identifier les 2 qui fonctionnent, doubler la mise sur eux

**Résultat attendu à 60 jours :** 2–3 prescripteurs actifs générant 5–15 essais qualifiés, soit potentiellement **3–5 premiers abonnés payants** — de quoi valider le modèle et obtenir les premiers témoignages.

---

## Synthèse en une phrase

Nova Solo a un positionnement différenciant réel et une structure de coûts saine, mais il doit lever l'inconnue coût IA dans les 30 jours et activer des prescripteurs humains immédiatement — sans quoi la croissance organique seule ne permettra pas d'atteindre la viabilité avant la fin de la période LACI.
