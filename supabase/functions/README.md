# Edge Functions — Nova Solo

Trois fonctions serverless (Deno) qui déplacent toute logique sensible côté serveur.
Aucune clé API n'est jamais exposée au navigateur.

| Fonction        | Rôle                                                        | Auth |
|-----------------|-------------------------------------------------------------|------|
| `ai-proxy`      | Relais IA (Cabinet Hermès) avec clé serveur + filtrage secrets | JWT |
| `telegram-send` | Notifications Telegram via bot de plateforme                | JWT |
| `ocr-receipt`   | Extraction de justificatifs depuis la vraie image (vision)  | JWT |

## Modules partagés (`_shared/`)

- `cors.ts` — en-têtes CORS + helpers `json()` / `handleOptions()`
- `auth.ts` — `requireUser(req)` valide le JWT Supabase et renvoie l'utilisateur
- `admin.ts` — client service_role (contourne RLS, usage serveur strict)
- `sanitize.ts` — filtrage défensif des secrets (clés connues + motifs de jetons)

## Secrets à configurer

```bash
# IA (au moins un des deux)
supabase secrets set OPENROUTER_API_KEY=sk-or-...
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set AI_DEFAULT_PROVIDER=openrouter

# Telegram (bot de plateforme @NovaSoloBot)
supabase secrets set TELEGRAM_BOT_TOKEN=123456:ABC...

# CORS production (optionnel, défaut *)
supabase secrets set ALLOWED_ORIGIN=https://app.nova-solo.ch
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont injectés
automatiquement par la plateforme — ne pas les redéfinir.

## Déploiement

```bash
supabase functions deploy ai-proxy
supabase functions deploy telegram-send
supabase functions deploy ocr-receipt
```

## Modèle de sécurité

1. **JWT obligatoire** — `verify_jwt = true` (passerelle) + `requireUser()` (interne).
2. **Clés serveur uniquement** — lues via `Deno.env`, jamais reçues du client.
3. **Filtrage secrets** — `ai-proxy` passe contexte + messages par `sanitize()`
   avant tout envoi externe (suppression par clé + rédaction par motif `sk-…`,
   `id:hash` Telegram, JWT, `Bearer …`).
4. **Isolation par utilisateur** — `telegram-send` résout le `chat_id` en base
   pour l'utilisateur authentifié ; `ocr-receipt` refuse tout `storage_path`
   hors du dossier `{user_id}/`.
5. **Modèles en liste blanche** — le client ne peut pas demander un modèle arbitraire.
