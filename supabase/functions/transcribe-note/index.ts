// Edge Function : transcribe-note
// Rôle : transcrire une note vocale du compagnon terrain (capture kind='voice')
// en texte, et écrire le résultat dans nova.captures.transcript.
//
// Entrée : { storage_path, capture_id }. L'audio vit dans le bucket privé
// nova-docs ({user_id}/captures/...). On vérifie que le fichier appartient au
// dossier de l'utilisateur authentifié AVANT de le télécharger, puis on n'écrit
// le transcript que sur la capture qui référence ce fichier (garde-fou double).
//
// Appel côté client : fire-and-forget après l'insert de la capture (l'UI n'attend
// jamais la transcription ; l'audio brut reste réécoutable si elle échoue).
//
// Secret attendu : OPENAI_API_KEY (Whisper).

import { handleOptions, json } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { adminClient } from "../_shared/admin.ts";
import { assertActiveEntitlement, EntitlementError } from "../_shared/entitlement.ts";

interface TranscribeRequest {
  storage_path?: string;
  capture_id?: string;
}

// Nom de fichier avec extension correcte : Whisper détecte le format par l'extension.
function filenameFor(mime: string): string {
  if (mime.includes("webm")) return "note.webm";
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "note.mp4";
  if (mime.includes("ogg")) return "note.ogg";
  if (mime.includes("wav")) return "note.wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "note.mp3";
  return "note.webm";
}

async function whisperTranscribe(bytes: Uint8Array, mime: string): Promise<string> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("NO_OPENAI");
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mime }), filenameFor(mime));
  form.append("model", "whisper-1");
  form.append("language", "fr"); // indépendants suisses romands
  form.append("response_format", "json");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) throw new Error(`PROVIDER openai ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data?.text ?? "").trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    const user = await requireUser(req);
    // Licence : refuse si abonnement inactif ou expiré (402).
    await assertActiveEntitlement(user.id);
    const body = (await req.json()) as TranscribeRequest;

    if (!body.storage_path || !body.capture_id) {
      return json({ error: "Fournir storage_path et capture_id" }, 400);
    }

    // Le chemin DOIT commencer par {user_id}/ — sinon tentative d'accès à autrui.
    const firstSeg = body.storage_path.split("/")[0];
    if (firstSeg !== user.id) {
      return json({ error: "Accès refusé à ce fichier" }, 403);
    }

    const db = adminClient();
    const { data: file, error: dlErr } = await db.storage.from("nova-docs").download(body.storage_path);
    if (dlErr || !file) return json({ error: "Fichier introuvable" }, 404);

    const mime = file.type || "audio/webm";
    const bytes = new Uint8Array(await file.arrayBuffer());
    const transcript = await whisperTranscribe(bytes, mime);

    // Garde-fou : on n'écrit QUE sur la capture qui référence ce fichier vérifié.
    const { error: upErr } = await db
      .from("captures")
      .update({ transcript })
      .eq("id", body.capture_id)
      .eq("storage_path", body.storage_path);
    if (upErr) return json({ error: "Écriture impossible", detail: upErr.message }, 500);

    return json({ ok: true, transcript });
  } catch (err) {
    if (err instanceof EntitlementError) {
      return json({ error: "Licence inactive ou expirée", code: err.reason }, 402);
    }
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith("UNAUTHENTICATED") ? 401 : 500;
    return json({ error: msg.split(":")[0], detail: msg }, status);
  }
});
