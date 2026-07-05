// Edge Function : purge-expired-accounts
// Rôle : purge DÉFINITIVE et IRRÉVERSIBLE des comptes dont le délai de grâce
// de 30 jours (nova.accounts.scheduled_purge_at) est dépassé — résiliation
// Stripe ou auto-suppression volontaire (cf. stripe-webhook, account-delete).
// La suppression de la ligne accounts cascade (ON DELETE CASCADE) vers
// nova.profiles puis vers les 14 tables filles (bmc, prospects, finances…).
//
// PAS de JWT utilisateur : appelée par un job planifié externe (GitHub Actions
// cron), authentifiée par un secret partagé en en-tête. Jamais exposée au
// frontend, jamais appelable par un abonné.
//
// Déclenchement : .github/workflows/purge-expired-accounts.yml (cron quotidien).

import { handleOptions, json } from "../_shared/cors.ts";
import { adminClient } from "../_shared/admin.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  const secret = Deno.env.get("PURGE_CRON_SECRET");
  const provided = req.headers.get("x-purge-secret");
  if (!secret || provided !== secret) {
    return json({ error: "Non autorisé" }, 401);
  }

  const db = adminClient();
  const nowIso = new Date().toISOString();

  const { data: due, error: selErr } = await db
    .from("accounts")
    .select("id, user_id, plan, stripe_customer_id, subscription_id, created_at")
    .not("scheduled_purge_at", "is", null)
    .lt("scheduled_purge_at", nowIso);
  if (selErr) return json({ error: "Lecture échouée", detail: selErr.message }, 500);
  if (!due || due.length === 0) return json({ purged: 0 });

  // Archive la référence transactionnelle AVANT la purge (Politique de
  // confidentialité §2 — "Référence transaction" retenue 10 ans, CO 958f).
  // Ne contient aucune donnée de profil/business/IA du sous-crit.
  const archiveRows = await Promise.all(
    due.map(async (a) => {
      const { data: userData } = await db.auth.admin.getUserById(a.user_id);
      return {
        original_user_id: a.user_id,
        email: userData?.user?.email ?? null,
        plan: a.plan,
        stripe_customer_id: a.stripe_customer_id,
        subscription_id: a.subscription_id,
        account_created_at: a.created_at,
      };
    }),
  );
  const { error: archiveErr } = await db.from("billing_archive").insert(archiveRows);
  if (archiveErr) return json({ error: "Archivage échoué — purge annulée", detail: archiveErr.message }, 500);

  const { error: delErr } = await db
    .from("accounts")
    .delete()
    .in("id", due.map((a) => a.id));
  if (delErr) return json({ error: "Suppression échouée", detail: delErr.message }, 500);

  console.log(`[purge-expired-accounts] ${due.length} compte(s) définitivement supprimé(s)`);
  return json({ purged: due.length });
});
