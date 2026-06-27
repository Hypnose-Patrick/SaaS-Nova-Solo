// Client Supabase avec la clé service_role (contourne RLS).
// À n'utiliser QUE côté Edge Function, jamais exposé au client.
// Toujours filtrer explicitement par l'user_id authentifié.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error("CONFIG: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY absentes");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
