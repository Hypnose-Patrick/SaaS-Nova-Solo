// Deck compact « Oracle animal business » pour la carte du jour mobile.
// Repris des animaux de pages/Oracle.tsx (champs utiles au format court).
// NOTE : duplication temporaire — à dédupliquer avec Oracle.tsx une fois celui-ci
// finalisé (extraire ce deck comme source unique).

export interface OracleAnimal {
  emoji: string;
  label: string;
  kw: string[];    // mots-clés (meaning)
  punch: string;   // punchline courte (mobile)
  tip: string;     // message central
  defi: string;    // action concrète du jour
}

export const ORACLE_ANIMALS: OracleAnimal[] = [
  { emoji: "🦅", label: "Aigle", kw: ["Vision", "Stratégie", "Hauteur"], punch: "Vois grand, décide net.", tip: "Prends de la hauteur avant de trancher.", defi: "Écris en une phrase où tu veux être dans 90 jours, puis raye tout ce qui n'y contribue pas cette semaine." },
  { emoji: "🐻", label: "Ours", kw: ["Force", "Protection", "Guérison"], punch: "Protège ton énergie.", tip: "Ta force vient de tes limites, pas de ton endurance.", defi: "Identifie une demande ou un client qui draine ton énergie et pose une limite claire aujourd'hui." },
  { emoji: "🐺", label: "Loup", kw: ["Loyauté", "Clan", "Instinct"], punch: "Active ta meute.", tip: "Tu n'es pas fait pour chasser seul.", defi: "Contacte aujourd'hui une personne de ton réseau, sans rien vendre — juste pour nourrir le lien." },
  { emoji: "🦉", label: "Hibou", kw: ["Clarté", "Intuition", "Signaux faibles"], punch: "Observe, puis tranche.", tip: "Regarde ce qui n'est pas encore visible.", defi: "Écris 3 hypothèses sur ta situation et teste la plus simple avant demain soir." },
  { emoji: "🐦‍⬛", label: "Corbeau", kw: ["Transformation", "Intelligence", "Créativité"], punch: "Transforme l'obstacle.", tip: "Ce qui semble une fin est un matériau de construction.", defi: "Prends ton plus gros problème actuel et liste 3 façons de le transformer en offre ou en contenu." },
  { emoji: "🐢", label: "Tortue", kw: ["Patience", "Structure", "Durée"], punch: "Avance chaque jour.", tip: "Lent et régulier construit ce que rapide et brillant détruit.", defi: "Choisis une action minuscule que tu peux répéter chaque jour pendant 30 jours, et fais-la maintenant." },
  { emoji: "🦬", label: "Bison", kw: ["Abondance", "Endurance", "Gratitude"], punch: "Exploite tes acquis.", tip: "Tu as déjà plus de ressources que tu ne le crois.", defi: "Liste 5 actifs que tu sous-exploites (contenus, contacts, compétences) et choisis-en un à réactiver." },
  { emoji: "🦌", label: "Cerf", kw: ["Sensibilité", "Élégance", "Vigilance"], punch: "Écoute finement.", tip: "Ta sensibilité est un instrument de mesure, pas une faiblesse.", defi: "Rappelle un client récent et pose-lui une seule question : « Qu'est-ce qui t'a le plus aidé ? » Écoute sans vendre." },
  { emoji: "🐟", label: "Saumon", kw: ["Persévérance", "Cycle", "Retour à la source"], punch: "Reviens à l'essentiel.", tip: "Remonte à la source de pourquoi tu as commencé.", defi: "Relis ta toute première présentation de ton activité et note ce qui est resté vrai." },
  { emoji: "🦫", label: "Castor", kw: ["Construction", "Méthode", "Persévérance"], punch: "Systématise une chose.", tip: "Construis le système, pas seulement le résultat.", defi: "Identifie une tâche que tu as faite 3 fois ce mois et documente-la ou automatise-la aujourd'hui." },
  { emoji: "🦦", label: "Loutre", kw: ["Joie", "Curiosité", "Créativité"], punch: "Teste en jouant.", tip: "Le jeu est une méthode de travail sérieuse.", defi: "Lance aujourd'hui un micro-test sans enjeu : un post, un sondage, un format inédit. Juste pour voir." },
  { emoji: "🐕", label: "Coyote", kw: ["Ruse", "Humour", "Adaptation"], punch: "Improvise malin.", tip: "Le plan parfait n'existe pas, l'adaptation oui.", defi: "Prends un obstacle actuel et trouve la solution la moins chère et la plus rapide, même imparfaite." },
  { emoji: "🦅", label: "Faucon", kw: ["Observation", "Précision", "Rapidité"], punch: "Vise une cible.", tip: "Une cible, un piqué, pas de dispersion.", defi: "Choisis UNE cible client précise et adresse-lui un message dédié aujourd'hui — un seul." },
  { emoji: "🐍", label: "Serpent", kw: ["Transformation", "Mue", "Guérison"], punch: "Laisse partir l'ancien.", tip: "Ce que tu quittes te serrait déjà trop.", defi: "Nomme une chose de ton activité qui appartient à ton ancienne version, et décide de sa date de fin." },
  { emoji: "🐎", label: "Cheval", kw: ["Liberté", "Énergie", "Mouvement"], punch: "Lance-toi maintenant.", tip: "L'élan compte plus que la perfection du départ.", defi: "Annonce publiquement quelque chose aujourd'hui : une offre, une date, une intention." },
  { emoji: "🦊", label: "Renard", kw: ["Astuce", "Discrétion", "Intelligence pratique"], punch: "Cherche le passage caché.", tip: "Il y a toujours un passage que les autres ne voient pas.", defi: "Trouve une manière détournée d'atteindre un objectif bloqué : qui pourrait t'ouvrir la porte à ta place ?" },
  { emoji: "🐕‍🦺", label: "Chien", kw: ["Fidélité", "Protection", "Compagnie"], punch: "Soigne tes fidèles.", tip: "La confiance se construit par la constance, pas par l'éclat.", defi: "Fais aujourd'hui un geste gratuit pour un client fidèle : une ressource, un conseil, un merci sincère." },
  { emoji: "🐈", label: "Chat", kw: ["Indépendance", "Intuition", "Autonomie"], punch: "Suis ton rythme.", tip: "Ton rythme n'a pas à ressembler à celui des autres.", defi: "Supprime de ton agenda une obligation que tu t'imposes par mimétisme, pas par utilité." },
  { emoji: "🐆", label: "Puma", kw: ["Leadership", "Assurance", "Présence"], punch: "Assume ta place.", tip: "Ta présence décide avant tes mots.", defi: "Reprends un texte de vente ou un tarif et enlève toutes les justifications. Affirme, point." },
  { emoji: "🐦", label: "Colibri", kw: ["Légèreté", "Cœur", "Vitalité"], punch: "Nourris ta joie.", tip: "Fais ta part, avec joie, sans porter le monde.", defi: "Bloque 30 minutes aujourd'hui pour la partie de ton travail qui te met en joie. Sans culpabilité." },
];
