// Type d'activité — champ pivot qui rend Nova Solo agnostique aux métiers.
// Source unique de vérité pour les labels, unités de calcul et postes OPEX.
// Consommé par Settings (choix), et à venir par Pricing (④) et Finances (⑤).

import type { Profile } from "@/types";

export type ActiviteType = "prestation" | "artisanat" | "commerce";

export interface ActivitePreset {
  /** Libellé affiché dans le menu déroulant Réglages. */
  label: string;
  /** Label du champ tarif (Réglages, Pricing). */
  tarifLabel: string;
  /** Label du champ volume (Réglages, Pricing). */
  volumeLabel: string;
  /** Nom de l'unité vendue, au singulier (pipeline, calculateur). */
  unite: string;
  /** true → l'activité revend du matériel/marchandise → colonne marge + OPEX matières. */
  hasMateriel: boolean;
  /** Postes OPEX additionnels injectés dans le budget d'exploitation (mode vierge). */
  opexExtra: string[];
}

export const ACTIVITE_PRESETS: Record<ActiviteType, ActivitePreset> = {
  prestation: {
    label: "Prestation intellectuelle (coaching, conseil, formation)",
    tarifLabel: "Tarif journalier / séance (CHF)",
    volumeLabel: "Clients cibles / mois",
    unite: "client",
    hasMateriel: false,
    opexExtra: [],
  },
  artisanat: {
    label: "Artisanat / chantier (plomberie, peinture, menuiserie…)",
    tarifLabel: "Tarif horaire / au m² (CHF)",
    volumeLabel: "Chantiers / interventions par mois",
    unite: "chantier",
    hasMateriel: true,
    opexExtra: [
      "Achat matériel / marchandises",
      "Véhicule & carburant",
      "Outillage & équipement",
      "Sous-traitance",
    ],
  },
  commerce: {
    label: "Commerce / vente (boutique, revente, e-commerce)",
    tarifLabel: "Panier moyen (CHF)",
    volumeLabel: "Ventes / commandes par mois",
    unite: "commande",
    hasMateriel: true,
    opexExtra: [
      "Achat de marchandises (coût des ventes)",
      "Stock & logistique",
      "Emballage & expédition",
    ],
  },
};

/** Valeur par défaut : « prestation » (comportement historique) si non renseigné. */
export const DEFAULT_ACTIVITE: ActiviteType = "prestation";

/** Résout le preset d'un profil, avec repli sûr sur « prestation ». */
export function activitePreset(p: Profile | null): ActivitePreset {
  const key = p?.activite_type;
  return ACTIVITE_PRESETS[(key as ActiviteType) in ACTIVITE_PRESETS ? (key as ActiviteType) : DEFAULT_ACTIVITE];
}
