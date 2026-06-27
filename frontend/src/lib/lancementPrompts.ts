// Prompts des modules "Lancement" — repris du Nova Solo v1 (HTML), adaptés au
// proxy ai-proxy (OpenRouter). Le persona est porté par `agent` ; le contenu
// métier + le rôle spécifique vivent dans le message utilisateur.
import type { Profile } from "@/types";

export function profileContext(p: Profile | null): string {
  if (!p) return "Profil non renseigné.";
  const lines = [
    `Personne : ${p.name ?? "—"}`,
    `Marque : ${p.brand_name ?? "—"}`,
    `Domaine : ${p.domaine ?? "—"}`,
    `Situation : ${p.situation ?? "—"}`,
    `Localisation : ${[p.ville, p.canton].filter(Boolean).join(", ") || "Suisse romande"}`,
    p.pricing_tarif ? `Tarif indicatif : CHF ${p.pricing_tarif}` : "",
    p.is_laci ? "Statut : demandeur d'emploi LACI (ORP)" : "",
  ].filter(Boolean);
  return lines.join("\n");
}

// ── Bio / personal branding (Communicant) ──
export function promptBio(bio: string): string {
  return `Tu es un expert en personal branding pour indépendants en Suisse romande. Améliore cette biographie pour la rendre plus percutante, personnelle et orientée client. Garde le ton authentique, première personne, 120-150 mots maximum. Réponds uniquement avec la bio améliorée. Biographie actuelle : ${bio}`;
}

// ── Offre & Pricing (Financier) ──
export function promptPricing(p: Profile | null, offre: string): string {
  return `${profileContext(p)}\n\nTu es un expert en tarification de services pour indépendants en Suisse romande. À partir de l'offre décrite, propose une grille tarifaire cohérente (3 paliers si pertinent : essai/découverte → standard → premium), en CHF, avec justification de la valeur perçue, ancrage marché suisse romand, gestion de la TVA suisse (8.1%) et alerte sur le seuil d'assujettissement de 100'000 CHF. Évite le sous-pricing. Offre : ${offre}`;
}

// ── CV (Communicant) ──
export function promptCvGenerate(
  p: Profile | null,
  fields: { profil: string; skills: string; exp: string; formation: string; langues: string },
): string {
  return `${profileContext(p)}\n\nTu es expert CV Optimizer Suisse romande. Génère un CV complet pour ${p?.name ?? "le candidat"}. Règles : verbes d'action forts (Piloté, Développé), structure CAR, résultats chiffrés CHF/%, ATS-friendly, fr-CH. PROFIL : ${fields.profil} | COMPÉTENCES : ${fields.skills} | EXPÉRIENCES : ${fields.exp} | FORMATION : ${fields.formation} | LANGUES : ${fields.langues} | Sections attendues : PROFIL | COMPÉTENCES CLÉS | EXPÉRIENCE | FORMATION | LANGUES`;
}

export function promptCvImprove(p: Profile | null, label: string, val: string): string {
  return `${profileContext(p)}\n\nTu es un expert CV Optimizer pour indépendants en Suisse romande. Usage : ${label}. Règles : verbes d'action forts (Piloté, Développé), structure CAR, résultats chiffrés CHF ou %, ATS-friendly, fr-CH. Réponds uniquement avec le texte amélioré. Texte à améliorer : ${val}`;
}

// ── Dossier de présentation (Communicant) — 4MAT + neuromarketing ──
export function promptDossier(p: Profile | null, bmcResume: string, pricing: string): string {
  return `${profileContext(p)}\n\nTu es un expert en rédaction de dossiers de présentation commerciale pour indépendants en Suisse romande. Rédige un dossier structuré selon la pédagogie 4MAT (POURQUOI / QUOI / COMMENT / ET SI) avec des leviers de neuromarketing (preuve sociale, rareté, bénéfices concrets). Inclure : résumé exécutif, proposition de valeur, offres et tarifs, déroulé d'accompagnement, appel à l'action. Contexte BMC : ${bmcResume || "—"}. Tarifs : ${pricing || "—"}. Ton : professionnel, chaleureux, suisse romand, sans anglicisme. Utilise des titres en MAJUSCULES pour les sections.`;
}

// ── Analyse BMC globale (Stratège) ──
export function promptBmcGlobal(p: Profile | null, canvasResume: string): string {
  return `${profileContext(p)}\n\nTu es un expert en Business Model Canvas. Analyse ce canvas complet d'un projet en Suisse romande et donne : une cohérence globale notée sur 10, 3 forces, 3 risques majeurs, 2 recommandations prioritaires. Sois concret et chiffré quand c'est possible.\n\nCanvas :\n${canvasResume}`;
}

// ── MirrorFisch — simulateur de réaction d'audience (Communicant) ──
export function promptMirrorFisch(persona: string, message: string): string {
  return `Tu es MirrorFisch, un simulateur de réaction d'audience pour le marketing. Analyse ce message marketing du point de vue d'un·e "${persona}". Donne : (1) Probabilité de conversion estimée (ex: 24%), (2) Score d'engagement sur 100 (ex: 67/100), (3) Ce qui attire ou repousse ce persona dans le message, (4) Une suggestion d'amélioration en 1 phrase. Message : "${message}"`;
}

// ── Marketing & Visibilité (Communicant) ──
export function promptMarketingPost(p: Profile | null, format: string, sujet: string): string {
  return `${profileContext(p)}\n\nTu es un expert en personal branding et contenu LinkedIn pour indépendants en Suisse romande. Rédige un contenu au format « ${format} » sur le sujet : ${sujet}. Règles : accroche forte dès la 1re ligne, ton authentique à la première personne, valeur concrète et actionnable, un seul appel à l'action doux à la fin, fr-CH sans anglicisme, 150-220 mots, 2-3 hashtags pertinents en fin de post. Termine par 2 variantes d'accroche alternatives à tester (préfixées « Variante A : » et « Variante B : »).`;
}

export function promptEditorialIdeas(p: Profile | null): string {
  return `${profileContext(p)}\n\nTu es un stratège de contenu pour indépendants en Suisse romande. Propose un calendrier éditorial de 6 idées de contenu LinkedIn réparties sur les 4 prochaines semaines, adaptées à ce profil et à sa cible. Pour chaque idée : un format (Témoignage, Conseil, Carrousel, Question, Coulisses, Étude de cas), un titre accrocheur, et l'objectif marketing visé (notoriété, engagement, conversion, autorité).\n\nRéponds UNIQUEMENT en JSON valide : {"ideas":[{"semaine":"S1","format":"...","titre":"...","objectif":"..."}]}`;
}

export function promptPortfolioCase(p: Profile | null): string {
  return `${profileContext(p)}\n\nTu es un expert en preuve sociale et copywriting pour indépendants en Suisse romande. Génère une étude de cas (portfolio) professionnelle et crédible pour ${p?.name ?? "le prestataire"} (${p?.domaine ?? "coaching"}). Structure obligatoire : (1) Situation AVANT d'un client fictif mais plausible en Suisse romande, (2) Travail réalisé en 4 étapes type, (3) Résultat APRÈS quantifié (poste obtenu, +X CHF, délai, clarté), (4) Témoignage client authentique entre guillemets avec prénom et secteur. Langue : fr-CH. Ton : authentique, sobre, sans superlatifs creux. Précise discrètement qu'il s'agit d'un exemple illustratif à remplacer par un cas réel.`;
}

// ── Contrat de prestation (Juriste) ──
export function promptContrat(p: Profile | null, type: string, duree: string): string {
  return `${profileContext(p)}\n\nTu es un juriste spécialisé droit suisse des obligations (CO). Rédige un contrat type de prestation de services pour un indépendant en Suisse romande. Type : ${type}. Durée : ${duree}. Contenu obligatoire : identité des parties, description de la prestation, tarifs et modalités de paiement, conditions de résiliation (30 jours), clause de confidentialité, propriété intellectuelle, limitation de responsabilité, mention nLPD, for juridique du canton, droit suisse applicable. Format : texte structuré avec articles numérotés. Ajoute un disclaimer : ce document est un modèle indicatif à faire valider par un avocat.`;
}

// ── Vision symbolique (coach systémique) ──
export const SYM_QUESTIONS = [
  "Si votre projet était un animal, lequel serait-il et pourquoi ?",
  "Quelle transformation profonde souhaitez-vous offrir à vos clients ?",
  "Quel impact voulez-vous avoir dans 5 ans ?",
] as const;

export function promptSymbolicIntake(answers: string[]): string {
  return `Tu es un coach systémique (style Patrick Beiner : direct, ancré, bienveillant, tutoiement).
À partir des 3 réponses de l'entrepreneur :
1. Animal / représentation du projet : ${answers[0] ?? ""}
2. Transformation souhaitée pour les clients : ${answers[1] ?? ""}
3. Impact dans 5 ans : ${answers[2] ?? ""}

Génère :
- UNE métaphore centrale (2-3 phrases, mémorable, ancrée dans les 3 réponses, langage accessible)
- Un plan d'action concret en 5 étapes bimensuelles (12 semaines), chaque étape = 1 phrase d'action

Réponds UNIQUEMENT en JSON valide : {"metaphore":"...","plan":["Semaine 1-2 : ...","Semaine 3-4 : ...","Semaine 5-6 : ...","Semaine 7-8 : ...","Semaine 9-12 : ..."]}`;
}

export function promptSymbolicTable(p: Profile | null, answers: string[], metaphore: string): string {
  return `${profileContext(p)}\n\nTu es un coach systémique. Observe les relations du projet et compose une CARTOGRAPHIE SYMBOLIQUE (tableau de modélisation systémique).
Contexte symbolique :
- Animal : ${answers[0] ?? ""}
- Transformation : ${answers[1] ?? ""}
- Impact 5 ans : ${answers[2] ?? ""}
- Métaphore : ${metaphore}

Produis 6 à 9 symboles (nodes), leurs relations (links), une lecture systémique et 3 questions déstabilisantes.
Chaque "kind" ∈ {cap, offre, levier, frein, client, prescripteur, ressource, vision}.
Le symbole éclaire — il ne prouve rien : ton direct, ancré, bienveillant.

Réponds UNIQUEMENT en JSON valide :
{"nodes":[{"label":"...","kind":"cap","note":"..."}],"links":[{"from":"label source","to":"label cible","relation":"..."}],"lecture":"3-5 phrases","questions":["...","...","..."]}`;
}
