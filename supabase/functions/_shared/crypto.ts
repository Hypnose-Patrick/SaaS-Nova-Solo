// Chiffrement AES-GCM des secrets BYOK (clé du fournisseur de l'abonné).
// Master key : secret Edge Function AI_CONFIG_ENC_KEY — 32 octets encodés base64.
// Jamais commité, jamais renvoyé au client. Utilisé uniquement côté serveur.

function b64encode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function masterKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("AI_CONFIG_ENC_KEY");
  if (!raw) throw new Error("CONFIG: AI_CONFIG_ENC_KEY absente");
  const bytes = b64decode(raw);
  if (bytes.length !== 32) {
    throw new Error("CONFIG: AI_CONFIG_ENC_KEY doit faire 32 octets (base64)");
  }
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export interface Encrypted {
  ciphertext: string; // base64
  iv: string;         // base64 (12 octets)
}

// Chiffre un secret en clair → {ciphertext, iv} (base64).
export async function encryptSecret(plaintext: string): Promise<Encrypted> {
  const key = await masterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return { ciphertext: b64encode(new Uint8Array(ct)), iv: b64encode(iv) };
}

// Déchiffre {ciphertext, iv} → secret en clair.
export async function decryptSecret(enc: Encrypted): Promise<string> {
  const key = await masterKey();
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64decode(enc.iv) },
    key,
    b64decode(enc.ciphertext),
  );
  return new TextDecoder().decode(pt);
}
