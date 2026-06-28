// Persistance locale légère (localStorage) pour les sorties des modules Lancement
// (CV, dossier, pricing, vision symbolique…). Évite une migration Supabase ;
// à migrer vers la DB si un partage cross-device est requis.

export function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota / mode privé — silencieux
  }
}

/** Parse un JSON éventuellement entouré de texte ou de fences ```json. */
export function parseLooseJson<T = unknown>(raw: string): T | null {
  let s = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "");
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}
