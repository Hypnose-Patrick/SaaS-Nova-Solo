// Edge Function : create-project
// Rôle : créer un nouveau projet (nova.profiles) pour le compte authentifié,
// en respectant le quota du palier d'abonnement (nova.accounts.max_projects).
//
// Pourquoi une Edge Function et pas un insert direct côté client :
//  - RLS + le trigger nova.enforce_project_quota (migration 013) bloquent déjà
//    tout dépassement de quota et toute tentative d'écrire sur le compte d'un
//    tiers — mais ni l'un ni l'autre ne vérifie que l'ABONNEMENT est actif.
//    Un compte résilié pourrait sinon garder le droit de créer son 1er projet
//    indéfiniment. assertActiveEntitlement() ferme ce trou.
//
// API (POST only, conforme aux CORS partagés) :
//   { action: "list" }                  -> { projects: [...] }
//   { action: "create", name? }         -> { project } | 403 PROJECT_LIMIT_REACHED
//   { action: "delete", projectId }     -> { ok: true } (refuse si dernier projet du compte)
//   { action: "reset", projectId }      -> { project } | 403 RESET_NOT_AVAILABLE (palier BYOK)

import { handleOptions, json } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { adminClient } from "../_shared/admin.ts";
import { assertActiveEntitlement, EntitlementError } from "../_shared/entitlement.ts";

// Tables filles à vider lors d'un reset — même liste que le schéma nova
// (migration 006). profile_id y reste la clé (renommage conceptuel "projet").
const CHILD_TABLES = [
  "bmc", "business_plans", "prospects", "events", "finance_data",
  "compta_entries", "documents", "rituals", "checklist", "chat_history",
  "diagnostics", "invoices", "messaging_settings", "symbolic_maps",
];

// Palier BYOK ("solo" en interne, cf. Subscribe.tsx) exclu du reset à la
// demande de Patrick — réservé aux paliers IA managée (Pro, Trio).
const RESET_ELIGIBLE_PLANS = new Set(["pro", "trio"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    const user = await requireUser(req);
    await assertActiveEntitlement(user.id);
    const db = adminClient();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "list");

    const { data: account, error: accErr } = await db
      .from("accounts")
      .select("id, max_projects, plan")
      .eq("user_id", user.id)
      .maybeSingle();
    if (accErr || !account) {
      return json({ error: "Compte introuvable", code: "ACCOUNT_NOT_FOUND" }, 404);
    }

    if (action === "list") {
      const { data, error } = await db
        .from("profiles")
        .select("id, project_name, brand_name, created_at")
        .eq("account_id", account.id)
        .order("created_at", { ascending: true });
      if (error) return json({ error: "Échec de lecture", detail: error.message }, 500);
      return json({ projects: data ?? [] });
    }

    if (action === "create") {
      const { count } = await db
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("account_id", account.id);

      if ((count ?? 0) >= account.max_projects) {
        return json(
          {
            error: `Limite de ${account.max_projects} projet(s) atteinte pour votre palier`,
            code: "PROJECT_LIMIT_REACHED",
          },
          403,
        );
      }

      const name = body.name ? String(body.name).trim().slice(0, 80) : "Mon activité";
      const { data, error } = await db
        .from("profiles")
        .insert({ account_id: account.id, user_id: user.id, project_name: name, email: user.email ?? null })
        .select()
        .single();
      if (error) {
        // Filet de sécurité : le trigger nova.enforce_project_quota peut aussi
        // rejeter l'insert en cas de course (deux créations quasi simultanées).
        if (error.message?.includes("PROJECT_LIMIT_REACHED")) {
          return json({ error: "Limite de projets atteinte", code: "PROJECT_LIMIT_REACHED" }, 403);
        }
        return json({ error: "Échec de création", detail: error.message }, 500);
      }
      return json({ project: data });
    }

    if (action === "delete") {
      const projectId = String(body.projectId ?? "");
      if (!projectId) return json({ error: "projectId requis" }, 400);

      const { count } = await db
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("account_id", account.id);
      if ((count ?? 0) <= 1) {
        return json({ error: "Impossible de supprimer le dernier projet du compte", code: "LAST_PROJECT" }, 400);
      }

      const { error } = await db
        .from("profiles")
        .delete()
        .eq("id", projectId)
        .eq("account_id", account.id); // ceinture-bretelles : jamais un profil hors du compte appelant
      if (error) return json({ error: "Échec de suppression", detail: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "reset") {
      if (!RESET_ELIGIBLE_PLANS.has(String(account.plan))) {
        return json(
          { error: "La réinitialisation n'est pas incluse dans votre palier (BYOK)", code: "RESET_NOT_AVAILABLE" },
          403,
        );
      }
      const projectId = String(body.projectId ?? "");
      if (!projectId) return json({ error: "projectId requis" }, 400);

      // Ceinture-bretelles : vérifie que le projet appartient bien au compte
      // appelant avant de vider quoi que ce soit.
      const { data: owned } = await db
        .from("profiles")
        .select("id")
        .eq("id", projectId)
        .eq("account_id", account.id)
        .maybeSingle();
      if (!owned) return json({ error: "Projet introuvable" }, 404);

      for (const table of CHILD_TABLES) {
        const { error: delErr } = await db.from(table).delete().eq("profile_id", projectId);
        if (delErr) {
          return json({ error: `Échec du reset (${table})`, detail: delErr.message }, 500);
        }
      }

      // Remet les champs métier à zéro — conserve id/account_id/user_id/
      // project_name/email (identité du projet, pas son contenu business).
      const { data, error } = await db
        .from("profiles")
        .update({
          statut: null, activite_type: null, domaine: null, situation: null,
          ville: null, canton: null, is_laci: false, capital: 0, charges_fixes: 0,
          runway_months: null, brand_name: null, slogan: null, logo_url: null,
          accent_color: null, contact_email: null, contact_tel: null,
          contact_adresse: null, website: null, dob: null, bio: null, profil: null,
          pricing_tarif: null, pricing_clients: null,
        })
        .eq("id", projectId)
        .select()
        .single();
      if (error) return json({ error: "Échec du reset (profil)", detail: error.message }, 500);
      return json({ project: data });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (err) {
    if (err instanceof EntitlementError) {
      return json({ error: "Licence inactive ou expirée", code: err.reason }, 402);
    }
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith("UNAUTHENTICATED") ? 401 : 500;
    return json({ error: msg.split(":")[0], detail: msg }, status);
  }
});
