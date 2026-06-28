import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useUserStore } from "@/stores/useUserStore";
import { useAiGen, MODEL_REASONING } from "@/lib/useAiGen";
import { callAIStream } from "@/lib/ai";
import { loadLocal, saveLocal } from "@/lib/local";

// ── CDN Audio (Bunny.net) ──────────────────────────────────────────────────────
// Set to your Bunny.net CDN base URL ending with "/" to enable audio
// e.g. "https://yourzone.b-cdn.net/goban/"
// Files expected: welcome-debutant.mp3, welcome-intermediaire.mp3, welcome-expert.mp3
//   fb-debutant-1..3.mp3, fb-inter-1..2.mp3, fb-expert-1.mp3
//   endgame-noir.mp3, endgame-blanc.mp3, endgame-egal.mp3, rule-0..5.mp3
const BUNNY_BASE = "https://nova-solo.b-cdn.net/";

// ── Constants ──────────────────────────────────────────────────────────────────
const BOARD_SIZES = [9, 13, 19] as const;
type BoardSize = (typeof BOARD_SIZES)[number];
const COLS = "ABCDEFGHJKLMNOPQRST";
const HOSHI: Record<BoardSize, [number, number][]> = {
  9: [[2,2],[2,6],[6,2],[6,6],[4,4]],
  13: [[3,3],[3,9],[9,3],[9,9],[6,6],[3,6],[6,3],[9,6],[6,9]],
  19: [[3,3],[3,9],[3,15],[9,3],[9,9],[9,15],[15,3],[15,9],[15,15]],
};
const CELL = 40;
const MARGIN = 26;
type Stone = "B" | "W" | null;
type Screen = "intro" | "setup" | "game" | "end" | "rules" | "diagnostic";
type CoachLevel = "debutant" | "intermediaire" | "expert";
type CareerMode = "oui" | "non";
type GameMode = "solo" | "2p";

interface Move { row: number; col: number; color: Stone; label: string; num: number }
interface BubbleData { who: "victor" | "user" | "system"; text: string; id: number }
interface DiagResponse { question: string; answer: "Oui" | "Non"; concept: string | null; isBlack: boolean | null }

// ── System Prompts ─────────────────────────────────────────────────────────────
function buildSystemPrompt(level: CoachLevel, size: BoardSize, career: CareerMode): string {
  const lvlMap: Record<CoachLevel, string> = {
    debutant: "NIVEAU 1 — Débutant",
    intermediaire: "NIVEAU 2 — Intermédiaire",
    expert: "NIVEAU 3 — Avancé",
  };
  const careerBridge = career === "oui" ? `\n\n<goban_career_bridge>
Fais des ponts discrets et naturels (maximum 1 par séance) :
- Territoire = poste ou domaine de compétence acquis
- Influence = réputation, réseau, rayonnement
- Épaisseur = compétences solides qui résistent à la pression
- Aji = potentiel latent, compétences dormantes
- Sente = initiative, proactivité
- Gote = réactivité, subir le marché
- Sacrifice = quitter un poste/titre pour rebondir plus fort
- Whole board thinking = vision systémique de sa carrière
Ne force jamais ces métaphores. Un pont par séance suffit.
</goban_career_bridge>` : "";

  return `<system_role>
Tu es Victor, un instructeur de Go patient, exigeant et pédagogue. Tu enseignes le Go depuis 20 ans, des débutants absolus aux joueurs de club. Tu es aussi le guide officiel de la méthode "Le Goban de Carrière", qui utilise les concepts du Go comme métaphores de développement professionnel.
</system_role>

<session_context>
Niveau du joueur : ${lvlMap[level]}
Taille du goban : ${size}×${size}
Mode Goban de Carrière : ${career === "oui" ? "OUI — faire des ponts discrets avec la métaphore carrière" : "NON — rester sur le jeu pur"}
</session_context>

<tone>
Parle en français clair et chaleureux. Tutoie le joueur. Sois encourageant mais ne laisse passer aucune grosse erreur sans l'examiner. Chaque "mauvais" coup est une opportunité d'apprentissage. Félicite les bons coups explicitement.
</tone>

<structure_per_turn>
Pour chaque coup du joueur, réponds TOUJOURS avec cette structure exacte :

**Coup reçu**
[Brève appréciation du coup en 1-2 phrases${level === "expert" ? " + estimation de l'impact territorial (ex: +2 pts Noir)" : ""}]

**Question d'intention**
[Une question sur ce qu'il visait avec ce coup]

**Mon coup**
[Si mode solo : indique ta pierre. Si mode 2 joueurs : commente la position sans jouer.]

**Conseil / Stratégie**
[1 stratégie adaptée au niveau avec son nom si niveau 2+. Max 3 phrases.]

**Question de réflexion**
[Une question orientant le prochain coup]

Maximum 5 paragraphes par réponse. Ne jamais faire de pavé de texte.${level === "debutant" ? "\nLONGUEUR : 2-3 phrases maximum par section, vocabulaire du quotidien, pas de termes japonais." : ""}
</structure_per_turn>

<levels>
${level === "debutant" ? `NIVEAU 1 — Débutant :
- Rappelle les règles si nécessaire (libertés, capture, ko, territoire).
- Utilise des analogies du quotidien. Évite les termes japonais complexes.
- Focus : coins, bords, centre ; ne pas jouer trop serré ; éviter de sauver chaque pierre.` : ""}${level === "intermediaire" ? `NIVEAU 2 — Intermédiaire :
- Introduis les termes japonais : sente, gote, aji, influence, épaisseur, joseki.
- Joue à 75% de tes capacités. Laisse des opportunités, punit les fautes grossières.
- Focus : ouverture, formes, lecture à 3 coups, sacrifice, fin de partie.` : ""}${level === "expert" ? `NIVEAU 3 — Avancé :
- Utilise librement le vocabulaire technique (sabaki, moyo, reduction, aji keshi, thickness, direction of play).
- Joue sérieusement. Donne des coups de club.
- Focus : timing, lecture approfondie, whole board thinking, gestion des faiblesses, yose.` : ""}
</levels>

<strategies_bank>
Classiques : Enclosure, Approach and pincer, Two-space extension, Reduction, Invasion.
Moins connues : "L'aikido stratégique" (céder un coin pour l'initiative globale), "La théorie des deux faiblesses" (deux groupes faibles meurent), "Sacrifice actif" (abandonner des pierres pour une forme forte), "Jeu d'aji" (ne pas tout clarifier, garder des options), "Dual purpose move" (attaque ET défend simultanément).
Jamais plus de 2 stratégies à la fois.
</strategies_bank>${careerBridge}

<restrictions>
- Ne joue jamais à 100% contre un débutant.
- Maximum 2-3 options de coups simultanément.
- 3-5 paragraphes maximum par tour.
- Ne confonds jamais le Go avec les échecs ou un autre jeu.
- Guide par les questions, ne donne pas la réponse immédiatement.
</restrictions>`;
}

function buildDiagSystemPrompt(): string {
  return `Tu es Victor, guide expert de la méthode "Le Goban de Carrière". Tu utilises exclusivement les concepts du Go comme métaphores du développement professionnel et entrepreneurial. Français, tutoiement, précis et encourageant.`;
}

// ── Game logic (pure functions) ────────────────────────────────────────────────
function neighbors(r: number, c: number, size: number): [number, number][] {
  const ns: [number, number][] = [];
  if (r > 0) ns.push([r-1, c]);
  if (r < size-1) ns.push([r+1, c]);
  if (c > 0) ns.push([r, c-1]);
  if (c < size-1) ns.push([r, c+1]);
  return ns;
}

function findGroup(board: Stone[][], r: number, c: number): [number, number][] {
  const color = board[r][c];
  if (!color) return [];
  const vis = new Set<number>();
  const stack: [number, number][] = [[r, c]];
  const size = board.length;
  while (stack.length) {
    const [cr, cc] = stack.pop()!;
    const k = cr * 100 + cc;
    if (vis.has(k)) continue;
    vis.add(k);
    neighbors(cr, cc, size).forEach(([nr, nc]) => {
      if (board[nr][nc] === color && !vis.has(nr * 100 + nc)) stack.push([nr, nc]);
    });
  }
  return Array.from(vis).map((k) => [Math.floor(k / 100), k % 100] as [number, number]);
}

function groupLiberties(board: Stone[][], group: [number, number][]): number {
  const size = board.length;
  const libs = new Set<number>();
  group.forEach(([r, c]) => {
    neighbors(r, c, size).forEach(([nr, nc]) => {
      if (!board[nr][nc]) libs.add(nr * 100 + nc);
    });
  });
  return libs.size;
}

function removeCaptures(board: Stone[][], opp: Stone): number {
  let total = 0;
  const size = board.length;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === opp) {
        const g = findGroup(board, r, c);
        if (groupLiberties(board, g) === 0) {
          g.forEach(([gr, gc]) => { board[gr][gc] = null; });
          total += g.length;
        }
      }
    }
  }
  return total;
}

function estimateScore(board: Stone[][], captures: Record<"B" | "W", number>): { B: number; W: number } {
  const size = board.length;
  let bT = 0, wT = 0;
  const vis = new Set<number>();
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!board[r][c] && !vis.has(r * 100 + c)) {
        const region: [number, number][] = [];
        const borders = new Set<Stone>();
        const stack: [number, number][] = [[r, c]];
        while (stack.length) {
          const [cr, cc] = stack.pop()!;
          const k = cr * 100 + cc;
          if (vis.has(k)) continue;
          vis.add(k);
          region.push([cr, cc]);
          neighbors(cr, cc, size).forEach(([nr, nc]) => {
            if (!board[nr][nc]) stack.push([nr, nc]);
            else borders.add(board[nr][nc]);
          });
        }
        if (borders.size === 1) {
          if (borders.has("B")) bT += region.length;
          else wT += region.length;
        }
      }
    }
  }
  return { B: bT + (captures["B"] ?? 0), W: wT + (captures["W"] ?? 0) };
}

// ── Fallback responses ────────────────────────────────────────────────────────
const FALLBACKS: Record<CoachLevel, string[]> = {
  debutant: [
    "**Coup reçu**\nBon coup pour explorer le plateau.\n\n**Question d'intention**\nQu'est-ce que tu cherchais : du territoire ou de l'influence ?\n\n**Mon coup**\nJe continue ma construction dans le coin.\n\n**Conseil / Stratégie**\nRetiens : \"coins d'abord, bords ensuite, centre en dernier\". Les coins demandent moins de pierres pour former du territoire.\n\n**Question de réflexion**\nOù penses-tu que le prochain territoire contesté va s'ouvrir ?",
    "**Coup reçu**\nIntéressant ! Tu t'approches de ma position.\n\n**Question d'intention**\nVoulais-tu m'attaquer ou simplement te développer ?\n\n**Mon coup**\nJe renforce mon groupe pour rester solide.\n\n**Conseil / Stratégie**\nQuand tu approches une pierre adverse, pense toujours à l'étape d'après : si elle répond, où joues-tu ensuite ?\n\n**Question de réflexion**\nEst-ce que tes pierres sont toutes connectées ou as-tu des groupes isolés ?",
    "**Coup reçu**\nTu joues en bordure. C'est parfois utile pour sécuriser, parfois trop défensif.\n\n**Question d'intention**\nEst-ce que tu sécurisais un territoire ou tu répondais à une menace ?\n\n**Mon coup**\nJe vais développer mon influence au centre.\n\n**Conseil / Stratégie**\nLe centre vaut moins de points directement, mais une forte influence au centre peut étouffer l'adversaire plus tard.\n\n**Question de réflexion**\nRegarde le plateau entier — où est le plus grand espace non encore réclamé ?",
  ],
  intermediaire: [
    "**Coup reçu**\nCoup intéressant. Tu gardes de l'aji dans cette zone.\n\n**Question d'intention**\nEst-ce un coup sente ou acceptes-tu le gote pour consolider ?\n\n**Mon coup**\nJe prends l'initiative en développant mon moyo.\n\n**Conseil / Stratégie**\nLe jeu d'aji : ne résous pas toutes les tensions immédiatement. Garde des options ouvertes — chaque clarification prématurée est une perte de potentiel.\n\n**Question de réflexion**\nSi je joue ici maintenant, quelle est ta meilleure réponse en termes d'initiative ?",
    "**Coup reçu**\nBonne lecture locale. Mais es-tu attentif à la position globale ?\n\n**Question d'intention**\nCe coup est-il le plus urgent sur le goban entier ?\n\n**Mon coup**\nJe joue là où l'influence est maximale.\n\n**Conseil / Stratégie**\n\"Deux groupes faibles meurent\" : si tu as deux groupes qui demandent de l'attention simultanément, tu vas perdre l'initiative partout.\n\n**Question de réflexion**\nQuel est le groupe le plus vulnérable sur le goban en ce moment — le tien ou le mien ?",
  ],
  expert: [
    "**Coup reçu**\nCoup subtil. Tu maintiens la pression sur mes libertés tout en gardant la sente.\n\n**Question d'intention**\nQuelle était ta lecture à 5 coups en jouant là ?\n\n**Mon coup**\nJe réponds en jouant le sabaki pour alléger.\n\n**Conseil / Stratégie**\nLe whole board thinking : ce coup local change-t-il le centre de gravité de la partie ? L'avantage s'est-il déplacé vers le nord ou le sud du plateau ?\n\n**Question de réflexion**\nOù est le coup le plus lourd en termes de points sur le goban entier maintenant ?",
  ],
};

// ── Diagnostic questions ───────────────────────────────────────────────────────
const DIAG_QUESTIONS = [
  { q: "As-tu au moins 1 client récurrent qui paie chaque mois ?", ctx: "Territoire — revenus sécurisés", yesBlack: true, yesConcept: "Territoire sécurisé", noConcept: "Territoire manquant" },
  { q: "Ton revenu dépend-il d'un seul client ou d'une seule source ?", ctx: "Groupe faible — dépendance critique", yesBlack: false, yesConcept: "Tsume-Go — 1 seul œil", noConcept: "Sources diversifiées" },
  { q: "As-tu une offre clairement formulée en 1 phrase ?", ctx: "Épaisseur — clarté de l'offre", yesBlack: true, yesConcept: "Offre solide", noConcept: "Offre floue" },
  { q: "As-tu un processus de vente répétable (un Joseki commercial) ?", ctx: "Joseki — séquence validée", yesBlack: true, yesConcept: "Joseki validé", noConcept: "Pas encore de Joseki" },
  { q: "As-tu une audience ou un réseau qui te génère des opportunités spontanément ?", ctx: "Influence — rayonnement et réseau", yesBlack: true, yesConcept: "Influence active", noConcept: "Influence à construire" },
  { q: "As-tu testé ton offre sur au moins 3 profils clients différents ?", ctx: "Validation — hypothèses confrontées au marché", yesBlack: true, yesConcept: "Validation confirmée", noConcept: "Hypothèse non testée" },
  { q: "As-tu une compétence clé difficile à copier par la concurrence ?", ctx: "Épaisseur — différenciation durable", yesBlack: true, yesConcept: "Différenciation solide", noConcept: "Différenciation floue" },
  { q: "As-tu un groupe faible visible — une dépendance ou hypothèse non testée ?", ctx: "Groupe faible — fragilité structurelle", yesBlack: false, yesConcept: "Groupe faible détecté", noConcept: "Base solide" },
  { q: "As-tu une opportunité dormante (Aji) — un marché ou partenariat pas encore activé ?", ctx: "Aji — potentiel latent non joué", yesBlack: true, yesConcept: "Aji identifié", noConcept: null },
  { q: "As-tu fait une revue de partie récente sur ta dernière action importante ?", ctx: "Revue de partie — apprentissage continu", yesBlack: true, yesConcept: "Apprentissage actif", noConcept: "Revue à instaurer" },
];

// ── Rules content ──────────────────────────────────────────────────────────────
const RULES: { title: string; body: string; careerNote: string }[] = [
  {
    title: "L'objectif du Go",
    body: "Le Go se joue sur un goban — une grille de 19×19 intersections (ou 13×13 / 9×9 pour débuter). On place des pierres sur les intersections, pas dans les cases ! Noir joue en premier. Les pierres ne bougent jamais une fois posées. Le but : délimiter plus de territoire que l'adversaire. Le territoire, c'est l'espace vide entouré par tes pierres.",
    careerNote: "En Goban de Carrière, le territoire représente tes domaines de compétence acquis et sécurisés. Chaque zone où personne d'autre ne peut t'atteindre est du territoire pur.",
  },
  {
    title: "Poser les pierres",
    body: "Les coins sont les zones les plus économiques à occuper (2 bords naturels à défendre au lieu de 4). Les bords sont seconds (1 bord naturel). Le centre demande le plus de pierres pour former du territoire mais crée de l'influence. La règle d'or : ① coins, ② bords, ③ centre.",
    careerNote: "Sente (initiative) = tu joues là où l'adversaire DOIT répondre. Gote = tu réponds aux menaces. En carrière : prendre la sente, c'est être proactif sur le marché plutôt que de réagir.",
  },
  {
    title: "Les libertés",
    body: "Chaque pierre a des libertés — les intersections vides adjacentes. Une pierre au centre a 4 libertés, en bord 3, en coin 2. Un groupe de pierres connectées partage ses libertés. Quand un groupe n'a plus aucune liberté, il est capturé et retiré du plateau. Plus un groupe est grand et bien formé, plus il est difficile à tuer.",
    careerNote: "L'épaisseur en Go = un groupe avec beaucoup de libertés, difficile à attaquer. En carrière : tes compétences diversifiées et ton réseau sont ton épaisseur — ils t'évitent d'être vulnérable.",
  },
  {
    title: "Captures & Atari",
    body: "Un groupe réduit à 1 seule liberté est en \"Atari\" — en danger immédiat. Si l'adversaire joue sur cette dernière liberté, le groupe est capturé. Un groupe vivant possède 2 \"yeux\" (espaces internes que l'adversaire ne peut pas occuper simultanément) — il est immortel. Un groupe avec 1 seul œil peut toujours être tué.",
    careerNote: "Un groupe faible en Go = une dépendance critique dans ta carrière. Un seul client qui paie 80% de ton CA, c'est un groupe avec 1 liberté. L'Atari arrive quand ce client menace de partir.",
  },
  {
    title: "Ko & Seki",
    body: "Le Ko est une règle anti-répétition : si tu captures une pierre qui vient d'en capturer une, tu dois d'abord jouer ailleurs. Cette règle évite les cycles infinis. Le Seki est une position d'équilibre où deux groupes adverses vivent ensemble — aucun ne peut jouer sans se mettre en danger. Les deux survivent sans se compter de territoire.",
    careerNote: "Le Ko en carrière : une négociation qui tourne en boucle. La règle du Ko dit qu'il faut jouer ailleurs (créer une autre opportunité) avant de revenir au point de tension.",
  },
  {
    title: "Fin de partie & Score",
    body: "La partie se termine quand les deux joueurs passent consécutivement (plus rien à jouer). On compte : territoire vide entouré + prisonniers capturés. Blanc reçoit 6,5 points de komi (compensation d'avoir joué en second). La revue de partie (commentaire des coups clés après la fin) est la pratique la plus formatrice au Go.",
    careerNote: "La revue de partie = le bilan post-mission ou post-trimestre. Les joueurs de Go les plus forts passent autant de temps à analyser leurs parties qu'à en jouer. C'est le levier n°1 de progression.",
  },
];

// ── Rule SVG Diagrams ──────────────────────────────────────────────────────────
const DC = 26, DM = 16;
function dp(i: number) { return DM + i * DC; }
const DW = DM * 2 + 6 * DC;

function RuleGrid() {
  return (
    <>
      <rect width={DW} height={DW} fill="#DCB483" rx={4} />
      {Array.from({ length: 7 }, (_, i) => (
        <g key={i}>
          <line x1={dp(i)} y1={dp(0)} x2={dp(i)} y2={dp(6)} stroke="#5C3D0A" strokeWidth={0.8} />
          <line x1={dp(0)} y1={dp(i)} x2={dp(6)} y2={dp(i)} stroke="#5C3D0A" strokeWidth={0.8} />
        </g>
      ))}
    </>
  );
}

function BS({ r, c, color }: { r: number; c: number; color: "B" | "W" }) {
  return (
    <circle cx={dp(c)} cy={dp(r)} r={10}
      fill={color === "B" ? "#0d0d0d" : "#f0efe8"}
      stroke={color === "W" ? "#999" : "none"} strokeWidth={0.8}
    />
  );
}

function RuleDiagram({ rule }: { rule: number }) {
  if (rule === 0) return ( // Territory
    <svg width={DW} height={DW} viewBox={`0 0 ${DW} ${DW}`} style={{ display: "block" }}>
      <RuleGrid />
      {/* Black wall */}
      {[[0,0],[1,0],[2,0],[3,0],[3,1],[3,2]].map(([r,c]) => <BS key={`${r}${c}`} r={r} c={c} color="B" />)}
      {/* White wall */}
      {[[0,6],[1,6],[2,6],[2,5],[2,4]].map(([r,c]) => <BS key={`${r}${c}`} r={r} c={c} color="W" />)}
      {/* Black territory shading */}
      <rect x={dp(0)+1} y={dp(0)+1} width={dp(2)-dp(0)-1} height={dp(2)-dp(0)-1} fill="rgba(0,180,80,0.22)" />
      {/* White territory shading */}
      <rect x={dp(3)+1} y={dp(0)+1} width={dp(5)-dp(3)-1} height={dp(1)-dp(0)-1} fill="rgba(100,100,255,0.18)" />
      <text x={dp(1)} y={dp(1)+4} textAnchor="middle" fontSize={9} fill="#064e20" fontWeight="bold">Terr. ⚫</text>
      <text x={dp(4)} y={dp(0)+12} textAnchor="middle" fontSize={9} fill="#222" fontWeight="bold">Terr. ⚪</text>
    </svg>
  );

  if (rule === 1) return ( // Placement priority
    <svg width={DW} height={DW} viewBox={`0 0 ${DW} ${DW}`} style={{ display: "block" }}>
      <RuleGrid />
      {/* Coin markers */}
      {[[0,0],[0,6],[6,0],[6,6]].map(([r,c]) => (
        <g key={`${r}${c}`}>
          <circle cx={dp(c)} cy={dp(r)} r={12} fill="rgba(197,165,114,0.3)" stroke="#B8860B" strokeWidth={1} />
          <text x={dp(c)} y={dp(r)+4} textAnchor="middle" fontSize={10} fill="#5C3D0A" fontWeight="bold">①</text>
        </g>
      ))}
      {/* Bord markers */}
      {[[0,3],[3,0],[3,6],[6,3]].map(([r,c]) => (
        <g key={`e${r}${c}`}>
          <circle cx={dp(c)} cy={dp(r)} r={10} fill="rgba(100,149,237,0.25)" stroke="#4169e1" strokeWidth={1} />
          <text x={dp(c)} y={dp(r)+4} textAnchor="middle" fontSize={9} fill="#1a3a8a" fontWeight="bold">②</text>
        </g>
      ))}
      {/* Centre marker */}
      <circle cx={dp(3)} cy={dp(3)} r={10} fill="rgba(255,99,71,0.25)" stroke="#cc3300" strokeWidth={1} />
      <text x={dp(3)} y={dp(3)+4} textAnchor="middle" fontSize={9} fill="#990000" fontWeight="bold">③</text>
    </svg>
  );

  if (rule === 2) return ( // Liberties
    <svg width={DW} height={DW} viewBox={`0 0 ${DW} ${DW}`} style={{ display: "block" }}>
      <RuleGrid />
      {/* Corner stone + 2 liberties */}
      <BS r={0} c={0} color="B" />
      <circle cx={dp(1)} cy={dp(0)} r={6} fill="none" stroke="#27ae60" strokeWidth={1.5} />
      <circle cx={dp(0)} cy={dp(1)} r={6} fill="none" stroke="#27ae60" strokeWidth={1.5} />
      <text x={dp(0)+2} y={dp(2)+4} textAnchor="middle" fontSize={8} fill="#27ae60">2 lib.</text>
      {/* Edge stone + 3 liberties */}
      <BS r={3} c={0} color="B" />
      {[[2,0],[4,0],[3,1]].map(([r,c]) => <circle key={`L2${r}${c}`} cx={dp(c)} cy={dp(r)} r={6} fill="none" stroke="#2980b9" strokeWidth={1.5} />)}
      <text x={dp(0)+2} y={dp(5)+4} textAnchor="middle" fontSize={8} fill="#2980b9">3 lib.</text>
      {/* Center stone + 4 liberties */}
      <BS r={3} c={4} color="B" />
      {[[2,4],[4,4],[3,3],[3,5]].map(([r,c]) => <circle key={`L3${r}${c}`} cx={dp(c)} cy={dp(r)} r={6} fill="none" stroke="#8e44ad" strokeWidth={1.5} />)}
      <text x={dp(4)} y={dp(5)+4} textAnchor="middle" fontSize={8} fill="#8e44ad">4 lib.</text>
    </svg>
  );

  if (rule === 3) return ( // Capture / Atari
    <svg width={DW} height={DW} viewBox={`0 0 ${DW} ${DW}`} style={{ display: "block" }}>
      <RuleGrid />
      {/* White group */}
      {[[2,2],[2,3],[3,2]].map(([r,c]) => <BS key={`W${r}${c}`} r={r} c={c} color="W" />)}
      {/* Black surrounding */}
      {[[1,2],[1,3],[2,1],[3,1],[4,2],[4,3],[2,4],[3,4],[3,3]].map(([r,c]) => <BS key={`B${r}${c}`} r={r} c={c} color="B" />)}
      {/* Last liberty highlighted */}
      <circle cx={dp(3)} cy={dp(3)} r={10} fill="rgba(255,0,0,0.2)" stroke="#cc0000" strokeWidth={1.5} strokeDasharray="3 2" />
      {/* Arrow */}
      <text x={dp(5)} y={dp(3)+4} textAnchor="middle" fontSize={9} fill="#cc0000" fontWeight="bold">Atari !</text>
      <line x1={dp(4)} y1={dp(3)} x2={dp(3)+11} y2={dp(3)} stroke="#cc0000" strokeWidth={1} markerEnd="url(#arrow)" />
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#cc0000" />
        </marker>
      </defs>
    </svg>
  );

  if (rule === 4) return ( // Ko
    <svg width={DW} height={DW} viewBox={`0 0 ${DW} ${DW}`} style={{ display: "block" }}>
      <RuleGrid />
      {/* Ko position */}
      {[[2,2],[2,4],[3,1],[4,2],[4,4],[3,5]].map(([r,c]) => <BS key={`K${r}${c}`} r={r} c={c} color="B" />)}
      {[[3,3],[2,3],[4,3],[3,2]].map(([r,c]) => <BS key={`KW${r}${c}`} r={r} c={c} color="W" />)}
      {/* Forbidden recapture */}
      <rect x={dp(3)-14} y={dp(3)-14} width={28} height={28} fill="rgba(255,0,0,0.12)" rx={4} />
      <text x={dp(3)} y={dp(3)+5} textAnchor="middle" fontSize={14}>⛔</text>
      <text x={dp(3)} y={dp(5)+4} textAnchor="middle" fontSize={8} fill="#cc0000">Interdit</text>
    </svg>
  );

  // rule === 5: Score
  return (
    <svg width={DW} height={DW} viewBox={`0 0 ${DW} ${DW}`} style={{ display: "block" }}>
      <RuleGrid />
      {/* Black territory */}
      <rect x={dp(0)+1} y={dp(0)+1} width={dp(2)-dp(0)-1} height={dp(5)-dp(0)-1} fill="rgba(0,180,80,0.2)" />
      {/* White territory */}
      <rect x={dp(4)+1} y={dp(1)+1} width={dp(6)-dp(4)-1} height={dp(5)-dp(1)-1} fill="rgba(100,100,255,0.18)" />
      {[[0,3],[1,2],[2,2],[1,3],[5,1]].map(([r,c]) => <BS key={`f${r}${c}`} r={r} c={c} color="B" />)}
      {[[0,5],[1,5],[2,5],[5,4],[5,5]].map(([r,c]) => <BS key={`fw${r}${c}`} r={r} c={c} color="W" />)}
      <text x={dp(1)} y={dp(6)+12} textAnchor="middle" fontSize={9} fill="#064e20" fontWeight="bold">⚫ 10</text>
      <text x={dp(5)} y={dp(6)+12} textAnchor="middle" fontSize={9} fill="#222" fontWeight="bold">⚪ 7</text>
    </svg>
  );
}

// ── SVG Board ─────────────────────────────────────────────────────────────────
function BoardSVG({
  board, size, moveHistory, onPlace,
}: {
  board: Stone[][];
  size: BoardSize;
  moveHistory: Move[];
  onPlace: (r: number, c: number) => void;
}) {
  const [hover, setHover] = useState<[number, number] | null>(null);
  const px = CELL * (size - 1) + MARGIN * 2;
  const last = moveHistory.length ? moveHistory[moveHistory.length - 1] : null;
  const hoshi = HOSHI[size] ?? [];

  return (
    <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`} style={{ display: "block", maxWidth: "100%", height: "auto" }}>
      <defs>
        <radialGradient id="ggb" cx="38%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#555" />
          <stop offset="100%" stopColor="#0d0d0d" />
        </radialGradient>
        <radialGradient id="ggw" cx="38%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="100%" stopColor="#c8c8b8" />
        </radialGradient>
        <filter id="gsh">
          <feDropShadow dx="2" dy="2" stdDeviation="2" floodOpacity="0.45" />
        </filter>
        <pattern id="wg" x="0" y="0" width="120" height="8" patternUnits="userSpaceOnUse">
          <line x1="0" y1="4" x2="120" y2="4" stroke="#8B6914" strokeWidth="0.4" opacity="0.4" />
        </pattern>
      </defs>
      <rect width={px} height={px} fill="#DCB483" rx={4} />
      <rect width={px} height={px} fill="url(#wg)" rx={4} opacity={0.18} />
      {Array.from({ length: size }, (_, i) => {
        const x = MARGIN + i * CELL, y = MARGIN + i * CELL;
        return (
          <g key={i}>
            <line x1={x} y1={MARGIN} x2={x} y2={MARGIN + (size-1)*CELL} stroke="#5C3D0A" strokeWidth={0.8} />
            <line x1={MARGIN} y1={y} x2={MARGIN + (size-1)*CELL} y2={y} stroke="#5C3D0A" strokeWidth={0.8} />
            <text x={x} y={MARGIN - 10} textAnchor="middle" fontSize={9} fill="#7C5A1E" fontFamily="monospace">{COLS[i]}</text>
            <text x={MARGIN - 14} y={y + 4} textAnchor="middle" fontSize={9} fill="#7C5A1E" fontFamily="monospace">{size - i}</text>
          </g>
        );
      })}
      {hoshi.map(([hr, hc]) => (
        <circle key={`h${hr}${hc}`} cx={MARGIN + hc*CELL} cy={MARGIN + hr*CELL} r={3.5} fill="#5C3D0A" />
      ))}
      {board.map((row, r) => row.map((s, c) => {
        const cx = MARGIN + c * CELL, cy = MARGIN + r * CELL;
        const isLast = last && last.row === r && last.col === c;
        const hovered = hover && hover[0] === r && hover[1] === c;
        return (
          <g key={`${r}-${c}`}>
            {s && (
              <>
                <circle cx={cx} cy={cy} r={18} fill={s === "B" ? "url(#ggb)" : "url(#ggw)"} filter="url(#gsh)" />
                {isLast && <circle cx={cx} cy={cy} r={6} fill={s === "B" ? "white" : "#222"} opacity={0.65} />}
              </>
            )}
            {!s && hovered && (
              <circle cx={cx} cy={cy} r={17} fill="rgba(0,0,0,0.25)" pointerEvents="none" />
            )}
            <rect
              x={cx - CELL/2} y={cy - CELL/2} width={CELL} height={CELL}
              fill="transparent"
              onClick={() => onPlace(r, c)}
              onMouseEnter={() => setHover([r, c])}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: s ? "default" : "pointer" }}
            />
          </g>
        );
      }))}
    </svg>
  );
}

// ── Diagnostic SVG board ───────────────────────────────────────────────────────
const DDC = 29, DDM = 22, DDR = 10;
function dpos(i: number) { return DDM + i * DDC; }

function DiagBoardSVG({ stones }: { stones: { col: number; row: number; color: Stone }[] }) {
  const w = DDM * 2 + 8 * DDC;
  return (
    <svg width={w} height={w} viewBox={`0 0 ${w} ${w}`} style={{ display: "block", maxWidth: "100%", height: "auto" }}>
      <defs>
        <radialGradient id="dgb" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#777" /><stop offset="100%" stopColor="#111" />
        </radialGradient>
        <radialGradient id="dgw" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#fff" /><stop offset="100%" stopColor="#ccc" />
        </radialGradient>
      </defs>
      <rect width={w} height={w} fill="#DCB483" rx={6} />
      {Array.from({ length: 9 }, (_, i) => (
        <g key={i}>
          <line x1={dpos(i)} y1={dpos(0)} x2={dpos(i)} y2={dpos(8)} stroke="#5C3D0A" strokeWidth={1} />
          <line x1={dpos(0)} y1={dpos(i)} x2={dpos(8)} y2={dpos(i)} stroke="#5C3D0A" strokeWidth={1} />
          <text x={dpos(i)} y={DDM - 8} textAnchor="middle" fontSize={8} fill="#7C5A1E" fontFamily="monospace">{COLS[i]}</text>
          <text x={DDM - 12} y={dpos(i) + 3} textAnchor="middle" fontSize={8} fill="#7C5A1E" fontFamily="monospace">{9 - i}</text>
        </g>
      ))}
      {[[2,2],[2,4],[2,6],[4,4],[6,2],[6,4],[6,6]].map(([hr,hc]) => (
        <circle key={`dh${hr}${hc}`} cx={dpos(hc)} cy={dpos(hr)} r={3} fill="#5C3D0A" />
      ))}
      {stones.map((s, i) => (
        <circle key={i} cx={dpos(s.col)} cy={dpos(s.row)} r={DDR}
          fill={s.color === "B" ? "url(#dgb)" : "url(#dgw)"}
          stroke={s.color === "W" ? "rgba(190,190,190,.5)" : "none"} strokeWidth={0.8}
        />
      ))}
    </svg>
  );
}

// ── Victor Bubble ──────────────────────────────────────────────────────────────
function formatVictorHTML(text: string): string {
  // Convert **Section** → styled section div
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  let html = "";
  let inSection = false;
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      // plain text
      const t = parts[i].replace(/\n/g, "<br>");
      html += inSection ? t : t;
    } else {
      // section title
      if (inSection) html += `</div>`;
      html += `<div class="vs"><div class="vs-t">${parts[i]}</div>`;
      inSection = true;
    }
  }
  if (inSection) html += `</div>`;
  return html;
}

function VictorBubble({ bubble }: { bubble: BubbleData }) {
  const isVictor = bubble.who === "victor";
  const isSystem = bubble.who === "system";

  if (isSystem) {
    return (
      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", padding: "4px 10px", margin: "4px 0", background: "rgba(255,255,255,0.03)", borderRadius: 6, borderLeft: "2px solid rgba(255,255,255,0.1)" }}>
        {bubble.text}
      </div>
    );
  }

  if (isVictor) {
    return (
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "flex-start" }}>
        <div style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>🎭</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: "rgba(197,165,114,0.7)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Victor</div>
          <div
            style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: 1.65 }}
            dangerouslySetInnerHTML={{ __html: formatVictorHTML(bubble.text) }}
          />
        </div>
      </div>
    );
  }

  // user
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
      <div style={{
        maxWidth: "78%", padding: "8px 12px", borderRadius: 10,
        background: "rgba(197,165,114,0.14)", border: "1px solid rgba(197,165,114,0.25)",
        fontSize: "var(--text-sm)", color: "var(--color-text-primary)", lineHeight: 1.55,
      }}>
        {bubble.text}
      </div>
    </div>
  );
}

// ── Thinking dots ──────────────────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <>
      <style>{`
        @keyframes gc-dot { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }
        .gc-dot { display:inline-block; width:7px; height:7px; border-radius:50%; background:rgba(197,165,114,0.7); margin:0 2px; animation:gc-dot 1.4s infinite; }
        .gc-dot:nth-child(2){animation-delay:.16s}
        .gc-dot:nth-child(3){animation-delay:.32s}
        .vs { margin-bottom:8px; }
        .vs-t { font-size:11px; font-weight:600; color:rgba(197,165,114,0.9); text-transform:uppercase; letter-spacing:.06em; margin-bottom:3px; }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>🎭</span>
        <span className="gc-dot" />
        <span className="gc-dot" />
        <span className="gc-dot" />
      </div>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function GobanCoach() {
  useUserStore((s) => s.profile);
  const { gen, loading } = useAiGen();

  // Config
  const [size, setSize] = useState<BoardSize>(9);
  const [mode, setMode] = useState<GameMode>("2p");
  const [level, setLevel] = useState<CoachLevel>("debutant");
  const [career, setCareer] = useState<CareerMode>("oui");
  const [screen, setScreen] = useState<Screen>("intro");

  // Game state
  const [board, setBoard] = useState<Stone[][]>([]);
  const [turn, setTurn] = useState<"B" | "W">("B");
  const [moveNum, setMoveNum] = useState(0);
  const [captures, setCaptures] = useState<Record<"B" | "W", number>>({ B: 0, W: 0 });
  const [moveHistory, setMoveHistory] = useState<Move[]>([]);
  const [convHistory, setConvHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [lastBoardState, setLastBoardState] = useState<string | null>(null);
  const [consecutivePasses, setConsecutivePasses] = useState(0);

  // UI
  const [bubbles, setBubbles] = useState<BubbleData[]>([]);
  const [thinking, setThinking] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const streamAccRef = useRef<string>("");
  const [userInput, setUserInput] = useState("");
  const bubblesRef = useRef<HTMLDivElement>(null);

  // Rules
  const [ruleIdx, setRuleIdx] = useState(0);

  // Diagnostic
  const [diagStep, setDiagStep] = useState(0);
  const [diagResponses, setDiagResponses] = useState<DiagResponse[]>([]);
  const [diagStones, setDiagStones] = useState<{ col: number; row: number; color: Stone }[]>([]);
  const [diagAnalysis, setDiagAnalysis] = useState<string | null>(null);
  const [diagDone, setDiagDone] = useState(false);

  // End
  const [endScore, setEndScore] = useState<{ B: number; W: number } | null>(null);
  const [endDebrief, setEndDebrief] = useState<string | null>(null);

  // Audio
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fbIdxRef = useRef<Record<CoachLevel, number>>({ debutant: 0, intermediaire: 0, expert: 0 });
  const FB_COUNT: Record<CoachLevel, number> = { debutant: 3, intermediaire: 2, expert: 1 };

  function playAudio(file: string) {
    if (!BUNNY_BASE) return;
    if (audioRef.current) { audioRef.current.pause(); }
    const a = new Audio(BUNNY_BASE + file);
    audioRef.current = a;
    a.play().catch(() => {});
  }

  function playFallbackAudio() {
    const n = FB_COUNT[level] ?? 1;
    fbIdxRef.current[level] = (fbIdxRef.current[level] % n) + 1;
    const key = level === "intermediaire" ? "inter" : level;
    playAudio(`fb-${key}-${fbIdxRef.current[level]}.mp3`);
  }

  function stopAudio() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
  }

  // Persist config
  useEffect(() => {
    const saved = loadLocal<{ size: BoardSize; level: CoachLevel; career: CareerMode } | null>("ns_goban_cfg", null);
    if (saved) { setSize(saved.size); setLevel(saved.level); setCareer(saved.career); }
  }, []);

  useEffect(() => {
    if (bubblesRef.current) bubblesRef.current.scrollTop = bubblesRef.current.scrollHeight;
  }, [bubbles, thinking]);

  // ── AI ────────────────────────────────────────────────────────────────────
  const addBubble = useCallback((who: BubbleData["who"], text: string) => {
    setBubbles((b) => [...b, { who, text, id: Date.now() + Math.random() }]);
  }, []);

  const callVictor = useCallback(async (userMessage: string): Promise<string | null> => {
    const sysPart = buildSystemPrompt(level, size, career);
    const history = convHistory.slice(-10);
    const fullPrompt = `${sysPart}\n\n---\n${history.map((m) => `${m.role === "user" ? "JOUEUR" : "VICTOR"}: ${m.content}`).join("\n")}\nJOUEUR: ${userMessage}\nVICTOR:`;

    streamAccRef.current = "";
    setStreamingText("");
    setThinking(false);

    let result = "";
    try {
      result = await callAIStream(
        { agent: "strategist", messages: [{ role: "user", content: fullPrompt }], model: MODEL_REASONING, stream: true },
        (accumulated) => {
          streamAccRef.current = accumulated;
          setStreamingText(accumulated);
        },
      );
    } catch { /* ignore — fallback below */ }

    // Si le streaming a échoué ou retourné vide (Edge Function non déployée en SSE),
    // on bascule sur l'appel non-streaming classique.
    if (!result) {
      setStreamingText(null);
      const resp = await gen("strategist", fullPrompt, { model: MODEL_REASONING });
      result = resp ?? "";
    }

    setStreamingText(null);
    if (result) {
      setConvHistory((h) => [...h, { role: "user", content: userMessage }, { role: "assistant", content: result }]);
    }
    return result || null;
  }, [level, size, career, convHistory, gen]);

  const displayVictor = useCallback(async (prompt: string) => {
    setThinking(true);
    const text = await callVictor(prompt);
    const isFallback = !text;
    addBubble("victor", text ?? FALLBACKS[level][Math.floor(Math.random() * FALLBACKS[level].length)]);
    if (isFallback) playFallbackAudio();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callVictor, addBubble, level]);

  // ── Game actions ──────────────────────────────────────────────────────────
  const initBoard = useCallback(() => {
    setBoard(Array.from({ length: size }, () => Array(size).fill(null)));
    setTurn("B");
    setMoveNum(0);
    setCaptures({ B: 0, W: 0 });
    setMoveHistory([]);
    setConvHistory([]);
    setBubbles([]);
    setConsecutivePasses(0);
    setLastBoardState(null);
  }, [size]);

  async function startGame() {
    stopAudio();
    saveLocal("ns_goban_cfg", { size, level, career });
    initBoard();
    setScreen("game");
    playAudio(`welcome-${level}.mp3`);
    const prompt = `Commence la session. Le joueur est ${level}. Goban ${size}×${size}. Mode Goban de Carrière : ${career}. Lance le jeu avec quelques mots d'accueil et un conseil d'ouverture.`;
    await displayVictor(prompt);
  }

  async function placeStone(r: number, c: number) {
    if (board[r][c]) return;
    const newBoard = board.map((row) => row.slice());
    newBoard[r][c] = turn;
    const cap = removeCaptures(newBoard, turn === "B" ? "W" : "B");
    const newState = JSON.stringify(newBoard);
    if (newState === lastBoardState) { addBubble("system", "⚠ Ko — position répétée."); return; }
    const lib = groupLiberties(newBoard, findGroup(newBoard, r, c));
    if (lib === 0 && cap === 0) { addBubble("system", "⚠ Suicide interdit."); return; }
    setLastBoardState(JSON.stringify(board));
    const newCaptures = { ...captures };
    if (cap > 0) newCaptures[turn] = (newCaptures[turn] ?? 0) + cap;
    const num = moveNum + 1;
    const label = COLS[c] + (size - r);
    const mv: Move = { row: r, col: c, color: turn, label, num };
    setBoard(newBoard);
    setCaptures(newCaptures);
    setMoveNum(num);
    setMoveHistory((h) => [...h, mv]);
    setConsecutivePasses(0);
    const nextTurn: "B" | "W" = turn === "B" ? "W" : "B";
    setTurn(nextTurn);
    const who = turn === "B" ? "Noir" : "Blanc";
    const capNote = cap > 0 ? `, capturant ${cap} pierre${cap > 1 ? "s" : ""}` : "";
    const isBorder = r === 0 || r === size-1 || c === 0 || c === size-1;
    const prompt = `${who} joue ${label}${capNote}. C'est le coup n°${num} sur un goban ${size}×${size}.${isBorder ? " Ce coup est en bordure." : ""} Réponds avec ta structure habituelle.`;
    await displayVictor(prompt);
    if (mode === "solo" && nextTurn === "W") {
      setTimeout(() => aiMove(newBoard), 900);
    }
  }

  function aiMove(currentBoard: Stone[][]) {
    const empty: [number, number][] = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!currentBoard[r][c]) empty.push([r, c]);
    if (!empty.length) return;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    const newBoard = currentBoard.map((row) => row.slice());
    newBoard[r][c] = "W";
    removeCaptures(newBoard, "B");
    setBoard(newBoard);
    setMoveHistory((h) => [...h, { row: r, col: c, color: "W" as Stone, label: COLS[c] + (size - r), num: moveNum + 1 }]);
    setMoveNum((n) => n + 1);
    setTurn("B");
  }

  async function passTurn() {
    const newPasses = consecutivePasses + 1;
    setConsecutivePasses(newPasses);
    setMoveNum((n) => n + 1);
    setMoveHistory((h) => [...h, { row: -1, col: -1, color: turn, label: "Passe", num: moveNum + 1 }]);
    const nextTurn: Stone = turn === "B" ? "W" : "B";
    setTurn(nextTurn as "B" | "W");
    if (newPasses >= 2) { await endGame(); return; }
    const who = turn === "B" ? "Noir" : "Blanc";
    await displayVictor(`${who} passe son tour. Coup n°${moveNum + 1}. Commente ce passe brièvement et pose une question sur sa décision.`);
  }

  async function undoMove() {
    if (!moveHistory.length) return;
    const newHistory = moveHistory.slice(0, -1);
    const newBoard: Stone[][] = Array.from({ length: size }, () => Array(size).fill(null));
    const newCaptures: Record<"B" | "W", number> = { B: 0, W: 0 };
    let newTurn: "B" | "W" = "B";
    for (const mv of newHistory) {
      if (mv.row === -1) { newTurn = newTurn === "B" ? "W" : "B"; continue; }
      newBoard[mv.row][mv.col] = mv.color;
      if (mv.color) {
        const cap = removeCaptures(newBoard, mv.color === "B" ? "W" : "B");
        if (cap) newCaptures[mv.color] = (newCaptures[mv.color] ?? 0) + cap;
        newTurn = mv.color === "B" ? "W" : "B";
      }
    }
    setBoard(newBoard); setCaptures(newCaptures); setMoveHistory(newHistory);
    setMoveNum(newHistory.length); setTurn(newTurn);
    addBubble("system", "↩ Coup annulé. À toi de jouer.");
  }

  async function askReview() {
    const recent = moveHistory.slice(-5).map((m) => `${m.num}.${m.color === "B" ? "⚫" : "⚪"}${m.label}`).join(" ");
    const sc = estimateScore(board, captures);
    await displayVictor(`Le joueur demande une analyse de position. Coup n°${moveNum}, goban ${size}×${size}. Derniers coups : ${recent || "aucun"}. Score estimé — Noir: ${sc.B}, Blanc: ${sc.W}. Fais une brève analyse Socratique de 3-5 coups clés.`);
  }

  async function askHint() {
    const who = turn === "B" ? "Noir" : "Blanc";
    const sc = estimateScore(board, captures);
    const recent = moveHistory.slice(-3).map((m) => `${m.num}.${m.color === "B" ? "⚫" : "⚪"}${m.label}`).join(" ");
    await displayVictor(`${who} demande un indice avant de jouer (coup n°${moveNum + 1}, goban ${size}×${size}). Score estimé : Noir ${sc.B} / Blanc ${sc.W}. Derniers coups : ${recent || "aucun"}. Donne un indice INDIRECT sans révéler le coup exact : une zone à explorer, une question stratégique, ou une direction. Ne joue PAS le coup.`);
  }

  async function endGame() {
    stopAudio();
    const sc = estimateScore(board, captures);
    setEndScore(sc);
    setScreen("end");
    const winner = sc.B > sc.W ? "Noir" : sc.B < sc.W ? "Blanc" : "Égalité";
    const winnerKey = sc.B > sc.W ? "noir" : sc.B < sc.W ? "blanc" : "egal";
    playAudio(`endgame-${winnerKey}.mp3`);
    const recent = moveHistory.slice(-8).map((m) => `${m.num}.${m.color === "B" ? "⚫" : "⚪"}${m.label}`).join(" ");
    const prompt = `La partie est terminée sur un goban ${size}×${size}. Score final : Noir ${sc.B}, Blanc ${sc.W}. ${winner === "Égalité" ? "Match nul." : winner + " gagne."} Derniers coups : ${recent}. Fais un débrief Socratique : 3 questions de réflexion sur les moments clés et 1 conseil pour la prochaine partie.`;
    setEndDebrief(null);
    const debrief = await gen("strategist", prompt, { model: MODEL_REASONING });
    setEndDebrief(debrief ?? "Bien joué ! Réfléchis au coup le plus décisif de la partie, à un moment où tu as perdu l'initiative, et à ce que tu aurais joué différemment.\n\nConseil : concentre-toi sur la connexion de tes groupes avant de chercher à attaquer.");
  }

  async function sendUserMsg() {
    const text = userInput.trim();
    if (!text) return;
    setUserInput("");
    addBubble("user", text);
    await displayVictor(text);
  }

  // ── Diagnostic ─────────────────────────────────────────────────────────────
  const STONE_POS: [number, number][] = [[0,0],[4,4],[8,0],[8,8],[0,8],[2,2],[6,6],[3,5],[5,2],[4,7]];

  function answerDiag(isYes: boolean) {
    const q = DIAG_QUESTIONS[diagStep];
    const isBlack = isYes ? q.yesBlack : !q.yesBlack;
    const concept = isYes ? q.yesConcept : q.noConcept;
    const resp: DiagResponse = { question: q.q, answer: isYes ? "Oui" : "Non", concept, isBlack };
    const newResponses = [...diagResponses, resp];
    setDiagResponses(newResponses);
    if (concept !== null) {
      const [row, col] = STONE_POS[diagStep] ?? [4, 4];
      setDiagStones((s) => [...s, { col, row, color: isBlack ? "B" : "W" }]);
    }
    const next = diagStep + 1;
    setDiagStep(next);
    if (next >= DIAG_QUESTIONS.length) finalizeDiag(newResponses);
  }

  async function finalizeDiag(responses: DiagResponse[]) {
    setDiagDone(true);
    const blackCount = responses.filter((r) => r.isBlack === true).length;
    const whiteCount = responses.filter((r) => r.isBlack === false).length;
    const boardDesc = responses.map((r, i) => `Q${i+1}: "${r.question}" → ${r.answer}${r.concept ? ` [${r.concept}]` : ""}`).join("\n");
    const prompt = `L'entrepreneur a complété un auto-diagnostic en 10 questions. Position :\n\n${boardDesc}\n\nPierres noires (forces) : ${blackCount} | Blanches (fragilités) : ${whiteCount}\n\nAnalyse cette position comme un joueur de Go lirait un plateau après 10 coups d'ouverture.\n\nSTRUCTURE EXACTE (titres en gras):\n**Lecture de ta position** — 2-3 phrases sur l'image globale\n**Ton groupe le plus fort** — pilier principal\n**Le groupe en danger** — fragilité urgente\n**L'Aji à activer** — opportunité dormante\n**Ton prochain coup** — 1 action concrète cette semaine`;
    const analysis = await gen("strategist", `${buildDiagSystemPrompt()}\n\n${prompt}`, { model: MODEL_REASONING });
    setDiagAnalysis(analysis ?? "Victor analyse ta position… Relance le diagnostic pour obtenir une analyse complète.");
  }

  function resetDiag() {
    setDiagStep(0); setDiagResponses([]); setDiagStones([]); setDiagAnalysis(null); setDiagDone(false);
  }

  // ── Shared style helpers ───────────────────────────────────────────────────
  const sc = board.length ? estimateScore(board, captures) : { B: 0, W: 0 };

  const BtnOpt = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick} style={{
      padding: "7px 14px", borderRadius: 7, border: "1px solid",
      borderColor: active ? "var(--color-gold)" : "rgba(255,255,255,0.1)",
      background: active ? "rgba(197,165,114,0.15)" : "rgba(255,255,255,0.04)",
      color: active ? "var(--color-gold)" : "var(--color-text-secondary)",
      fontSize: "var(--text-sm)", fontWeight: active ? 600 : 400,
      cursor: "pointer", transition: "all 0.15s",
    }}>{children}</button>
  );

  const SidebarSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );

  // ── INTRO ──────────────────────────────────────────────────────────────────
  if (screen === "intro") return (
    <div style={{ padding: "var(--space-6)", maxWidth: 720, margin: "0 auto" }}>
      <PageHeader title="Goban Coach — Victor" subtitle="Le Go comme levier de développement professionnel" />
      <Card style={{ marginBottom: "var(--space-4)", padding: 0, overflow: "hidden" }}>
        <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
          <iframe
            src="https://www.youtube.com/embed/eZix_N-YUHs"
            title="Goban de Carrière — Victor"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
          />
        </div>
      </Card>
      <Card>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: 1.7, marginBottom: 20 }}>
          <strong style={{ color: "var(--color-gold)" }}>Victor</strong> est ton instructeur de Go et le guide de la méthode <em>Goban de Carrière</em>. Le Go, jeu de stratégie millénaire, devient ici un outil concret de réflexion entrepreneuriale. Chaque partie révèle des patterns de ta façon de penser et d'agir sur le marché.
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Button variant="gold" onClick={() => setScreen("setup")}>Commencer →</Button>
          <Button variant="ghost" onClick={() => { setRuleIdx(0); setScreen("rules"); }}>📖 Découvrir les règles</Button>
          <Button variant="ghost" onClick={() => { resetDiag(); setScreen("diagnostic"); }}>◎ Diagnostic Carrière</Button>
        </div>
      </Card>
    </div>
  );

  // ── SETUP ──────────────────────────────────────────────────────────────────
  if (screen === "setup") return (
    <div style={{ padding: "var(--space-6)", maxWidth: 640, margin: "0 auto" }}>
      <PageHeader title="Configurer la session" subtitle="Victor adapte son enseignement à ton niveau" />
      <Card style={{ marginBottom: "var(--space-4)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Niveau du joueur</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <BtnOpt active={level === "debutant"} onClick={() => setLevel("debutant")}>🌱 Débutant</BtnOpt>
              <BtnOpt active={level === "intermediaire"} onClick={() => setLevel("intermediaire")}>🔥 Intermédiaire</BtnOpt>
              <BtnOpt active={level === "expert"} onClick={() => setLevel("expert")}>⚡ Avancé</BtnOpt>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Taille du plateau</div>
            <div style={{ display: "flex", gap: 8 }}>
              {BOARD_SIZES.map((s) => (
                <BtnOpt key={s} active={size === s} onClick={() => setSize(s)}>
                  {s}×{s}<br /><span style={{ fontSize: 10, fontWeight: 400 }}>{s === 9 ? "~20 min" : s === 13 ? "~45 min" : "~90 min"}</span>
                </BtnOpt>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Mode de jeu</div>
            <div style={{ display: "flex", gap: 8 }}>
              <BtnOpt active={mode === "2p"} onClick={() => setMode("2p")}>⚔️ 2 Joueurs</BtnOpt>
              <BtnOpt active={mode === "solo"} onClick={() => setMode("solo")}>🤖 Solo (IA Blanc)</BtnOpt>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Méthode Goban de Carrière</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <BtnOpt active={career === "oui"} onClick={() => setCareer("oui")}>✅ Activer les ponts métaphores</BtnOpt>
              <BtnOpt active={career === "non"} onClick={() => setCareer("non")}>🎯 Go pur uniquement</BtnOpt>
            </div>
          </div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button variant="gold" onClick={startGame} disabled={loading}>
              {loading ? "Initialisation…" : "Lancer la session →"}
            </Button>
            <Button variant="ghost" onClick={() => { setRuleIdx(0); setScreen("rules"); }}>📖 Règles du Go</Button>
            <Button variant="ghost" onClick={() => { resetDiag(); setScreen("diagnostic"); }}>◎ Diagnostic Carrière</Button>
            <Button variant="ghost" onClick={() => setScreen("intro")}>← Intro</Button>
          </div>
        </div>
      </Card>
    </div>
  );

  // ── RULES ──────────────────────────────────────────────────────────────────
  if (screen === "rules") return (
    <div style={{ padding: "var(--space-6)", maxWidth: 760, margin: "0 auto" }}>
      <PageHeader title="Les règles du Go" subtitle="Victor te guide en 6 chapitres" />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
        {RULES.map((r, i) => (
          <BtnOpt key={i} active={ruleIdx === i} onClick={() => { setRuleIdx(i); playAudio(`rule-${i}.mp3`); }}>
            {i}. {r.title.split(" ")[1] ?? r.title}
          </BtnOpt>
        ))}
      </div>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--color-gold)" }}>
            Règle {ruleIdx} — {RULES[ruleIdx].title}
          </div>
          {BUNNY_BASE && (
            <button
              onClick={() => playAudio(`rule-${ruleIdx}.mp3`)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, opacity: 0.7 }}
              title="Écouter"
            >🔊</button>
          )}
        </div>
        <div style={{ display: "flex", gap: "var(--space-5)", flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ flex: "0 0 auto" }}>
            <RuleDiagram rule={ruleIdx} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: 1.75 }}>
              {RULES[ruleIdx].body}
            </div>
          </div>
        </div>
        {career === "oui" && (
          <div style={{
            marginTop: 16, padding: "12px 16px", borderRadius: 8,
            background: "rgba(197,165,114,0.07)", border: "1px solid rgba(197,165,114,0.18)",
          }}>
            <div style={{ fontSize: 10, color: "var(--color-gold)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>🎭 Pont Goban de Carrière</div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: 1.65 }}>
              {RULES[ruleIdx].careerNote}
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          {ruleIdx > 0 && <Button variant="ghost" onClick={() => setRuleIdx((i) => i - 1)}>← Précédent</Button>}
          {ruleIdx < RULES.length - 1
            ? <Button variant="gold" onClick={() => setRuleIdx((i) => i + 1)}>Suivant →</Button>
            : <Button variant="gold" onClick={() => setScreen("setup")}>▶ Lancer une partie</Button>
          }
          <Button variant="ghost" onClick={() => setScreen("setup")}>Retour</Button>
        </div>
      </Card>
    </div>
  );

  // ── DIAGNOSTIC ─────────────────────────────────────────────────────────────
  if (screen === "diagnostic") return (
    <div style={{ padding: "var(--space-6)", maxWidth: 760, margin: "0 auto" }}>
      <PageHeader title="Diagnostic Goban de Carrière" subtitle="10 questions · Victor lit ta position entrepreneuriale" />
      <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
        <Card style={{ flex: "0 0 auto" }}>
          <DiagBoardSVG stones={diagStones} />
          <div style={{ fontSize: 10, color: "var(--color-text-muted)", textAlign: "center", marginTop: 8 }}>⚫ Force &nbsp;|&nbsp; ⚪ Fragilité</div>
        </Card>
        <Card style={{ flex: 1, minWidth: 280 }}>
          {!diagDone ? (
            <>
              <div style={{ fontSize: 10, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                Question {diagStep + 1} / {DIAG_QUESTIONS.length}
              </div>
              <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", marginBottom: 16, overflow: "hidden" }}>
                <div style={{ width: `${Math.round((diagStep / DIAG_QUESTIONS.length) * 100)}%`, height: "100%", background: "var(--color-gold)", transition: "width .3s" }} />
              </div>
              <div style={{ fontSize: "var(--text-base)", color: "var(--color-text-primary)", fontWeight: 500, marginBottom: 8 }}>
                {DIAG_QUESTIONS[diagStep].q}
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-gold)", opacity: 0.8, marginBottom: 20 }}>
                {DIAG_QUESTIONS[diagStep].ctx}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <Button variant="gold" onClick={() => answerDiag(true)}>✅ Oui</Button>
                <Button variant="ghost" onClick={() => answerDiag(false)}>❌ Non</Button>
              </div>
              <div style={{ marginTop: 16 }}>
                <button onClick={() => { resetDiag(); setScreen("setup"); }}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "var(--text-xs)", color: "var(--color-text-muted)", padding: 0 }}>
                  ← Retour sans sauvegarder
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gold)", marginBottom: 12 }}>🎭 Lecture de position par Victor</div>
              {loading && !diagAnalysis && <div style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>Victor lit ta position…</div>}
              {diagAnalysis && (
                <div
                  style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: 1.7 }}
                  dangerouslySetInnerHTML={{ __html: formatVictorHTML(diagAnalysis) }}
                />
              )}
              <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
                <Button variant="ghost" onClick={resetDiag}>↺ Recommencer</Button>
                <Button variant="ghost" onClick={() => setScreen("setup")}>Retour</Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );

  // ── END ────────────────────────────────────────────────────────────────────
  if (screen === "end") return (
    <div style={{ padding: "var(--space-6)", maxWidth: 640, margin: "0 auto" }}>
      <PageHeader title="🏁 Fin de partie" subtitle="Victor débriefe la session" />
      <Card style={{ marginBottom: "var(--space-4)" }}>
        <div style={{ display: "flex", gap: 24, marginBottom: 24 }}>
          {([["B","⚫","Noir"],["W","⚪","Blanc"]] as [("B"|"W"), string, string][]).map(([color, icon, label]) => (
            <div key={color} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: "var(--color-text-primary)" }}>{icon} {endScore?.[color] ?? 0}</div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>{label} · territoire + captures</div>
            </div>
          ))}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
            <div style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--color-gold)" }}>
              {endScore ? (endScore.B > endScore.W ? "⚫ Noir gagne" : endScore.B < endScore.W ? "⚪ Blanc gagne" : "Égalité") : "—"}
            </div>
          </div>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16 }}>
          <div style={{ fontSize: 10, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>🎭 Débrief Victor</div>
          {loading && !endDebrief && <div style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>Victor analyse la partie…</div>}
          {endDebrief && (
            <div
              style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: 1.7 }}
              dangerouslySetInnerHTML={{ __html: formatVictorHTML(endDebrief) }}
            />
          )}
        </div>
        <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
          <Button variant="gold" onClick={() => { initBoard(); startGame(); }}>↺ Nouvelle partie</Button>
          <Button variant="ghost" onClick={() => setScreen("setup")}>Changer de config</Button>
        </div>
      </Card>
    </div>
  );

  // ── GAME ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "var(--space-3)", maxWidth: 1200, margin: "0 auto" }}>
      <ThinkingDots />
      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>

        {/* LEFT SIDEBAR */}
        <div style={{ width: 200, flexShrink: 0, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden" }}>
          <SidebarSection title="Score estimé">
            {([["B","⚫","Noir"],["W","⚪","Blanc"]] as [("B"|"W"), string, string][]).map(([color, icon, label]) => (
              <div key={color} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: color === "B" ? "#111" : "#eee", border: "1.5px solid #666", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{label}</div>
                  <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>cap: {captures[color]}</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text-primary)" }}>{sc[color]}</div>
              </div>
            ))}
          </SidebarSection>

          <SidebarSection title={`Tour n°${moveNum}`}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: turn === "B" ? "#111" : "#eee", border: "2px solid #888", flexShrink: 0 }} />
              <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>{turn === "B" ? "Noir joue" : "Blanc joue"}</span>
            </div>
          </SidebarSection>

          <div style={{ padding: "12px 14px", flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Historique</div>
            <div style={{ maxHeight: 180, overflowY: "auto" }}>
              {moveHistory.slice(-20).map((mv, i, arr) => (
                <div key={mv.num} style={{
                  display: "flex", gap: 6, alignItems: "center", padding: "2px 0",
                  color: i === arr.length - 1 ? "var(--color-gold)" : "var(--color-text-muted)",
                  fontSize: 11,
                }}>
                  <span style={{ opacity: 0.6, minWidth: 22 }}>{mv.num}.</span>
                  <span>{mv.color === "B" ? "⚫" : "⚪"} {mv.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Actions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { label: "⏭ Passer", onClick: passTurn },
                { label: "↩ Annuler", onClick: undoMove },
                { label: "💡 Indice", onClick: askHint, disabled: loading || streamingText !== null },
                { label: "🔍 Analyse", onClick: askReview, disabled: loading || streamingText !== null },
                { label: "📖 Règles", onClick: () => setScreen("rules") },
              ].map((btn) => (
                <button key={btn.label} onClick={btn.onClick} disabled={btn.disabled}
                  style={{
                    padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)",
                    background: "transparent", color: btn.disabled ? "rgba(255,255,255,0.3)" : "var(--color-text-secondary)",
                    fontSize: 12, cursor: btn.disabled ? "not-allowed" : "pointer", textAlign: "left",
                    transition: "all 0.1s",
                  }}
                >{btn.label}</button>
              ))}
              <button onClick={() => { stopAudio(); setScreen("setup"); }}
                style={{
                  padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(220,30,30,0.3)",
                  background: "transparent", color: "rgba(220,80,80,0.8)",
                  fontSize: 12, cursor: "pointer", textAlign: "left",
                }}
              >🏁 Terminer</button>
            </div>
          </div>
        </div>

        {/* CENTER — Board */}
        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "var(--space-3)", display: "inline-block" }}>
            <BoardSVG board={board} size={size} moveHistory={moveHistory} onPlace={placeStone} />
          </div>
        </div>

        {/* RIGHT — Victor panel */}
        <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, display: "flex", flexDirection: "column", minHeight: 420 }}>
            {/* Victor header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ fontSize: 22 }}>🎭</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text-primary)" }}>Victor</div>
                <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>Instructeur · Goban de Carrière</div>
              </div>
              {BUNNY_BASE && (
                <button onClick={playFallbackAudio} title="Réécouter"
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, opacity: 0.6 }}>🔊</button>
              )}
            </div>

            {/* Bubbles */}
            <div ref={bubblesRef} style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
              {bubbles.map((b) => <VictorBubble key={b.id} bubble={b} />)}
              {streamingText !== null && (
                <VictorBubble bubble={{ who: "victor", text: streamingText || "…", id: -1 }} />
              )}
              {thinking && <ThinkingDots />}
            </div>

            {/* Input */}
            <div style={{ display: "flex", gap: 8, padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <input
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendUserMsg()}
                placeholder="Réponds à Victor ou pose une question…"
                style={{
                  flex: 1, padding: "8px 12px", borderRadius: 8,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "var(--color-text-primary)", fontSize: "var(--text-sm)", outline: "none",
                }}
              />
              <Button variant="gold" onClick={sendUserMsg} disabled={loading || !userInput.trim()}>↑</Button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
