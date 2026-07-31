# SaaS Nova Solo

> ## ⚠️ Ce dépôt ne déploie plus start-mybusiness.com
>
> Depuis le **2026-07-31**, le site suisse est bâti et mis en ligne par
> [`Hypnose-Patrick/SaaS-Nova-France`](https://github.com/Hypnose-Patrick/SaaS-Nova-France),
> à partir du même code que nova-solo.fr. Ce qui diffère entre les deux pays
> passe par `frontend/src/lib/regime.ts` et `frontend/statique-ch/`.
>
> Le workflow de déploiement d'ici est **désarmé** (commit `ec501c1`) : plus de
> déclencheur `push`, seulement un `workflow_dispatch` conservé comme filet si
> l'alignement devait être annulé. Ne pas le réarmer — deux dépôts déployant le
> même `/public_html/`, c'est un pile ou face, et le perdant remet en ligne la
> version d'avant sans qu'aucun job n'échoue.
>
> **Ne rien appliquer depuis `supabase/migrations/`** : voir le `LISEZ-MOI.md`
> qui s'y trouve. Les numéros 019 et suivants désignent autre chose sur la base.
>
> Le code applicatif reste ici pour l'instant : la branche
> `fix/aide-link-vers-presentation` porte cinq commits jamais fusionnés, et
> décider de leur sort passe avant tout nettoyage.
>
> Le récit complet : `SaaS-Nova-France/docs/ALIGNEMENT-SUISSE.md`.

Refactorisation de Nova Solo en application React moderne avec Supabase pour multi-tenancy.

## Vue d'ensemble

**Nova Solo** est une suite complète pour solopreneurs suisse romands (indépendants, coachs, créateurs). Cette version SaaS ajoute :
- ✅ Multi-tenancy (plusieurs utilisateurs/comptes)
- ✅ Authentification OAuth + email/password
- ✅ Persistance Supabase (sync cross-device)
- ✅ Architecture React moderne (maintenabilité, testabilité)
- ✅ Chiffrement données sensibles
- ✅ Compliance nLPD + Privacy Policy + ToS

## Structure du projet

```
SaaS-Nova-Solo/
├── frontend/                    # App React (Vite)
│   ├── src/
│   │   ├── pages/              # Pages principales
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Quotidien.jsx
│   │   │   ├── Lancement.jsx
│   │   │   ├── Croissance.jsx
│   │   │   └── Settings.jsx
│   │   ├── components/         # Composants réutilisables
│   │   │   ├── Header.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Modal.jsx
│   │   │   └── ...
│   │   ├── modules/            # Domaines métier
│   │   │   ├── Dashboard/
│   │   │   ├── Calendar/
│   │   │   ├── Finance/
│   │   │   ├── Pipeline/
│   │   │   ├── BusinessCanvas/
│   │   │   ├── CabinetHermes/
│   │   │   └── ...
│   │   ├── hooks/              # Custom React hooks
│   │   │   ├── useAuth.js
│   │   │   ├── useUser.js
│   │   │   └── useSupabase.js
│   │   ├── context/            # Context API
│   │   │   ├── AuthContext.jsx
│   │   │   ├── UserContext.jsx
│   │   │   └── SettingsContext.jsx
│   │   ├── services/           # API & integrations
│   │   │   ├── supabaseClient.ts
│   │   │   ├── authService.ts
│   │   │   ├── apiService.ts
│   │   │   └── ...
│   │   ├── utils/              # Helpers & utils
│   │   │   ├── formatting.js
│   │   │   ├── validation.js
│   │   │   ├── crypto.js
│   │   │   └── ...
│   │   ├── styles/             # CSS modules + design system
│   │   │   ├── app.module.css
│   │   │   ├── variables.css
│   │   │   └── ...
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── .env.example
│   ├── .env.local (gitignored)
│   └── README.md
├── supabase/                   # Database & config
│   ├── migrations/
│   │   ├── 001_auth_setup.sql
│   │   ├── 002_users_table.sql
│   │   ├── 003_projects_table.sql
│   │   ├── 004_finances_table.sql
│   │   ├── 005_pipeline_table.sql
│   │   ├── 006_documents_table.sql
│   │   └── 007_rls_policies.sql
│   ├── seed.sql
│   ├── config.toml
│   └── README.md
├── docs/                       # Documentation
│   ├── ARCHITECTURE.md         # Décisions de design
│   ├── AUDIT-HERMES.md         # Résultats audit complet
│   ├── SCHEMA-SUPABASE.md      # Modèle de données
│   ├── ROADMAP.md              # Product roadmap
│   ├── API.md                  # API documentation
│   ├── DEPLOYMENT.md           # Instructions déploiement
│   └── SECURITY.md             # Politique sécurité
├── .github/
│   ├── workflows/
│   │   ├── test.yml            # Tests + linting
│   │   ├── build.yml           # Build Vite
│   │   └── deploy.yml          # Deploy Vercel/Netlify
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── feature_request.md
├── .gitignore
├── .env.example
├── LICENSE                     # Propriétaire SeedJobs
├── package.json (root)
└── CONTRIBUTING.md
```

## Stack Technique

### Frontend
- **React 18** avec Vite (dev server fast, build optimal)
- **TypeScript** (type safety)
- **TailwindCSS** ou CSS Modules (styling)
- **Supabase Auth Helpers** (authentification)
- **Chart.js** (graphiques financiers)
- **React Router** (navigation SPA)
- **Zustand** ou **Context API** (state management)

### Backend
- **Supabase** (PostgreSQL + Auth + Realtime)
- **PostgreSQL** (RLS policies pour multi-tenancy)
- **Edge Functions** (Node.js optionnel)

### Testing
- **Jest** (unit tests)
- **React Testing Library** (component tests)
- **Playwright** (E2E tests)
- **ESLint + Prettier** (code quality)

### Deployment
- **Vercel** ou **Netlify** (frontend)
- **Supabase Cloud** (backend)
- **GitHub Actions** (CI/CD)

## Getting Started

### Prérequis
- Node.js 18+
- npm ou yarn
- Git
- Compte Supabase

### Installation

```bash
# Clone
git clone https://github.com/yourusername/SaaS-Nova-Solo.git
cd SaaS-Nova-Solo

# Frontend
cd frontend
npm install
cp .env.example .env.local
# Éditer .env.local avec vos clés Supabase

# Run dev server
npm run dev
```

### Configuration Supabase

```bash
# Installer Supabase CLI
npm install -g supabase

# Initialiser projet Supabase (si nouveau)
supabase init

# Appliquer migrations
supabase migration up

# Voir data en local
supabase studio
```

## Modules Principaux

### 1. **Quotidien** 📅
- Dashboard (widgets clés)
- Agenda & Priorités (calendrier + Eisenhower)
- Mon Profil (données personnelles)
- Assistant Nova (chat IA)

### 2. **Lancement** 🚀
- Diagnostic entrepreneurial
- Vision Symbolique (coaching systémique)
- Business Model Canvas (9 blocs)
- Business Plan (5 sections)
- Offre & Pricing (calculateur)
- CV Personnalisé
- Dossier Présentation PDF

### 3. **Croissance** 📈
- Pipeline Prospection & Vente
- Marketing & Visibilité
- Finances (prévisionnel + trésorerie)
- Comptabilité & Reçus
- Cabinet Hermès (6 experts IA)

## Résultats Audit Hermes

### P0 (Critiques - 2-4 semaines)
- ⚖️ Consentement nLPD + DPIA
- 🔐 Chiffrement données localStorage
- 📋 Privacy Policy + ToS

### P1 (Majeurs - 1-2 semaines)
- 🏗️ Refactorisation React (modularité, tests)
- 📊 Intégration Supabase (multi-tenancy, RLS)
- ✅ Suite de tests (Jest + Playwright)

### Timeline
- **Semaine 1-2** : Résoudre P0 légal
- **Semaine 3-6** : Refactoriser core modules en React
- **Semaine 7-10** : Intégrer Supabase + tests
- **Semaine 11-12** : Déploiement + optimisation

Voir [AUDIT-HERMES.md](docs/AUDIT-HERMES.md) pour rapport complet.

## Contribution

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour guidelines.

## License

Propriétaire — Patrick Beiner. Voir [LICENSE](LICENSE).

## Support

Questions ? Contacter patrick@pnl-formation.org
