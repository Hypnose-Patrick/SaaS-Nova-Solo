// Vérification du JWT Supabase + récupération de l'utilisateur authentifié.
// Toute Edge Function sensible DOIT appeler requireUser() avant d'agir.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface AuthedUser {
  id: string;
  email?: string;
}

// Renvoie l'utilisateur si le Bearer token est valide, sinon lève une Error.
export async function requireUser(req: Request): Promise<AuthedUser> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("UNAUTHENTICATED: header Authorization manquant");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    throw new Error("CONFIG: variables SUPABASE_URL / SUPABASE_ANON_KEY absentes");
  }

  // Client lié au token de l'appelant : getUser() valide la signature côté Supabase.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new Error("UNAUTHENTICATED: token invalide ou expiré");
  }

  return { id: data.user.id, email: data.user.email ?? undefined };
}
