import { describe, it, expect, beforeEach } from "vitest";
import { parseLooseJson, loadLocal, saveLocal } from "../local";

describe("parseLooseJson", () => {
  it("parse un objet JSON propre", () => {
    expect(parseLooseJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("parse depuis une fence ```json", () => {
    const raw = "```json\n{\"x\": 42}\n```";
    expect(parseLooseJson<{ x: number }>(raw)).toEqual({ x: 42 });
  });

  it("extrait le JSON entouré de texte parasite", () => {
    const raw = 'Voici la réponse : {"ok":true} fin.';
    expect(parseLooseJson<{ ok: boolean }>(raw)).toEqual({ ok: true });
  });

  it("retourne null sur du JSON invalide", () => {
    expect(parseLooseJson("pas du json")).toBeNull();
  });

  it("retourne null sur une chaîne vide", () => {
    expect(parseLooseJson("")).toBeNull();
  });
});

describe("loadLocal / saveLocal", () => {
  beforeEach(() => localStorage.clear());

  it("retourne le fallback si la clé est absente", () => {
    expect(loadLocal("missing", "défaut")).toBe("défaut");
  });

  it("roundtrip save → load", () => {
    saveLocal("k", { v: 99 });
    expect(loadLocal("k", null)).toEqual({ v: 99 });
  });

  it("retourne le fallback si la valeur stockée est corrompue", () => {
    localStorage.setItem("bad", "{{invalide}}");
    expect(loadLocal("bad", "fallback")).toBe("fallback");
  });
});
