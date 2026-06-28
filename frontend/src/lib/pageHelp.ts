// Aide contextuelle par écran — alimente le chatbot Nova pour qu'il aide
// « à n'importe quelle étape » : il sait sur quelle page se trouve l'abonné,
// quel expert est le plus pertinent et quelles questions proposer.

import type { AgentKey } from "@/types";

export interface PageHelp {
  title: string;         // nom lisible de l'étape
  blurb: string;         // une ligne : à quoi sert cet écran
  agent: AgentKey;       // expert le plus pertinent ici
  suggestions: string[]; // questions de démarrage propres à l'écran
}

// Repli générique pour les écrans sans aide dédiée.
const GENERIC: PageHelp = {
  title: "Nova Solo",
  blurb: "Posez votre question — Nova connaît votre profil et l'écran où vous êtes.",
  agent: "nova",
  suggestions: [
    "Par où commencer ?",
    "Explique-moi cette page",
    "Quelle est ma prochaine action ?",
  ],
};

export const PAGE_HELP: Record<string, PageHelp> = {
  "/": {
    title: "Tableau de bord",
    blurb: "Votre vue d'ensemble et vos priorités du moment.",
    agent: "nova",
    suggestions: [
      "Quelles sont mes priorités cette semaine ?",
      "Par où commencer aujourd'hui ?",
      "Résume où j'en suis dans mon projet",
    ],
  },
  "/diagnostic": {
    title: "Diagnostic",
    blurb: "Évalue votre situation et trace votre feuille de route.",
    agent: "strategist",
    suggestions: [
      "À quoi sert le diagnostic ?",
      "Comment répondre honnêtement aux questions ?",
      "Que faire de mes résultats ?",
    ],
  },
  "/bmc": {
    title: "Business Model Canvas",
    blurb: "Décrivez votre modèle d'affaires en 9 blocs.",
    agent: "strategist",
    suggestions: [
      "Par quel bloc commencer ?",
      "Challenge ma proposition de valeur",
      "Donne-moi un exemple de segment client",
    ],
  },
  "/business-plan": {
    title: "Business Plan",
    blurb: "Rédigez les 10 sections attendues par une banque cantonale.",
    agent: "strategist",
    suggestions: [
      "Quelle section remplir en premier ?",
      "Comment rédiger la partie « Porteur de projet » ?",
      "Que veut voir une banque cantonale dans un dossier ?",
    ],
  },
  "/finances": {
    title: "Finances",
    blurb: "Construisez votre budget prévisionnel sur 12 mois.",
    agent: "financier",
    suggestions: [
      "Comment estimer mes charges fixes ?",
      "Quel est mon seuil de rentabilité ?",
      "Comment importer un budget Excel existant ?",
    ],
  },
  "/compta": {
    title: "Comptabilité",
    blurb: "Suivez vos recettes et dépenses au fil de l'eau.",
    agent: "financier",
    suggestions: [
      "Comment importer un relevé bancaire PDF ?",
      "Quelles dépenses sont déductibles ?",
      "Dois-je tenir une comptabilité complète ?",
    ],
  },
  "/facture": {
    title: "Factures",
    blurb: "Émettez des factures conformes au standard suisse.",
    agent: "financier",
    suggestions: [
      "Que doit contenir une facture en Suisse ?",
      "Comment fonctionne la QR-facture ?",
      "À partir de quand facturer la TVA ?",
    ],
  },
  "/pricing": {
    title: "Tarification",
    blurb: "Fixez des prix justes et rentables.",
    agent: "financier",
    suggestions: [
      "Comment fixer mon tarif horaire ?",
      "Forfait ou facturation à l'heure ?",
      "Comment justifier mon prix face à une objection ?",
    ],
  },
  "/pipeline": {
    title: "Pipeline commercial",
    blurb: "Suivez vos prospects jusqu'à la signature.",
    agent: "commercial",
    suggestions: [
      "Comment décrocher mes premiers clients ?",
      "Réponds à l'objection « c'est trop cher »",
      "Comment relancer un prospect sans forcer ?",
    ],
  },
  "/marketing": {
    title: "Marketing",
    blurb: "Faites-vous connaître localement.",
    agent: "communicant",
    suggestions: [
      "Aide-moi à écrire un post LinkedIn",
      "Affûte mon pitch en une phrase",
      "Quels canaux pour démarrer sans budget ?",
    ],
  },
  "/contrat": {
    title: "Contrats",
    blurb: "Cadrez vos prestations par écrit.",
    agent: "juriste",
    suggestions: [
      "Quelles clauses sont indispensables ?",
      "Faut-il demander un acompte ?",
      "Comment limiter ma responsabilité ?",
    ],
  },
  "/cv": {
    title: "CV",
    blurb: "Valorisez votre parcours et vos compétences.",
    agent: "communicant",
    suggestions: [
      "Comment structurer mon CV ?",
      "Comment présenter une reconversion ?",
      "Quelles compétences mettre en avant ?",
    ],
  },
  "/agenda": {
    title: "Agenda",
    blurb: "Organisez votre semaine.",
    agent: "nova",
    suggestions: [
      "Comment prioriser ma semaine ?",
      "Quand bloquer du temps pour la prospection ?",
      "Quelles sont mes prochaines échéances ?",
    ],
  },
  "/documents": {
    title: "Documents",
    blurb: "Centralisez vos pièces.",
    agent: "nova",
    suggestions: [
      "Quels documents préparer pour la banque ?",
      "Comment organiser mes pièces administratives ?",
    ],
  },
  "/simulation": {
    title: "Simulation",
    blurb: "Testez une décision auprès d'un panel de personas.",
    agent: "strategist",
    suggestions: [
      "Comment fonctionne la simulation ?",
      "Quelle décision vaut la peine d'être testée ?",
    ],
  },
  "/settings": {
    title: "Réglages",
    blurb: "Configurez votre profil, Telegram et le moteur IA.",
    agent: "technicien",
    suggestions: [
      "Comment connecter mon bot Telegram ?",
      "Comment utiliser ma propre clé IA (BYOK) ?",
      "Où changer la couleur d'accent ?",
    ],
  },
};

// Recherche l'aide de l'écran : correspondance exacte, sinon préfixe le plus long.
export function helpForPath(pathname: string): PageHelp {
  if (PAGE_HELP[pathname]) return PAGE_HELP[pathname];
  const match = Object.keys(PAGE_HELP)
    .filter((k) => k !== "/" && pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PAGE_HELP[match] : GENERIC;
}
