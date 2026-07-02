// En-têtes CORS communs à toutes les Edge Functions.
// On restreint l'origine via la variable d'env ALLOWED_ORIGIN (défaut: *).
// En production, définir ALLOWED_ORIGIN = https://start-mybusiness.com
// (secret Supabase actuellement absent — CORS reste ouvert à * tant qu'il n'est pas posé)

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

// Réponse JSON standard avec CORS.
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Pré-vol CORS.
export function handleOptions(): Response {
  return new Response("ok", { headers: corsHeaders });
}
