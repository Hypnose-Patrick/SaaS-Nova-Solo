import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect } from "vitest";

// La landing publique (frontend/public/landing.html) est trilingue FR/DE/IT via
// un i18n maison : le script applyLang() lit un dictionnaire T[lang] puis injecte
// les traductions par deux voies :
//   1. un map historique '#ns-...' -> clé (éléments d'ossature)
//   2. une boucle sur [data-i18n="clé"] (corps de page)
// Si un sélecteur/clé n'a pas d'entrée correspondante, ce texte reste en français
// quelle que soit la langue — c'est ce qui faisait paraître DE et IT « cassés ».
// Ces tests garantissent que tout ce qui doit être traduit l'est dans les 3 langues.
const html = readFileSync(resolve(process.cwd(), "public/landing.html"), "utf-8");

function matchAll(src: string, re: RegExp): string[] {
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) set.add(m[1]);
  return [...set];
}

// Le dictionnaire T réel, extrait et évalué depuis le fichier.
function parseDict(): Record<"fr" | "de" | "it", Record<string, string>> {
  const m = html.match(/var T=(\{[\s\S]*?\n {2}\});/);
  if (!m) throw new Error("Bloc `var T={...}` introuvable dans landing.html");
  // eslint-disable-next-line no-eval
  return eval("(" + m[1] + ")");
}

describe("landing.html — i18n FR/DE/IT", () => {
  it("chaque sélecteur '#ns-...' référencé par applyLang() a un élément correspondant", () => {
    const ids = new Set(matchAll(html, /id="(ns-[a-z0-9-]+)"/g));
    const missing = matchAll(html, /['"]#(ns-[a-z0-9-]+)['"]/g).filter((s) => !ids.has(s));
    expect(missing).toEqual([]);
  });

  it("chaque clé data-i18n existe dans les trois langues", () => {
    const T = parseDict();
    const keys = matchAll(html, /data-i18n="([a-z0-9]+)"/gi);
    expect(keys.length).toBeGreaterThan(30); // garde-fou : le corps de page est bien tagué
    const missing: string[] = [];
    for (const k of keys) {
      for (const lang of ["fr", "de", "it"] as const) {
        if (T[lang][k] == null) missing.push(`${lang}.${k}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("les trois dictionnaires ont exactement les mêmes clés", () => {
    const T = parseDict();
    const fr = Object.keys(T.fr).sort();
    expect(Object.keys(T.de).sort()).toEqual(fr);
    expect(Object.keys(T.it).sort()).toEqual(fr);
  });
});
