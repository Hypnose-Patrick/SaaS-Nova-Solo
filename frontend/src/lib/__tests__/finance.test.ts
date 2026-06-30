import { describe, it, expect } from "vitest";
import { chf, financeCompute, financeKpis } from "../finance";
import type { FinModel } from "../finance";

describe("chf", () => {
  it("formate zéro", () => expect(chf(0)).toBe("0"));
  it("formate les milliers avec apostrophe suisse", () => expect(chf(12500)).toBe("12'500"));
  it("arrondit à l'entier", () => expect(chf(1234.7)).toBe("1'235"));
  it("préfixe − pour les négatifs", () => expect(chf(-500)).toBe("−500"));
  it("gère NaN → 0", () => expect(chf(NaN)).toBe("0"));
});

const MODEL: FinModel = {
  scenario: "A",
  startCash: 1000,
  capitalInjection: 5000,
  injectionMonth: 2,
  scenarios: {
    A: {
      label: "Base",
      months: [
        { m: "Jan", period: "M1", ca: 2000, charges: 1500, draw: 200 },
        { m: "Feb", period: "M2", ca: 3000, charges: 1500, draw: 200 },
      ],
    },
    B: { label: "Optimiste", months: [] },
  },
  opexRI: [],
  opexSarl: [],
  financement: [],
};

describe("financeCompute", () => {
  it("produit autant de lignes que de mois", () => {
    expect(financeCompute(MODEL)).toHaveLength(2);
  });

  it("calcule l'EBITDA = CA − charges", () => {
    const rows = financeCompute(MODEL);
    expect(rows[0].ebitda).toBe(500); // 2000 - 1500
  });

  it("injecte le capital au bon mois", () => {
    const rows = financeCompute(MODEL);
    expect(rows[1].injection).toBe(5000);
    expect(rows[0].injection).toBe(0);
  });

  it("cumule la trésorerie correctement", () => {
    const rows = financeCompute(MODEL);
    // M1 : 1000 + (2000-1500) - 200 = 1300
    expect(rows[0].treso).toBe(1300);
    // M2 : 1300 + (3000-1500) + 5000 - 200 = 7600
    expect(rows[1].treso).toBe(7600);
  });
});

describe("financeKpis", () => {
  it("calcule le CA total", () => {
    const kpis = financeKpis(financeCompute(MODEL));
    expect(kpis.caTot).toBe(5000);
  });

  it("identifie le premier mois EBITDA positif", () => {
    const kpis = financeKpis(financeCompute(MODEL));
    expect(kpis.be).toBe("Jan · M1");
  });

  it("retourne — si aucun mois EBITDA positif", () => {
    const lossModel: FinModel = {
      ...MODEL,
      scenarios: {
        ...MODEL.scenarios,
        A: { label: "Perte", months: [{ m: "Jan", period: "M1", ca: 100, charges: 500 }] },
      },
    };
    expect(financeKpis(financeCompute(lossModel)).be).toBe("—");
  });

  it("gère un tableau vide", () => {
    const k = financeKpis([]);
    expect(k.tresoMin).toBe(0);
    expect(k.tresoMax).toBe(0);
  });
});
