import { createClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL as string) || "https://placeholder.supabase.co";
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "placeholder-key";

if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    "[Nova Solo] VITE_SUPABASE_ANON_KEY manquante — copier .env.example → .env.local et redémarrer Vite.",
  );
}

export const supabase = createClient(url, anonKey, {
  // Nova Solo vit dans son propre schéma Postgres « nova » (isolation totale
  // vis-à-vis de public.* / La Trajectoire). Tous les .from() visent nova.*.
  // L'auth (auth.users) et le Storage ne sont pas affectés par db.schema.
  db: { schema: "nova" },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Raccourci pour les URLs signées (bucket nova-docs, privé).
export async function signedUrl(storagePath: string, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("nova-docs")
    .createSignedUrl(storagePath, expiresIn);
  if (error) return null;
  return data.signedUrl;
}
