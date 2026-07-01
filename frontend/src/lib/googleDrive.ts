// Sauvegarde/restauration personnelle sur le Google Drive de l'abonné (BYO).
// Entièrement côté navigateur : le token d'accès Google Identity Services vit
// en mémoire (jamais persisté, jamais envoyé au serveur Nova Solo). Reprend le
// principe de la v1 (Nova-Solo/index.html : initGoogleDriveSync / saveToGoogleDrive
// / loadFromGoogleDrive), adapté au modèle multi-tenant Supabase de l'app React.

import { useUserStore } from "@/stores/useUserStore";
import { useAppStore } from "@/stores/useAppStore";
import type { Profile, BmcBlock } from "@/types";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
          }): { requestAccessToken: () => void };
        };
      };
    };
  }
}

const GIS_SRC = "https://accounts.google.com/gsi/client";
const SCOPES = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets";
const SHEET_NAME = "Nova_Solo_DB";

let accessToken: string | null = null;

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Impossible de charger Google Identity Services"));
    document.head.appendChild(script);
  });
}

export function isGoogleDriveConnected(): boolean {
  return accessToken !== null;
}

export function disconnectGoogleDrive(): void {
  accessToken = null;
}

export async function connectGoogleDrive(): Promise<void> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!clientId) throw new Error("Configuration manquante : VITE_GOOGLE_CLIENT_ID");
  await loadGis();
  return new Promise((resolve, reject) => {
    const tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error ?? "Autorisation Google refusée"));
          return;
        }
        accessToken = resp.access_token;
        resolve();
      },
    });
    tokenClient.requestAccessToken();
  });
}

function requireToken(): string {
  if (!accessToken) throw new Error("Connectez d'abord votre Google Drive.");
  return accessToken;
}

async function findOrCreateSheetId(): Promise<string> {
  const token = requireToken();
  const q = encodeURIComponent(`name='${SHEET_NAME}' and trashed=false`);
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const searchData = await searchRes.json();
  if (!searchRes.ok) throw new Error(searchData.error?.message ?? "Échec de recherche sur Google Drive");
  if (searchData.files?.[0]?.id) return searchData.files[0].id as string;

  const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ properties: { title: SHEET_NAME } }),
  });
  const created = await createRes.json();
  if (!createRes.ok) throw new Error(created.error?.message ?? "Échec de création du Google Sheet");
  return created.spreadsheetId as string;
}

interface BackupPayload {
  version: 1;
  saved_at: string;
  profile: Profile;
  bmc: BmcBlock[];
}

// Sauvegarde MVP : le profil (Réglages) + les blocs BMC/Business Plan (stockés
// dans la même table `bmc`, clés `bp_*`). Les documents binaires restent dans
// le bucket privé Supabase — hors périmètre de cette sauvegarde personnelle.
export async function backupToGoogleDrive(): Promise<void> {
  const token = requireToken();
  const profile = useUserStore.getState().profile;
  if (!profile) throw new Error("Profil introuvable — reconnectez-vous.");
  const bmc = useAppStore.getState().bmc;

  const payload: BackupPayload = {
    version: 1,
    saved_at: new Date().toISOString(),
    profile,
    bmc,
  };

  const sheetId = await findOrCreateSheetId();
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [[JSON.stringify(payload)]] }),
    },
  );
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error?.message ?? "Échec de la sauvegarde Google Drive");
  }
}

export interface RestoreResult {
  savedAt: string;
  blocksRestored: number;
}

export async function restoreFromGoogleDrive(): Promise<RestoreResult> {
  const token = requireToken();
  const sheetId = await findOrCreateSheetId();
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Échec de la lecture Google Drive");

  const raw = data.values?.[0]?.[0];
  if (!raw) throw new Error("Aucune sauvegarde trouvée dans votre Google Drive.");
  const payload = JSON.parse(raw) as BackupPayload;

  const profile = useUserStore.getState().profile;
  if (!profile) throw new Error("Profil introuvable — reconnectez-vous.");

  // Réhydrate le profil sans écraser les identifiants (id/user_id restent ceux
  // de la session courante, jamais ceux de la sauvegarde).
  const { id: _id, user_id: _userId, ...profilePatch } = payload.profile;
  await useUserStore.getState().updateProfile(profilePatch);

  for (const block of payload.bmc) {
    await useAppStore.getState().upsertBmcBlock({
      profile_id: profile.id,
      block_key: block.block_key,
      content: block.content,
      challenge: block.challenge,
    });
  }

  return { savedAt: payload.saved_at, blocksRestored: payload.bmc.length };
}
