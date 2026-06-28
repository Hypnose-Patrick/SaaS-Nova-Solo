import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useUserStore } from "@/stores/useUserStore";
import { useAiGen, MODEL_REASONING } from "@/lib/useAiGen";
import { loadLocal, saveLocal } from "@/lib/local";

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
type Screen = "setup" | "game" | "end" | "rules" | "diagnostic";
type CoachLevel = "debutant" | "intermediaire" | "expert";
type CareerMode = "oui" | "non";
type GameMode = "solo" | "2p";

interface Move { row: number; col: number; color: Stone; label: string; num: number }
interface Bubble { who: "victor" | "user" | "system"; text: string; id: number }
interface DiagResponse { question: string; answer: "Oui" | "Non"; concept: string | null; isBlack: boolean | null }

// ── Prompt ────────────────────────────────────────────────────────────────────
function buildSystemPrompt(level: CoachLevel, size: BoardSize, career: CareerMode): string {
  const lvlMap: Record<CoachLevel, string> = {
    debutant: "NIVEAU 1 — Débutant",
    intermediaire: "NIVEAU 2 — Intermédiaire",
    expert: "NIVEAU 3 — Avancé",
  };
  return `Tu es Victor, instructeur de Go patient et pédagogue (20 ans d'expérience). Tu guides aussi la méthode "Goban de Carrière".

CONTEXTE : niveau ${lvlMap[level]}, goban ${size}×${size}, mode carrière ${career === "oui" ? "OUI" : "NON"}.

LANGUE : français, tutoiement, chaleureux mais exigeant.

STRUCTURE par tour (TOUJOURS) :
**Coup reçu** — appréciation 1-2 phrases
**Question d'intention** — ce qu'il visait
**Mon coup** — si solo : ta pierre ; si 2j : commentaire
**Conseil / Stratégie** — 1 stratégie adaptée au niveau, max 3 phrases
**Question de réflexion** — oriente le prochain coup

MAX 5 paragraphes.${career === "oui" ? "\n\nFais 1 pont discret max par session avec : Territoire=poste acquis, Influence=réseau, Sente=proactivité, Sacrifice=rebond." : ""}`;
}

function buildDiagSystemPrompt(): string {
  return `Tu es Victor, guide expert de la méthode "Le Goban de Carrière". Tu utilises exclusivement les concepts du Go comme métaphores du développement professionnel. Français, tutoiement, précis et encourageant.`;
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
    "**Coup reçu**\nBon coup pour explorer le plateau.\n\n**Question d'intention**\nQu'est-ce que tu cherchais : du territoire ou de l'influence ?\n\n**Mon coup**\nJe continue ma construction dans le coin.\n\n**Conseil / Stratégie**\nRetiens : coins d'abord, bords ensuite, centre en dernier.\n\n**Question de réflexion**\nOù le prochain territoire contesté va-t-il s'ouvrir ?",
    "**Coup reçu**\nTu t'approches de ma position.\n\n**Question d'intention**\nVoulais-tu m'attaquer ou te développer ?\n\n**Mon coup**\nJe renforce mon groupe.\n\n**Conseil / Stratégie**\nQuand tu approches une pierre adverse, pense toujours à l'étape d'après.\n\n**Question de réflexion**\nTes pierres sont-elles toutes connectées ?",
  ],
  intermediaire: [
    "**Coup reçu**\nTu gardes de l'aji dans cette zone.\n\n**Question d'intention**\nEst-ce un coup sente ou acceptes-tu le gote ?\n\n**Mon coup**\nJe prends l'initiative en développant mon moyo.\n\n**Conseil / Stratégie**\nGarde des tensions ouvertes — ne résous pas trop tôt.\n\n**Question de réflexion**\nQuelle est ta meilleure réponse si je joue là maintenant ?",
  ],
  expert: [
    "**Coup reçu**\nCoup subtil, tu maintiens la pression sur mes libertés.\n\n**Question d'intention**\nQuelle était ta lecture à 5 coups ?\n\n**Mon coup**\nJe réponds en sabaki pour alléger.\n\n**Conseil / Stratégie**\nWhole board thinking : ce coup change-t-il le centre de gravité de la partie ?\n\n**Question de réflexion**\nOù est le coup le plus lourd maintenant ?",
  ],
};

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

const RULES = [
  { title: "Le plateau & les pierres", body: "Le Go se joue sur un goban, une grille de 19×19 lignes (ou 13×13 / 9×9 pour débuter). Les intersections, pas les cases ! Noir joue en premier. Les pierres ne bougent jamais une fois posées — elles sont capturées ou persistent jusqu'à la fin." },
  { title: "Les libertés & la capture", body: "Chaque pierre adjacente à une intersection vide dispose d'une \"liberté\". Un groupe de pierres connectées partage ses libertés. Quand un groupe n'a plus aucune liberté, il est capturé et retiré du plateau. Plus un groupe est grand, plus il est difficile à capturer." },
  { title: "Construire du territoire", body: "Le but est de délimiter plus de territoire que l'adversaire. Le territoire, c'est l'espace vide entouré par tes pierres. Les coins sont les zones les plus économiques à défendre (2 bords), puis les bords (1 bord), puis le centre (0 bord)." },
  { title: "Les deux yeux", body: "Un groupe possédant 2 \"yeux\" (espaces internes inaccessibles à l'adversaire) est vivant et ne peut plus être capturé. C'est la règle de survie fondamentale. Un groupe avec 1 seul œil peut être tué — c'est le Tsume-Go." },
  { title: "Ko & Seki", body: "Le Ko interdit de recapturer immédiatement une pierre qui vient de capturer (répétition de position). Le Seki est une position de vie mutuelle où aucun joueur ne peut jouer sans se mettre en danger — les deux groupes vivent en équilibre." },
  { title: "Fin de partie & score", body: "La partie se termine quand les deux joueurs passent consécutivement. On compte le territoire vide entouré + les prisonniers capturés. Blanc reçoit 6,5 points de komi (compensation du désavantage de jouer en second). Celui qui a le plus de points gagne." },
];

// ── SVG Board renderer ────────────────────────────────────────────────────────
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
      </defs>
      <rect width={px} height={px} fill="#DCB483" rx={4} />
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
        return (
          <g key={`${r}-${c}`}>
            {s && (
              <>
                <circle cx={cx} cy={cy} r={17} fill={s === "B" ? "url(#ggb)" : "url(#ggw)"} filter="url(#gsh)" />
                {isLast && <circle cx={cx} cy={cy} r={5} fill={s === "B" ? "white" : "#222"} opacity={0.65} />}
              </>
            )}
            {!s && hover && hover[0] === r && hover[1] === c && (
              <circle cx={cx} cy={cy} r={16} fill="rgba(0,0,0,0.22)" pointerEvents="none" />
            )}
            <rect
              x={cx - CELL / 2} y={cy - CELL / 2} width={CELL} height={CELL}
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
const DC = 29, DM = 22, DR = 10;
function diagPos(i: number) { return DM + i * DC; }

function DiagBoardSVG({ stones }: { stones: { col: number; row: number; color: Stone }[] }) {
  const w = DM * 2 + 8 * DC;
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
          <line x1={diagPos(i)} y1={diagPos(0)} x2={diagPos(i)} y2={diagPos(8)} stroke="#5C3D0A" strokeWidth={1} />
          <line x1={diagPos(0)} y1={diagPos(i)} x2={diagPos(8)} y2={diagPos(i)} stroke="#5C3D0A" strokeWidth={1} />
          <text x={diagPos(i)} y={DM - 8} textAnchor="middle" fontSize={8} fill="#7C5A1E" fontFamily="monospace">{COLS[i]}</text>
          <text x={DM - 12} y={diagPos(i) + 3} textAnchor="middle" fontSize={8} fill="#7C5A1E" fontFamily="monospace">{9 - i}</text>
        </g>
      ))}
      {[[2,2],[2,4],[2,6],[4,4],[6,2],[6,4],[6,6]].map(([hr,hc]) => (
        <circle key={`dh${hr}${hc}`} cx={diagPos(hc)} cy={diagPos(hr)} r={3} fill="#5C3D0A" />
      ))}
      {stones.map((s, i) => (
        <circle key={i} cx={diagPos(s.col)} cy={diagPos(s.row)} r={DR}
          fill={s.color === "B" ? "url(#dgb)" : "url(#dgw)"}
          stroke={s.color === "W" ? "rgba(190,190,190,.5)" : "none"} strokeWidth={0.8}
        />
      ))}
    </svg>
  );
}

// ── Bubble component ───────────────────────────────────────────────────────────
function Bubble({ bubble }: { bubble: Bubble }) {
  const isVictor = bubble.who === "victor";
  const isSystem = bubble.who === "system";
  const formatted = bubble.text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
  return (
    <div style={{
      display: "flex",
      flexDirection: isVictor ? "row" : "column",
      alignItems: isVictor ? "flex-start" : undefined,
      gap: 6,
      marginBottom: 12,
    }}>
      {isVictor && (
        <div style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>🎭</div>
      )}
      <div style={{
        maxWidth: isSystem ? "100%" : "85%",
        padding: isSystem ? "6px 10px" : "10px 14px",
        borderRadius: 10,
        background: isVictor ? "rgba(197,165,114,0.1)" : isSystem ? "rgba(255,255,255,0.04)" : "rgba(197,165,114,0.18)",
        border: `1px solid ${isVictor ? "rgba(197,165,114,0.2)" : isSystem ? "rgba(255,255,255,0.08)" : "rgba(197,165,114,0.3)"}`,
        fontSize: "var(--text-sm)",
        color: isSystem ? "var(--color-text-muted)" : "var(--color-text-primary)",
        lineHeight: 1.6,
        alignSelf: bubble.who === "user" ? "flex-end" : "flex-start",
      }}
        dangerouslySetInnerHTML={isVictor ? { __html: formatted } : undefined}
      >
        {!isVictor ? bubble.text : undefined}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function GobanCoach() {
  const profile = useUserStore((s) => s.profile);
  const { gen, loading } = useAiGen();

  // Config
  const [size, setSize] = useState<BoardSize>(9);
  const [mode, setMode] = useState<GameMode>("2p");
  const [level, setLevel] = useState<CoachLevel>("debutant");
  const [career, setCareer] = useState<CareerMode>("oui");
  const [screen, setScreen] = useState<Screen>("setup");

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
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [thinking, setThinking] = useState(false);
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

  // Persist minimal config
  useEffect(() => {
    const saved = loadLocal<{ size: BoardSize; level: CoachLevel; career: CareerMode } | null>("ns_goban_cfg", null);
    if (saved) { setSize(saved.size); setLevel(saved.level); setCareer(saved.career); }
  }, []);

  useEffect(() => {
    if (bubblesRef.current) bubblesRef.current.scrollTop = bubblesRef.current.scrollHeight;
  }, [bubbles, thinking]);

  // ── AI call ────────────────────────────────────────────────────────────────
  const callVictor = useCallback(async (userMessage: string): Promise<string | null> => {
    const sysPart = buildSystemPrompt(level, size, career);
    const history = convHistory.slice(-10);
    const fullPrompt = `${sysPart}\n\n---\n${history.map((m) => `${m.role === "user" ? "JOUEUR" : "VICTOR"}: ${m.content}`).join("\n")}\nJOUEUR: ${userMessage}\nVICTOR:`;
    const resp = await gen("strategist", fullPrompt, { model: MODEL_REASONING });
    if (resp) {
      setConvHistory((h) => [...h, { role: "user", content: userMessage }, { role: "assistant", content: resp }]);
    }
    return resp;
  }, [level, size, career, convHistory, gen]);

  const addBubble = useCallback((who: Bubble["who"], text: string) => {
    setBubbles((b) => [...b, { who, text, id: Date.now() + Math.random() }]);
  }, []);

  const displayVictor = useCallback(async (prompt: string, fallbackLabel?: string) => {
    setThinking(true);
    const text = await callVictor(prompt);
    setThinking(false);
    const fallbackPool = FALLBACKS[level];
    addBubble("victor", text ?? fallbackPool[Math.floor(Math.random() * fallbackPool.length)]);
  }, [callVictor, addBubble, level]);

  // ── Game actions ──────────────────────────────────────────────────────────
  const initBoard = useCallback(() => {
    setBoard(Array.from({ length: size }, () => Array(size).fill(null)));
    setTurn("B" as "B" | "W"); setMoveNum(0); setCaptures({ B: 0, W: 0 });
    setMoveHistory([]); setConvHistory([]); setBubbles([]);
    setConsecutivePasses(0); setLastBoardState(null);
  }, [size]);

  async function startGame() {
    saveLocal("ns_goban_cfg", { size, level, career });
    initBoard();
    setScreen("game");
    const prompt = `Commence la session. Joueur ${level}, goban ${size}×${size}. Mode Goban de Carrière : ${career}. Lance avec quelques mots d'accueil et un conseil d'ouverture.`;
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
    setBoard(newBoard); setCaptures(newCaptures); setMoveNum(num);
    setMoveHistory((h) => [...h, mv]); setConsecutivePasses(0);
    const nextTurn: "B" | "W" = turn === "B" ? "W" : "B";
    setTurn(nextTurn);
    const who = turn === "B" ? "Noir" : "Blanc";
    const capNote = cap > 0 ? `, capturant ${cap} pierre${cap > 1 ? "s" : ""}` : "";
    const prompt = `${who} joue ${label}${capNote}. Coup n°${num} sur un goban ${size}×${size}. Réponds avec ta structure habituelle.`;
    await displayVictor(prompt);
    if (mode === "solo" && nextTurn === "W") {
      setTimeout(() => aiMove(newBoard, nextTurn), 900);
    }
  }

  function aiMove(currentBoard: Stone[][], currentTurn: Stone) {
    const empty: [number, number][] = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!currentBoard[r][c]) empty.push([r, c]);
    if (!empty.length) return;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    const newBoard = currentBoard.map((row) => row.slice());
    newBoard[r][c] = currentTurn;
    removeCaptures(newBoard, currentTurn === "B" ? "W" : "B");
    setBoard(newBoard);
    setMoveHistory((h) => [...h, { row: r, col: c, color: currentTurn, label: COLS[c] + (size - r), num: moveNum + 1 }]);
    setMoveNum((n) => n + 1);
    setTurn("B");
  }

  async function passTurn() {
    const newPasses = consecutivePasses + 1;
    setConsecutivePasses(newPasses);
    setMoveNum((n) => n + 1);
    setMoveHistory((h) => [...h, { row: -1, col: -1, color: turn, label: "Passe", num: moveNum + 1 }]);
    const nextTurn: Stone = turn === "B" ? "W" : "B";
    setTurn(nextTurn);
    if (newPasses >= 2) { await endGame(); return; }
    const who = turn === "B" ? "Noir" : "Blanc";
    await displayVictor(`${who} passe son tour. Coup n°${moveNum + 1}. Commente ce passe brièvement.`);
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
    addBubble("system", "↩ Coup annulé.");
  }

  async function askReview() {
    const recent = moveHistory.slice(-5).map((m) => `${m.num}.${m.color === "B" ? "⚫" : "⚪"}${m.label}`).join(" ");
    const sc = estimateScore(board, captures);
    await displayVictor(`Le joueur demande une analyse de position. Coup n°${moveNum}, goban ${size}×${size}. Derniers coups : ${recent || "aucun"}. Score estimé — Noir: ${sc.B}, Blanc: ${sc.W}. Fais une analyse Socratique.`);
  }

  async function endGame() {
    const sc = estimateScore(board, captures);
    setEndScore(sc);
    setScreen("end");
    const winner = sc.B > sc.W ? "Noir" : sc.B < sc.W ? "Blanc" : "Égalité";
    const recent = moveHistory.slice(-8).map((m) => `${m.num}.${m.color === "B" ? "⚫" : "⚪"}${m.label}`).join(" ");
    const prompt = `La partie est terminée. Score final : Noir ${sc.B}, Blanc ${sc.W}. ${winner === "Égalité" ? "Match nul." : winner + " gagne."} Derniers coups : ${recent}. Fais un débrief Socratique : 3 questions de réflexion + 1 conseil pour la prochaine partie.`;
    setEndDebrief(null);
    const debrief = await gen("strategist", prompt, { model: MODEL_REASONING });
    setEndDebrief(debrief ?? "Bien joué ! Réfléchis au coup le plus décisif de la partie et à ce que tu aurais fait différemment.");
  }

  async function sendUserMsg() {
    const text = userInput.trim(); if (!text) return;
    setUserInput("");
    addBubble("user", text);
    await displayVictor(text);
  }

  // ── Diagnostic ─────────────────────────────────────────────────────────────
  const STONE_POSITIONS = [
    [0, 0], [4, 4], [8, 0], [8, 8], [0, 8], [2, 2], [6, 6], [3, 5], [5, 2], [4, 7],
  ] as [number, number][];

  function answerDiag(isYes: boolean) {
    const q = DIAG_QUESTIONS[diagStep];
    const isBlack = isYes ? q.yesBlack : !q.yesBlack;
    const concept = isYes ? q.yesConcept : q.noConcept;
    const resp: DiagResponse = { question: q.q, answer: isYes ? "Oui" : "Non", concept, isBlack };
    const newResponses = [...diagResponses, resp];
    setDiagResponses(newResponses);
    if (concept !== null) {
      const [row, col] = STONE_POSITIONS[diagStep] ?? [4, 4];
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

  // ── Render helpers ─────────────────────────────────────────────────────────
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

  // ── SCREENS ────────────────────────────────────────────────────────────────

  // SETUP
  if (screen === "setup") return (
    <div style={{ padding: "var(--space-6)", maxWidth: 640, margin: "0 auto" }}>
      <PageHeader
        title="Goban Coach — Victor"
        subtitle="Apprends le Go et explore la méthode Goban de Carrière"
      />
      <Card style={{ marginBottom: "var(--space-4)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Taille du plateau</div>
            <div style={{ display: "flex", gap: 8 }}>
              {BOARD_SIZES.map((s) => <BtnOpt key={s} active={size === s} onClick={() => setSize(s)}>{s}×{s}</BtnOpt>)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Mode de jeu</div>
            <div style={{ display: "flex", gap: 8 }}>
              <BtnOpt active={mode === "2p"} onClick={() => setMode("2p")}>Joueur vs Victor</BtnOpt>
              <BtnOpt active={mode === "solo"} onClick={() => setMode("solo")}>Solo (Victor joue Blanc)</BtnOpt>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Niveau</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <BtnOpt active={level === "debutant"} onClick={() => setLevel("debutant")}>Débutant</BtnOpt>
              <BtnOpt active={level === "intermediaire"} onClick={() => setLevel("intermediaire")}>Intermédiaire</BtnOpt>
              <BtnOpt active={level === "expert"} onClick={() => setLevel("expert")}>Expert</BtnOpt>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Mode Goban de Carrière</div>
            <div style={{ display: "flex", gap: 8 }}>
              <BtnOpt active={career === "oui"} onClick={() => setCareer("oui")}>Actif — ponts avec l'entrepreneuriat</BtnOpt>
              <BtnOpt active={career === "non"} onClick={() => setCareer("non")}>Non — Go pur</BtnOpt>
            </div>
          </div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
          <div style={{ display: "flex", gap: 12 }}>
            <Button variant="gold" onClick={startGame} disabled={loading}>
              {loading ? "Initialisation…" : "▶ Lancer la partie"}
            </Button>
            <Button variant="ghost" onClick={() => { setScreen("rules"); setRuleIdx(0); }}>📖 Règles du Go</Button>
            <Button variant="ghost" onClick={() => { resetDiag(); setScreen("diagnostic"); }}>◎ Diagnostic Carrière</Button>
          </div>
        </div>
      </Card>
    </div>
  );

  // RULES
  if (screen === "rules") return (
    <div style={{ padding: "var(--space-6)", maxWidth: 720, margin: "0 auto" }}>
      <PageHeader title="Les règles du Go" subtitle="Victor te guide en 6 chapitres" />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
        {RULES.map((r, i) => (
          <BtnOpt key={i} active={ruleIdx === i} onClick={() => setRuleIdx(i)}>
            {i + 1}. {r.title.split("&")[0].trim()}
          </BtnOpt>
        ))}
      </div>
      <Card>
        <div style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--color-gold)", marginBottom: 12 }}>
          {ruleIdx + 1}. {RULES[ruleIdx].title}
        </div>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
          {RULES[ruleIdx].body}
        </div>
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

  // DIAGNOSTIC
  if (screen === "diagnostic") return (
    <div style={{ padding: "var(--space-6)", maxWidth: 720, margin: "0 auto" }}>
      <PageHeader
        title="Diagnostic Goban de Carrière"
        subtitle="10 questions · Victor lit ta position entrepreneuriale"
      />
      <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
        {/* Board */}
        <Card style={{ flex: "0 0 auto" }}>
          <DiagBoardSVG stones={diagStones} />
        </Card>
        {/* Questions or analysis */}
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
                <Button variant="gold" onClick={() => answerDiag(true)}>✓ Oui</Button>
                <Button variant="ghost" onClick={() => answerDiag(false)}>✗ Non</Button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gold)", marginBottom: 12 }}>🎭 Analyse de Victor</div>
              {loading && !diagAnalysis && (
                <div style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>Victor lit ta position…</div>
              )}
              {diagAnalysis && (
                <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {diagAnalysis.replace(/\*\*/g, "")}
                </div>
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

  // END
  if (screen === "end") return (
    <div style={{ padding: "var(--space-6)", maxWidth: 640, margin: "0 auto" }}>
      <PageHeader title="Fin de partie" subtitle="Victor débriefe la session" />
      <Card style={{ marginBottom: "var(--space-4)" }}>
        <div style={{ display: "flex", gap: 32, marginBottom: 20 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--color-text-primary)" }}>⚫ {endScore?.B ?? 0}</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>Noir</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--color-text-primary)" }}>⚪ {endScore?.W ?? 0}</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>Blanc</div>
          </div>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--color-gold)" }}>
              {endScore ? (endScore.B > endScore.W ? "⚫ Noir gagne" : endScore.B < endScore.W ? "⚪ Blanc gagne" : "Égalité") : "—"}
            </div>
          </div>
        </div>
        {loading && !endDebrief && <div style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>Victor analyse la partie…</div>}
        {endDebrief && (
          <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {endDebrief.replace(/\*\*/g, "")}
          </div>
        )}
        <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
          <Button variant="gold" onClick={() => { initBoard(); setScreen("game"); startGame(); }}>↺ Rejouer</Button>
          <Button variant="ghost" onClick={() => setScreen("setup")}>Nouvelle config</Button>
        </div>
      </Card>
    </div>
  );

  // GAME
  return (
    <div style={{ padding: "var(--space-4)", maxWidth: 1100, margin: "0 auto" }}>
      <PageHeader
        title={`Goban Coach — Victor`}
        subtitle={`${size}×${size} · ${level} · coup n°${moveNum}`}
      />
      <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", alignItems: "flex-start" }}>

        {/* Board + controls */}
        <div style={{ flex: "0 0 auto" }}>
          <Card style={{ padding: "var(--space-3)", display: "inline-block" }}>
            {/* Turn indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: turn === "B" ? "#111" : "#eee", border: "2px solid #666" }} />
              <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
                {turn === "B" ? "Noir joue" : "Blanc joue"}
              </span>
              <span style={{ marginLeft: "auto", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                ⚫ {sc.B} · ⚪ {sc.W}
              </span>
            </div>
            <BoardSVG board={board} size={size} moveHistory={moveHistory} onPlace={placeStone} />
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <Button variant="ghost" onClick={passTurn}>Passer</Button>
              <Button variant="ghost" onClick={undoMove}>↩ Annuler</Button>
              <Button variant="ghost" onClick={askReview} disabled={loading}>◎ Analyse</Button>
              <Button variant="ghost" onClick={() => { setScreen("rules"); setRuleIdx(0); }}>📖 Règles</Button>
              <Button variant="ghost" onClick={() => setScreen("setup")}>✕ Quitter</Button>
            </div>
          </Card>
        </div>

        {/* Victor panel */}
        <div style={{ flex: 1, minWidth: 280, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {/* Move list */}
          <Card style={{ padding: "var(--space-3)" }}>
            <div style={{ fontSize: 10, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Coups joués</div>
            <div style={{ maxHeight: 80, overflowY: "auto", display: "flex", flexWrap: "wrap", gap: 4 }}>
              {moveHistory.slice(-20).map((mv) => (
                <span key={mv.num} style={{ fontSize: 11, color: "var(--color-text-muted)", background: "rgba(255,255,255,0.04)", borderRadius: 4, padding: "2px 5px" }}>
                  {mv.num}.{mv.color === "B" ? "⚫" : "⚪"}{mv.label}
                </span>
              ))}
            </div>
          </Card>

          {/* Chat */}
          <Card style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 320 }}>
            <div style={{ fontSize: 10, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>🎭 Victor</div>
            <div ref={bubblesRef} style={{ flex: 1, overflowY: "auto", maxHeight: 380, paddingRight: 4 }}>
              {bubbles.map((b) => <Bubble key={b.id} bubble={b} />)}
              {thinking && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
                  <span>🎭</span>
                  <span style={{ animation: "pulse 1.5s infinite" }}>Victor réfléchit…</span>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendUserMsg()}
                placeholder="Poser une question à Victor…"
                style={{
                  flex: 1, padding: "8px 12px", borderRadius: 8,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "var(--color-text-primary)", fontSize: "var(--text-sm)", outline: "none",
                }}
              />
              <Button variant="gold" onClick={sendUserMsg} disabled={loading || !userInput.trim()}>↑</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
