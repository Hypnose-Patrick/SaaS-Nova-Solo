// Parrainage Nova Solo Suisse — client frontend.
// Toutes les écritures passent par l'Edge Function `referral` (service_role) :
// les tables referral_* sont en RLS SELECT-only, on ne les écrit jamais côté
// client. La lecture du tableau de bord passe aussi par `summary`.

import { supabase } from "@/lib/supabase";
import type { Account } from "@/types";

const REF_KEY = "ns_ref_code";

export interface ReferralSummary {
  code: string | null;
  link: string | null;
  eligible_to_refer: boolean;
  share_unlocked: boolean;
  share_trigger: "first_client_added" | "first_invoice_sent" | null;
  counts: { n_actifs: number; want_upgrade: boolean; want_discount5: boolean; cash_eligible_count: number };
  filleuls: { status: string; created_at: string; qualified_at: string | null }[];
  rewards: { type: string; milestone: string; status: string; starts_at: string; ends_at: string | null }[];
}

async function callReferral<T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Session expirée — reconnectez-vous.");
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/referral`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error ?? "Erreur serveur") as Error & { code?: string };
    err.code = data.code;
    throw err;
  }
  return data as T;
}

export const getReferralSummary = () => callReferral<ReferralSummary>("summary");
export const unlockShare = (trigger: "first_client_added" | "first_invoice_sent") =>
  callReferral<{ ok: boolean }>("unlock-share", { trigger }).catch(() => ({ ok: false }));

// --- Capture du code parrain (?ref=CODE sur la landing / le lien d'invitation) ---
export function captureRefFromUrl(): void {
  try {
    const code = new URLSearchParams(window.location.search).get("ref");
    if (code && /^[A-Z0-9]{4,16}$/i.test(code)) {
      // Ne pas écraser un code déjà en attente (premier lien gagne).
      if (!localStorage.getItem(REF_KEY)) localStorage.setItem(REF_KEY, code.toUpperCase());
    }
  } catch { /* mode privé / SSR */ }
}

function pendingRef(): string | null {
  try { return localStorage.getItem(REF_KEY); } catch { return null; }
}
function clearPendingRef(): void {
  try { localStorage.removeItem(REF_KEY); } catch { /* noop */ }
}

// Réponses terminales : inutile de re-tenter (on purge le code en attente).
const TERMINAL_CODES = new Set(["TOO_LATE", "ALREADY_REFERRED", "SELF_REFERRAL", "INVALID_CODE", "REFERRER_NOT_ELIGIBLE"]);

// Tente d'enregistrer la relation de parrainage une fois le compte chargé.
// Idempotent côté serveur (un filleul = un parrain, verrouillé). N'applique
// jamais rétroactivement (le serveur refuse TOO_LATE si déjà payé).
export async function claimPendingRef(account: Pick<Account, "id"> | null | undefined): Promise<void> {
  const code = pendingRef();
  if (!code || !account) return;
  try {
    await callReferral("claim", { code });
    clearPendingRef(); // succès
  } catch (err) {
    const c = (err as { code?: string }).code;
    if (c && TERMINAL_CODES.has(c)) clearPendingRef(); // échec définitif : on purge
    // sinon (réseau / 500) : on garde le code pour retenter au prochain login
  }
}
