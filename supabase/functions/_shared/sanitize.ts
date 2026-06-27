// Filtrage défensif des secrets avant tout envoi à un fournisseur IA externe.
// Constat d'audit Hermès : le contexte métier transmis à l'IA ne doit JAMAIS
// contenir de jeton, clé API, mot de passe ou identifiant de messagerie.
// Double protection : (1) suppression par clé connue, (2) rédaction par motif.

// Clés dont la valeur est toujours supprimée, quel que soit le niveau d'imbrication.
const SECRET_KEYS = new Set([
  "telegramtoken",
  "whatsappkey",
  "aiproxytoken",
  "aikey",
  "anthropickey",
  "openrouterkey",
  "apikey",
  "api_key",
  "authorization",
  "password",
  "secret",
  "token",
  "access_token",
  "refresh_token",
  "gdrivetoken",
  "service_role_key",
]);

// Motifs de jetons/clés à rédiger même s'ils apparaissent dans du texte libre.
const SECRET_PATTERNS: RegExp[] = [
  /sk-[a-zA-Z0-9-]{20,}/g, // OpenAI / OpenRouter
  /sk-ant-[a-zA-Z0-9_-]{20,}/g, // Anthropic
  /\b\d{8,10}:[A-Za-z0-9_-]{30,}\b/g, // Bot token Telegram (id:hash)
  /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, // JWT
  /Bearer\s+[A-Za-z0-9._-]{20,}/gi, // En-tête Bearer
];

const REDACTED = "[REDACTED]";

function redactString(s: string): string {
  let out = s;
  for (const re of SECRET_PATTERNS) out = out.replace(re, REDACTED);
  return out;
}

// Nettoie récursivement n'importe quelle structure (objet, tableau, chaîne).
export function sanitize(value: unknown): unknown {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_KEYS.has(k.toLowerCase())) continue; // on retire la clé entière
      clean[k] = sanitize(v);
    }
    return clean;
  }
  return value;
}

// Raccourci pour le contexte texte d'un prompt.
export function sanitizeText(text: string): string {
  return redactString(text);
}
