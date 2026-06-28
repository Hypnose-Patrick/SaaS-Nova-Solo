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
    // Nova vit dans le schéma « nova » : user_ai_config / user_telegram_config
    // y résident. Le service_role contourne la RLS mais doit viser le bon schéma.
    db: { schema: "nova" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
