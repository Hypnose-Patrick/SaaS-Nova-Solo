// Edge Function : ocr-receipt
// Rôle : extraire les données d'un justificatif (montant, date, fournisseur,
// TVA, catégorie) à partir de la VRAIE image — corrige le bug d'audit où seul
// le nom de fichier était envoyé à l'IA.
//
// Entrée : { storage_path } (recommandé, image dans le bucket privé nova-docs)
//          ou { image_base64, mime } (inline).
// Si storage_path : on vérifie que le fichier appartient bien au dossier de
// l'utilisateur authentifié ({user_id}/...) avant de le télécharger.
//
// Secret attendu : ANTHROPIC_API_KEY (vision) ou OPENROUTER_API_KEY

import { handleOptions, json } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { adminClient } from "../_shared/admin.ts";

interface OcrRequest {
  storage_path?: string;
  image_base64?: string;
  mime?: string;
}

const EXTRACT_PROMPT =
  "Tu es un moteur d'extraction de justificatifs comptables suisses. " +
  "Analyse l'image et renvoie UNIQUEMENT un objet JSON valide, sans texte autour, " +
  "au format : {\"fournisseur\": string, \"date\": \"YYYY-MM-DD\"|null, " +
  "\"montant_ttc\": number|null, \"tva_taux\": number|null, \"tva_montant\": number|null, " +
  "\"categorie\": string|null, \"devise\": string, \"confiance\": number}. " +
  "Taux TVA suisses possibles : 8.1, 2.6, 3.8. confiance entre 0 et 1. " +
  "Si une valeur est illisible, mets null.";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function extractJson(text: string): unknown {
  // Le modèle peut entourer le JSON ; on isole le premier objet.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("PARSE: pas de JSON détecté");
  return JSON.parse(text.slice(start, end + 1));
}

async function visionAnthropic(b64: string, mime: string): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("NO_ANTHROPIC");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mime, data: b64 } },
          { type: "text", text: EXTRACT_PROMPT },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`PROVIDER anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data?.content?.[0]?.text ?? "";
}

async function visionOpenRouter(b64: string, mime: string): Promise<string> {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) throw new Error("NO_OPENROUTER");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Title": "Nova Solo",
    },
    body: JSON.stringify({
      model: "anthropic/claude-3.5-sonnet",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: EXTRACT_PROMPT },
          { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`PROVIDER openrouter ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    const user = await requireUser(req);
    const body = (await req.json()) as OcrRequest;

    let b64: string;
    let mime = body.mime ?? "image/jpeg";

    if (body.storage_path) {
      // Le chemin DOIT commencer par {user_id}/ — sinon tentative d'accès à autrui.
      const firstSeg = body.storage_path.split("/")[0];
      if (firstSeg !== user.id) {
        return json({ error: "Accès refusé à ce fichier" }, 403);
      }
      const db = adminClient();
      const { data, error } = await db.storage.from("nova-docs").download(body.storage_path);
      if (error || !data) return json({ error: "Fichier introuvable" }, 404);
      mime = data.type || mime;
      b64 = bytesToBase64(new Uint8Array(await data.arrayBuffer()));
    } else if (body.image_base64) {
      b64 = body.image_base64.replace(/^data:[^;]+;base64,/, "");
    } else {
      return json({ error: "Fournir storage_path ou image_base64" }, 400);
    }

    // Vision : Anthropic en priorité, repli OpenRouter.
    let raw: string;
    try {
      raw = await visionAnthropic(b64, mime);
    } catch (e) {
      if (e instanceof Error && e.message === "NO_ANTHROPIC") {
        raw = await visionOpenRouter(b64, mime);
      } else throw e;
    }

    const extracted = extractJson(raw);
    return json({ ok: true, data: extracted });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.startsWith("UNAUTHENTICATED") ? 401 : 500;
    return json({ error: msg.split(":")[0], detail: msg }, status);
  }
});
