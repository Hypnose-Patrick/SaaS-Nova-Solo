# Dogfood QA Report — Nova Solo (start-mybusiness.com)

**Target:** https://start-mybusiness.com (Nova Solo)
**Date:** 5 juillet 2026
**Scope:** Landing page, login, dashboard post-connexion, tous les modules, responsive mobile — parcours utilisateur complet
**Tester:** Hermes Agent (automated exploratory QA)
**Compte test:** info@grandire.ch

---

## Executive Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 3 |
| 🟠 High | 5 |
| 🟡 Medium | 4 |
| 🔵 Low | 3 |
| **Total** | **15** |

**Overall Assessment:** Design exceptionnel (private club, or sur noir), landing page riche et bien structurée. Mais 8 pages sur 14 du dashboard font crasher le navigateur, la navigation sidebar ne change pas le contenu affiché, et pas de menu hamburger en mobile. L'app est fonctionnellement utilisable sur ~6 pages (diagnostic, business plan, oracle, goban-coach, pipeline, mirrorfisch) mais instable sur le reste.

---

## Issues

### Issue #1: 8 pages dashboard font crasher le navigateur

| Field | Value |
|-------|-------|
| **Severity** | 🔴 Critical |
| **Category** | Functional |
| **URL** | /bmc, /symbolique, /pricing, /marketing, /settings, /cv, /dossier, /contrat |

**Description:** Sur 14 pages testées dans le dashboard, 8 font systématiquement crasher le navigateur (Playwright "Target page, context or browser has been closed"). Les pages affectées : BMC, Vision symbolique, Offre & Pricing, Marketing, Settings, CV personnalisé, Dossier, Contrat. Les pages qui fonctionnent : Diagnostic, Business Plan, Oracle, Goban Coach, Pipeline, MirrorFisch.

**Steps to Reproduce:**
1. Se connecter avec un compte valide
2. Cliquer sur n'importe quel lien sidebar pointant vers /bmc, /symbolique, /pricing, /marketing, /settings, /cv, /dossier ou /contrat
3. Le navigateur se ferme

**Expected Behavior:** Toutes les pages doivent se charger sans crash.

**Actual Behavior:** 8 pages sur 14 causent un crash du navigateur. Probablement une erreur JS non gérée qui tue le process de rendu.

---

### Issue #2: Langue DE → page blanche

| Field | Value |
|-------|-------|
| **Severity** | 🔴 Critical |
| **Category** | Functional |
| **URL** | Landing page |

**Description:** Cliquer sur "DE" dans le header rend la landing page entièrement vide. Aucun contenu allemand ne s'affiche.

**Steps to Reproduce:**
1. Aller sur https://start-mybusiness.com
2. Cliquer "DE"
3. Page blanche

**Expected Behavior:** Contenu complet en allemand.

**Actual Behavior:** Page vide.

**Screenshot:** MEDIA:/workspace/dogfood-nova/lang-de.png

---

### Issue #3: Navigation sidebar ne change pas le contenu affiché

| Field | Value |
|-------|-------|
| **Severity** | 🔴 Critical |
| **Category** | Functional |
| **URL** | Dashboard (/) |

**Description:** Cliquer sur les modules sidebar (Pilotage, Stratégie, Acquisition, Gestion, Compte) ne change pas le contenu de la zone principale. Le texte affiché reste identique ("5,8h/mois 696 CHF/mois, Signaux d'alerte, Au vert, Ressources…"). La sidebar avec sous-modules (Diagnostic, BMC, Business Plan, etc.) fonctionne par contre — les liens changent l'URL et chargent du contenu.

**Steps to Reproduce:**
1. Se connecter → dashboard
2. Cliquer "Stratégie" dans la sidebar
3. Observer que le contenu ne change pas
4. Cliquer "Acquisition", "Gestion", "Compte" — idem

**Expected Behavior:** Chaque module doit afficher son propre contenu.

**Actual Behavior:** Le contenu reste identique quelle que soit la section sélectionnée.

---

### Issue #4: Liens "S'inscrire" et "Forgot password" invisibles sur /login

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **Category** | Functional / Visual |
| **URL** | /login |

**Description:** Les liens "Pas encore de compte ? S'inscrire" et "Forgot your password?" sont dans le DOM mais ne sont pas visibles à l'écran. Playwright confirme : "element is not visible".

**Expected Behavior:** Les deux liens visibles et cliquables.

**Actual Behavior:** Éléments invisibles (CSS — probablement overflow, opacity ou z-index).

---

### Issue #5: Pas de page 404 — redirect vers /login

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **Category** | Functional / UX |
| **URL** | /nonexistent-xyz-123 |

**Description:** Une URL inexistante redirige vers /login (status 200) sans message d'erreur.

**Expected Behavior:** Page 404 dédiée.

**Actual Behavior:** Redirect silencieux vers /login.

---

### Issue #6: Placeholders en anglais sur formulaire français

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **Category** | Content / UX |
| **URL** | /login |

**Description:** Labels en français ("Adresse e-mail", "Mot de passe") mais placeholders en anglais ("Your email address", "Your password").

**Expected Behavior:** Placeholders en français.

---

### Issue #7: "Forgot your password?" en anglais

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **Category** | Content |
| **URL** | /login |

**Description:** Lien en anglais alors que tout le reste est en français. "Pas encore de compte ? S'inscrire" est lui en français.

**Expected Behavior:** "Mot de passe oublié ?"

---

### Issue #8: Pas de menu hamburger en mobile dashboard

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **Category** | UX / Responsive |
| **URL** | Dashboard (/) |

**Description:** En mobile (390×844), la sidebar disparaît mais il n'y a pas de menu hamburger pour accéder aux modules. L'utilisateur mobile ne peut pas naviguer entre les sections du dashboard.

**Expected Behavior:** Icône hamburger en haut à gauche qui ouvre un menu coulissant.

**Actual Behavior:** Pas de bouton menu. La sidebar est inaccessible en mobile.

**Screenshot:** MEDIA:/workspace/dogfood-nova/dash-mobile.png

---

### Issue #9: Données pré-remplies dans le Diagnostic ("chomage", "8000 par moi")

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **Category** | Content / Data |
| **URL** | /diagnostic |

**Description:** Les champs du Diagnostic contiennent des données pré-remplies : "chomage" dans le premier textarea et "8000 par moi juste au travers du web" dans le troisième. Ce sont probablement des données de test du compte info@grandire.ch, mais elles persistent entre les sessions.

**Expected Behavior:** Champs vides ou avec placeholder uniquement, à moins que l'utilisateur n'ait sauvegardé un brouillon.

**Actual Behavior:** Données de test visibles dans les champs.

---

### Issue #10: Boutons de la sidebar sans icônes discernables

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **Category** | UX |
| **URL** | Dashboard |

**Description:** La sidebar utilise des caractères Unicode comme icônes (◈, ◎, ⊞, ◻, ✦, 🦅, ◇, ⊙, ◫) devant chaque module. Ces icônes ne sont pas toutes reconnaissables et rendent la navigation confuse.

**Expected Behavior:** Icônes claires et cohérentes (SVG ou lucide-react).

---

### Issue #11: Pipeline vide — pas de prospects visibles

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **Category** | UX |
| **URL** | /pipeline |

**Description:** La page Pipeline affiche uniquement un bouton "+ Prospect" mais aucune colonne Kanban ni prospect. Si le pipeline est vide, un empty state devrait expliquer quoi faire.

**Expected Behavior:** Colonnes Kanban (À contacter, En cours, Signé, etc.) avec empty state "Ajoutez votre premier prospect".

**Actual Behavior:** Page quasi vide avec juste un bouton.

---

### Issue #12: Page /legal — contenu non rendu

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **Category** | Functional |
| **URL** | /legal |

**Description:** Le HTML contient le contenu légal (Mentions légales, Patrick Beiner, Monthey) mais `inner_text("body")` retourne vide. Le contenu peut ne pas être visible.

---

### Issue #13: Bouton soumission sans texte visible sur /login

| Field | Value |
|-------|-------|
| **Severity** | 🔵 Low |
| **Category** | Visual |
| **URL** | /login |

**Description:** Le bouton "Se connecter" (doré) n'affiche pas clairement son texte dans le screenshot. Le HTML contient bien "Se connecter" mais visuellement il semble vide.

---

### Issue #14: Pas de `<title>` ni meta description sur la landing

| Field | Value |
|-------|-------|
| **Severity** | 🔵 Low |
| **Category** | SEO |
| **URL** | / |

**Description:** La landing page n'a ni `<title>` ni `<meta name="description">`. Impact SEO.

---

### Issue #15: "Plan de route 17%" dans la sidebar — progression bloquée

| Field | Value |
|-------|-------|
| **Severity** | 🔵 Low |
| **Category** | UX |
| **URL** | Dashboard |

**Description:** La sidebar affiche "Plan de route 17%" sous l'email utilisateur. Cette progression semble statique et ne reflète pas nécessairement l'avancement réel dans les modules.

---

## Issues Summary Table

| # | Title | Severity | Category | URL |
|---|-------|----------|----------|-----|
| 1 | 8 pages dashboard font crasher le navigateur | 🔴 Critical | Functional | /bmc, /symbolique, /pricing, /marketing, /settings, /cv, /dossier, /contrat |
| 2 | Langue DE → page blanche | 🔴 Critical | Functional | / |
| 3 | Navigation sidebar ne change pas le contenu | 🔴 Critical | Functional | / |
| 4 | Liens "S'inscrire" et "Forgot password" invisibles | 🟠 High | Functional/Visual | /login |
| 5 | 404 → redirect vers /login | 🟠 High | Functional/UX | /* |
| 6 | Placeholders en anglais sur formulaire FR | 🟠 High | Content/UX | /login |
| 7 | "Forgot your password?" en anglais | 🟠 High | Content | /login |
| 8 | Pas de menu hamburger en mobile dashboard | 🟠 High | UX/Responsive | / |
| 9 | Données pré-remplies dans Diagnostic | 🟡 Medium | Content/Data | /diagnostic |
| 10 | Icônes sidebar Unicode non claires | 🟡 Medium | UX | / |
| 11 | Pipeline vide sans empty state | 🟡 Medium | UX | /pipeline |
| 12 | Page /legal contenu non rendu | 🟡 Medium | Functional | /legal |
| 13 | Bouton login sans texte visible | 🔵 Low | Visual | /login |
| 14 | Pas de title ni meta description sur landing | 🔵 Low | SEO | / |
| 15 | "Plan de route 17%" statique | 🔵 Low | UX | / |

---

## Testing Coverage

### Pages Testées (post-connexion)
- ✅ **Dashboard / Pilotage** — sidebar, ROI calculator, signaux d'alerte, ressources
- ✅ **Diagnostic** (/diagnostic) — 3 textareas, bouton "Générer le diagnostic systémique"
- ✅ **Business Plan** (/business-plan) — boutons "Tout générer", "Word", "PDF", sections "IA Stratège" / "Éditer"
- ✅ **Oracle** (/oracle) — tirage animal du jour, 5 boutons contextuels, textarea
- ✅ **Goban Coach** (/goban-coach) — Victor, boutons "Commencer", "Découvrir les règles", "Diagnostic Carrière"
- ✅ **Pipeline** (/pipeline) — bouton "+ Prospect", page quasi vide
- ✅ **MirrorFisch** (/mirrorfisch) — test d'audience, select + textarea, bouton "Simuler la réaction"
- ❌ **BMC** (/bmc) — crash navigateur
- ❌ **Vision symbolique** (/symbolique) — crash navigateur
- ❌ **Offre & Pricing** (/pricing) — crash navigateur
- ❌ **Marketing** (/marketing) — crash navigateur
- ❌ **Settings** (/settings) — crash navigateur
- ❌ **CV personnalisé** (/cv) — crash navigateur
- ❌ **Dossier** (/dossier) — crash navigateur
- ❌ **Contrat** (/contrat) — crash navigateur

### Pages Testées (pre-connexion)
- ✅ Landing page — desktop + mobile
- ✅ Login — desktop + mobile, validation, Google OAuth
- ✅ Legal — HTML vérifié
- ✅ 404 behavior
- ✅ Language switching FR/DE (IT non testé — bloqué par bug DE)

### Non Testé
- ❌ Génération du diagnostic (IA) — pas cliqué pour éviter de consommer des crédits
- ❌ Chat Nova — bouton "Parler à Nova" non testé
- ❌ Création de facture / prospect / dépense
- ❌ Export Word/PDF du business plan
- ❌ Flux de paiement / trial
- ❌ Version Pro vs Solo (différences non visibles)
- ❌ Langue IT (bloqué par bug DE)

---

## Notes

### Points positifs
- **Design** : Exceptionnel. Fond quasi-noir avec grain texture, accents dorés (#C9A952), typographie Playfair Display / Cormorant Garamond + Inter + JetBrains Mono. Exactement le style "private members club" recherché par Patrick.
- **Landing page** : Contenu riche — 7 modules décrits, douleurs concrètes (isolement, outils épars, règles suisses), métriques suisses (AVS, LACI, RI→Sàrl), ROI calculator.
- **Diagnostic** : 3 questions claires avec placeholders pertinents et exemples concrets.
- **Business Plan** : Structure avec sections "IA Stratège" / "Éditer" + export Word/PDF.
- **Oracle** : Concept original (animal du jour), 5 contextes prédéfinis.
- **Goban Coach** : Intégration du Goban de Carrière — cohérent avec l'écosystème Patrick.
- **MirrorFisch** : Test d'audience avec simulation de conversion — bon outil marketing.
- **Auth** : Supabase + Google OAuth + email/password. Message d'erreur "Invalid login credentials" s'affiche correctément.
- **Confidentialité** : Mention "données hébergées UE, conformes nLPD et RGPD" sous le formulaire.
- **Pas d'erreurs JS console** sur les pages qui fonctionnent.

### Recommandations prioritaires
1. **Critique #1** : Debuguer les 8 pages qui font crasher le navigateur (BMC, symbolique, pricing, marketing, settings, CV, dossier, contrat). C'est probablement une erreur JS commune (route guard, component manquant, ou API call qui throw).
2. **Critique #2** : Corriger le bug langue DE (page blanche).
3. **Critique #3** : Corriger la navigation sidebar — les modules (Pilotage/Stratégie/Acquisition/Gestion/Compte) doivent changer le contenu affiché ou expandre les sous-modules.
4. **Urgent** : Rendre les liens "S'inscrire" et "Forgot password" visibles sur /login.
5. **Urgent** : Ajouter un menu hamburger en mobile pour accéder à la sidebar.
6. **Urgent** : Créer une page 404 dédiée.
7. **Urgent** : Traduire placeholders et "Forgot your password?" en français.
8. **Moyen** : Ajouter un empty state sur le Pipeline.
9. **Moyen** : Vérifier le rendu de /legal.
10. **Mineur** : Ajouter `<title>` et meta description sur la landing.