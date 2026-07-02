import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { useAiGen, MODEL_REASONING } from "@/lib/useAiGen";

/* ============================================================
   ORACLE ANIMAL — Tirage symbolique pour solopreneurs
   Données mockées en local, lecture approfondie via ai-proxy
   ============================================================ */

interface Animal {
  id: string; label: string; emoji: string;
  meaning: string[]; themes: string[];
  message: string; business: string; shadow: string;
  action: string; question: string; mobile: string;
}

const ANIMALS: Animal[] = [
  {
    id: "aigle", label: "Aigle", emoji: "🦅",
    meaning: ["Vision", "Stratégie", "Hauteur"],
    themes: ["Marketing", "Cap", "Leadership"],
    message: "Prends de la hauteur avant de trancher.",
    business: "Ton projet a besoin d'un cap clair, pas de plus d'efforts. L'Aigle t'invite à regarder la carte entière avant de reprendre la route.",
    shadow: "Trop de distance : survoler sans jamais atterrir dans l'action.",
    action: "Écris en une phrase où tu veux être dans 90 jours, puis raye tout ce qui n'y contribue pas cette semaine.",
    question: "Si je regardais mon activité depuis très haut, qu'est-ce qui sauterait aux yeux ?",
    mobile: "Vois grand, décide net.",
  },
  {
    id: "ours", label: "Ours", emoji: "🐻",
    meaning: ["Force", "Protection", "Guérison"],
    themes: ["Résilience", "Limites", "Sécurité"],
    message: "Ta force vient de tes limites, pas de ton endurance.",
    business: "L'Ours protège son territoire et hiberne quand il le faut. Ton business a peut-être besoin que tu dises non plus souvent que oui.",
    shadow: "S'isoler dans sa grotte : confondre protection et évitement.",
    action: "Identifie une demande ou un client qui draine ton énergie et pose une limite claire aujourd'hui.",
    question: "Qu'est-ce que je continue à accepter alors que ça m'épuise ?",
    mobile: "Protège ton énergie.",
  },
  {
    id: "loup", label: "Loup", emoji: "🐺",
    meaning: ["Loyauté", "Clan", "Instinct"],
    themes: ["Réseau", "Communauté", "Équipe"],
    message: "Tu n'es pas fait pour chasser seul.",
    business: "Le Loup réussit en meute. Ton prochain palier passe par ton réseau : partenaires, pairs, communauté de clients.",
    shadow: "Dépendre du groupe au point de perdre sa propre direction.",
    action: "Contacte aujourd'hui une personne de ton réseau, sans rien vendre — juste pour nourrir le lien.",
    question: "Qui fait partie de ma meute, et qui ai-je négligé ?",
    mobile: "Active ta meute.",
  },
  {
    id: "hibou", label: "Hibou", emoji: "🦉",
    meaning: ["Clarté", "Intuition", "Signaux faibles"],
    themes: ["Diagnostic", "Veille", "Décision"],
    message: "Regarde ce qui n'est pas encore visible.",
    business: "Avant d'agir, observe les signaux faibles de ton marché : ce que tes clients disent entre les lignes, ce que tes chiffres murmurent.",
    shadow: "Trop réfléchir et ne rien décider — la paralysie de l'observateur.",
    action: "Écris 3 hypothèses sur ta situation et teste la plus simple avant demain soir.",
    question: "Qu'est-ce que je sais déjà, mais que j'évite de voir ?",
    mobile: "Observe, puis tranche.",
  },
  {
    id: "corbeau", label: "Corbeau", emoji: "🐦‍⬛",
    meaning: ["Transformation", "Intelligence", "Créativité"],
    themes: ["Pivot", "Innovation", "Solution"],
    message: "Ce qui semble une fin est un matériau de construction.",
    business: "Le Corbeau fabrique des outils avec ce qu'il trouve. Ton blocage actuel contient probablement la matière première de ton prochain pivot.",
    shadow: "Tout déconstruire en permanence sans jamais consolider.",
    action: "Prends ton plus gros problème actuel et liste 3 façons de le transformer en offre ou en contenu.",
    question: "Qu'est-ce qui est en train de mourir dans mon activité, et qu'est-ce que ça libère ?",
    mobile: "Transforme l'obstacle.",
  },
  {
    id: "tortue", label: "Tortue", emoji: "🐢",
    meaning: ["Patience", "Structure", "Durée"],
    themes: ["Planification", "Rythme", "Stabilité"],
    message: "Lent et régulier construit ce que rapide et brillant détruit.",
    business: "Ton business a besoin de fondations, pas de sprints. La Tortue gagne parce qu'elle ne s'arrête jamais, pas parce qu'elle accélère.",
    shadow: "La lenteur comme excuse : se cacher dans la préparation infinie.",
    action: "Choisis une action minuscule que tu peux répéter chaque jour pendant 30 jours, et fais-la maintenant.",
    question: "Quelle habitude, répétée un an, changerait tout ?",
    mobile: "Avance chaque jour.",
  },
  {
    id: "bison", label: "Bison", emoji: "🦬",
    meaning: ["Abondance", "Endurance", "Gratitude"],
    themes: ["Ressources", "Offre", "Constance"],
    message: "Tu as déjà plus de ressources que tu ne le crois.",
    business: "Le Bison affronte la tempête de face parce qu'il sait qu'elle passe plus vite ainsi. Inventorie ce que tu possèdes déjà avant de chercher ailleurs.",
    shadow: "Accumuler sans distribuer : la richesse qui dort ne nourrit personne.",
    action: "Liste 5 actifs que tu sous-exploites (contenus, contacts, compétences) et choisis-en un à réactiver.",
    question: "De quoi suis-je déjà riche sans le reconnaître ?",
    mobile: "Exploite tes acquis.",
  },
  {
    id: "cerf", label: "Cerf", emoji: "🦌",
    meaning: ["Sensibilité", "Élégance", "Vigilance"],
    themes: ["Relation client", "Finesse", "Écoute"],
    message: "Ta sensibilité est un instrument de mesure, pas une faiblesse.",
    business: "Le Cerf perçoit ce que les autres ratent. Ta capacité à sentir tes clients est ton avantage concurrentiel le plus sous-coté.",
    shadow: "Fuir au moindre bruit : la sur-réactivité qui empêche la présence.",
    action: "Rappelle un client récent et pose-lui une seule question : « Qu'est-ce qui t'a le plus aidé ? » Écoute sans vendre.",
    question: "Qu'est-ce que mes clients ressentent que je n'ai pas encore mis en mots ?",
    mobile: "Écoute finement.",
  },
  {
    id: "saumon", label: "Saumon", emoji: "🐟",
    meaning: ["Persévérance", "Cycle", "Retour à la source"],
    themes: ["Recentrage", "Relance", "Continuité"],
    message: "Remonte à la source de pourquoi tu as commencé.",
    business: "Le Saumon nage à contre-courant pour retourner là où tout a commencé. Ton énergie reviendra quand tu reconnecteras ton offre à ton intention d'origine.",
    shadow: "S'épuiser à contre-courant par principe, quand un autre chemin existe.",
    action: "Relis ta toute première présentation de ton activité et note ce qui est resté vrai.",
    question: "Pourquoi ai-je commencé, et est-ce encore ma raison d'avancer ?",
    mobile: "Reviens à l'essentiel.",
  },
  {
    id: "castor", label: "Castor", emoji: "🦫",
    meaning: ["Construction", "Méthode", "Persévérance"],
    themes: ["Process", "Exécution", "Organisation"],
    message: "Construis le système, pas seulement le résultat.",
    business: "Le Castor ne construit pas un barrage, il construit un écosystème. Chaque tâche répétitive de ton business mérite un process ou une automatisation.",
    shadow: "Sur-construire : passer plus de temps sur l'outil que sur le client.",
    action: "Identifie une tâche que tu as faite 3 fois ce mois et documente-la ou automatise-la aujourd'hui.",
    question: "Qu'est-ce que je refais sans cesse au lieu de le systématiser ?",
    mobile: "Systématise une chose.",
  },
  {
    id: "loutre", label: "Loutre", emoji: "🦦",
    meaning: ["Joie", "Curiosité", "Créativité"],
    themes: ["Idéation", "Jeu", "Expérimentation"],
    message: "Le jeu est une méthode de travail sérieuse.",
    business: "La Loutre apprend en jouant. Ton prochain produit gagnant naîtra peut-être d'une expérimentation légère, pas d'un plan solennel.",
    shadow: "Papillonner : dix expériences ouvertes, aucune terminée.",
    action: "Lance aujourd'hui un micro-test sans enjeu : un post, un sondage, un format inédit. Juste pour voir.",
    question: "Qu'est-ce que je ferais dans mon business si c'était juste pour le plaisir ?",
    mobile: "Teste en jouant.",
  },
  {
    id: "coyote", label: "Coyote", emoji: "🐕",
    meaning: ["Ruse", "Humour", "Adaptation"],
    themes: ["Imprévu", "Agilité", "Débrouille"],
    message: "Le plan parfait n'existe pas, l'adaptation oui.",
    business: "Le Coyote survit partout parce qu'il improvise. Ce qui déraille dans ton plan est peut-être une invitation à faire autrement, moins cher, plus vite.",
    shadow: "La débrouille permanente qui empêche de bâtir du solide.",
    action: "Prends un obstacle actuel et trouve la solution la moins chère et la plus rapide, même imparfaite.",
    question: "Où est-ce que je complique ce qui pourrait être simple ?",
    mobile: "Improvise malin.",
  },
  {
    id: "faucon", label: "Faucon", emoji: "🦅",
    meaning: ["Observation", "Précision", "Rapidité"],
    themes: ["Opportunité", "Ciblage", "Focus"],
    message: "Une cible, un piqué, pas de dispersion.",
    business: "Le Faucon repère de loin puis frappe une seule proie. Ton marketing gagnerait à viser un segment précis plutôt qu'à arroser large.",
    shadow: "La précision qui devient rigidité : rater les proies imprévues.",
    action: "Choisis UNE cible client précise et adresse-lui un message dédié aujourd'hui — un seul.",
    question: "Quelle opportunité précise ai-je repérée sans encore fondre dessus ?",
    mobile: "Vise une cible.",
  },
  {
    id: "serpent", label: "Serpent", emoji: "🐍",
    meaning: ["Transformation", "Mue", "Guérison"],
    themes: ["Changement", "Repositionnement", "Transition"],
    message: "Ce que tu quittes te serrait déjà trop.",
    business: "Le Serpent mue parce que sa peau devient trop petite. Un positionnement, un tarif ou une offre de ton passé ne correspond plus à qui tu es devenu.",
    shadow: "Muer en boucle : changer d'identité avant d'avoir habité la précédente.",
    action: "Nomme une chose de ton activité qui appartient à ton ancienne version, et décide de sa date de fin.",
    question: "Quelle peau professionnelle suis-je en train de quitter ?",
    mobile: "Laisse partir l'ancien.",
  },
  {
    id: "cheval", label: "Cheval", emoji: "🐎",
    meaning: ["Liberté", "Énergie", "Mouvement"],
    themes: ["Lancement", "Expansion", "Dynamisme"],
    message: "L'élan compte plus que la perfection du départ.",
    business: "Le Cheval n'attend pas que la piste soit parfaite pour galoper. C'est le moment de lancer, d'annoncer, de bouger — l'ajustement se fera en course.",
    shadow: "Galoper sans direction : beaucoup de mouvement, peu de progression.",
    action: "Annonce publiquement quelque chose aujourd'hui : une offre, une date, une intention. Crée l'engagement.",
    question: "Qu'est-ce que j'attends pour me lancer, et cette attente est-elle vraiment nécessaire ?",
    mobile: "Lance-toi maintenant.",
  },
  {
    id: "renard", label: "Renard", emoji: "🦊",
    meaning: ["Astuce", "Discrétion", "Intelligence pratique"],
    themes: ["Tactique", "Négociation", "Finesse"],
    message: "Il y a toujours un passage que les autres ne voient pas.",
    business: "Le Renard ne force jamais, il contourne. Ta prochaine victoire viendra d'une approche latérale : un partenariat inattendu, un angle que personne n'exploite.",
    shadow: "La ruse qui érode la confiance : trop malin devient suspect.",
    action: "Trouve une manière détournée d'atteindre un objectif bloqué : qui pourrait t'ouvrir la porte à ta place ?",
    question: "Quel chemin indirect ai-je écarté trop vite ?",
    mobile: "Cherche le passage caché.",
  },
  {
    id: "chien", label: "Chien", emoji: "🐕‍🦺",
    meaning: ["Fidélité", "Protection", "Compagnie"],
    themes: ["Confiance", "Service", "Relation"],
    message: "La confiance se construit par la constance, pas par l'éclat.",
    business: "Le Chien gagne sa place par sa fiabilité. Tes clients existants sont ton meilleur canal de croissance : prends-en soin avant de courir après les nouveaux.",
    shadow: "La loyauté aveugle : rester fidèle à ce qui ne te sert plus.",
    action: "Fais aujourd'hui un geste gratuit pour un client fidèle : une ressource, un conseil, un merci sincère.",
    question: "À qui — ou à quoi — suis-je fidèle par habitude plutôt que par choix ?",
    mobile: "Soigne tes fidèles.",
  },
  {
    id: "chat", label: "Chat", emoji: "🐈",
    meaning: ["Indépendance", "Intuition", "Autonomie"],
    themes: ["Solo", "Rythme propre", "Sensibilité"],
    message: "Ton rythme n'a pas à ressembler à celui des autres.",
    business: "Le Chat ne court pas quand la meute court. Ton business solo a le droit de fonctionner selon tes règles : horaires, formats, cadence.",
    shadow: "L'indépendance qui devient isolement : refuser toute aide par principe.",
    action: "Supprime de ton agenda une obligation que tu t'imposes par mimétisme, pas par utilité.",
    question: "Qu'est-ce que je fais parce que « ça se fait », et non parce que ça me sert ?",
    mobile: "Suis ton rythme.",
  },
  {
    id: "puma", label: "Puma", emoji: "🐆",
    meaning: ["Leadership", "Assurance", "Présence"],
    themes: ["Décision", "Positionnement", "Force tranquille"],
    message: "Ta présence décide avant tes mots.",
    business: "Le Puma n'a pas besoin de rugir. Ton positionnement gagnerait à plus d'affirmation calme : des prix assumés, un discours sans justification.",
    shadow: "La solitude du sommet : décider seul de ce qui mériterait un regard extérieur.",
    action: "Reprends un texte de vente ou un tarif et enlève toutes les justifications. Affirme, point.",
    question: "Où est-ce que je m'excuse d'exister professionnellement ?",
    mobile: "Assume ta place.",
  },
  {
    id: "colibri", label: "Colibri", emoji: "🐦",
    meaning: ["Légèreté", "Cœur", "Vitalité"],
    themes: ["Motivation", "Inspiration", "Douceur"],
    message: "Fais ta part, avec joie, sans porter le monde.",
    business: "Le Colibri butine précisément ce qui le nourrit. Reconnecte-toi à ce qui te donne de l'énergie dans ton activité — c'est là que tu es le plus rentable.",
    shadow: "La légèreté qui fuit : éviter les sujets lourds mais nécessaires.",
    action: "Bloque 30 minutes aujourd'hui pour la partie de ton travail qui te met en joie. Sans culpabilité.",
    question: "Qu'est-ce qui me donne de l'énergie dans mon activité, et comment en faire plus ?",
    mobile: "Nourris ta joie.",
  },
];

const CONTEXTS = [
  { id: "offrir", label: "Clarifier mon offre", intro: "Tu cherches à clarifier ce que tu proposes au monde." },
  { id: "vendre", label: "Trouver des clients", intro: "Tu cherches à attirer et convaincre tes prochains clients." },
  { id: "communiquer", label: "Mieux communiquer", intro: "Tu cherches le bon message et le bon canal." },
  { id: "decider", label: "Prendre une décision", intro: "Tu es face à un choix qui demande de la clarté." },
  { id: "repositionner", label: "Me repositionner", intro: "Tu sens qu'un cycle se termine et qu'un autre commence." },
];

interface Spread { id: string; label: string; desc: string; positions: { name: string; type: string }[] }

const SPREADS: Spread[] = [
  {
    id: "daily", label: "Tirage du jour", desc: "1 minute · 3 cartes",
    positions: [
      { name: "Énergie du jour", type: "energy" },
      { name: "Défi", type: "challenge" },
      { name: "Action", type: "action" },
    ],
  },
  {
    id: "decision", label: "Tirage de décision", desc: "3 minutes · 4 cartes",
    positions: [
      { name: "Contexte", type: "energy" },
      { name: "Blocage", type: "challenge" },
      { name: "Ressource", type: "resource" },
      { name: "Prochain pas", type: "action" },
    ],
  },
  {
    id: "launch", label: "Tirage de lancement", desc: "5 minutes · 5 cartes",
    positions: [
      { name: "Vision", type: "energy" },
      { name: "Obstacle", type: "challenge" },
      { name: "Alignement", type: "resource" },
      { name: "Action immédiate", type: "action" },
      { name: "Message final", type: "final" },
    ],
  },
];

function interpret(animal: Animal, posType: string): string {
  switch (posType) {
    case "energy": return `${animal.message} — ${animal.business}`;
    case "challenge": return `Angle mort à surveiller : ${animal.shadow}`;
    case "resource": return `Appuie-toi sur ${animal.meaning.join(", ").toLowerCase()}. Terrain d'application : ${animal.themes.join(", ").toLowerCase()}.`;
    case "action": return animal.action;
    case "final": return `${animal.mobile} Garde cette question avec toi : « ${animal.question} »`;
    default: return animal.message;
  }
}

function drawCards(n: number): Animal[] {
  const pool = [...ANIMALS];
  const drawn: Animal[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    drawn.push(pool.splice(idx, 1)[0]);
  }
  return drawn;
}

function promptOracle(context: (typeof CONTEXTS)[number], intention: string, spread: Spread, cards: Animal[]): string {
  const cardsDesc = cards.map((c, i) =>
    `Position "${spread.positions[i].name}" : ${c.label} (symbolique : ${c.meaning.join(", ")} ; ombre : ${c.shadow})`
  ).join("\n");
  return `Tu es un guide symbolique pour solopreneurs et entrepreneurs. À partir d'un tirage d'animaux, d'un contexte business et d'une intention, tu produis une lecture courte, concrète et utile.

Règles : évite les prédictions absolues, évite les réponses oui/non, parle en langage clair, inspirant et pratico-pratique, relie chaque animal à une compétence business, tutoie le lecteur.

Contexte choisi : ${context.label}
Intention exprimée : ${intention || "non précisée"}
Type de tirage : ${spread.label}
Cartes tirées :
${cardsDesc}

Produis une lecture de synthèse en français (200 mots max) qui relie les cartes entre elles, identifie un angle mort global, propose UNE action simple à faire aujourd'hui, et termine par UNE question de journaling. Texte fluide, pas de titres, pas de listes.`;
}

type Step = "context" | "spread" | "draw" | "reading";

export function Oracle() {
  const { gen, loading: aiLoading, error: aiError, setError } = useAiGen();

  const [step, setStep] = useState<Step>("context");
  const [context, setContext] = useState<(typeof CONTEXTS)[number] | null>(null);
  const [intention, setIntention] = useState("");
  const [spread, setSpread] = useState<Spread | null>(null);
  const [cards, setCards] = useState<Animal[]>([]);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [aiReading, setAiReading] = useState<string | null>(null);

  const allRevealed = cards.length > 0 && revealed.length === cards.length;

  function startDraw(s: Spread) {
    setSpread(s);
    setCards(drawCards(s.positions.length));
    setRevealed([]);
    setAiReading(null);
    setError(null);
    setStep("draw");
  }

  function reveal(i: number) {
    setRevealed((prev) => (prev.includes(i) ? prev : [...prev, i]));
  }

  function reset() {
    setStep("context");
    setContext(null);
    setIntention("");
    setSpread(null);
    setCards([]);
    setRevealed([]);
    setAiReading(null);
    setError(null);
  }

  async function fetchAiReading() {
    if (!context || !spread) return;
    const r = await gen("nova", promptOracle(context, intention, spread, cards), { model: MODEL_REASONING });
    if (r) setAiReading(r);
  }

  return (
    <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <PageHeader title="Oracle · L'Animal du Jour" subtitle="Un tirage symbolique pour éclairer tes décisions d'entrepreneur. Pas une prédiction — un miroir." />

      <style>{`
        .oracle-choice {
          background: var(--color-bg-input);
          border: var(--border-gold);
          border-radius: var(--radius-md);
          padding: var(--space-4) var(--space-5);
          color: var(--color-text-primary);
          font-family: var(--font-body);
          font-size: var(--text-base);
          cursor: pointer;
          text-align: left;
          transition: border-color var(--transition-base), background var(--transition-base), transform var(--transition-fast);
          display: flex; justify-content: space-between; align-items: center;
          width: 100%;
        }
        .oracle-choice:hover, .oracle-choice:focus-visible {
          border-color: var(--color-gold); background: var(--color-gold-glow);
          transform: translateY(-1px); outline: none;
        }
        .oracle-choice small { color: var(--color-text-muted); font-size: var(--text-xs); }

        .oracle-card { width: 108px; height: 162px; perspective: 900px; cursor: pointer; border: none; background: none; padding: 0; }
        .oracle-card-wrap { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform .7s cubic-bezier(.4,.1,.2,1); }
        .oracle-card.flipped .oracle-card-wrap { transform: rotateY(180deg); }
        .oracle-face { position: absolute; inset: 0; backface-visibility: hidden; border-radius: var(--radius-md); display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .oracle-face.back { background: var(--color-bg-surface); border: var(--border-gold); }
        .oracle-face.back .glyph { font-family: var(--font-display); font-size: 32px; color: var(--color-gold); }
        .oracle-face.front { background: linear-gradient(160deg, #efe6d0, #ddd0b2); color: #2a2418; transform: rotateY(180deg); border: 1px solid var(--color-gold); }
        .oracle-face.front .animal-emoji { font-size: 40px; filter: sepia(.4) contrast(1.05); }
        .oracle-face.front .animal-name { font-family: var(--font-display); font-size: 18px; font-weight: 600; margin-top: 4px; }
        .oracle-face.front .animal-kw { font-size: 10px; color: #6b5d3e; margin-top: 2px; padding: 0 8px; text-align: center; }

        @media (prefers-reduced-motion: reduce) { .oracle-card-wrap { transition: none; } }
      `}</style>

      {step === "context" && (
        <>
          <p style={{ ...LBL_STYLE }}>1 · Ton contexte</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {CONTEXTS.map((c) => (
              <button key={c.id} className="oracle-choice" onClick={() => { setContext(c); setStep("spread"); }}>
                {c.label}
              </button>
            ))}
          </div>
          <textarea
            rows={2}
            placeholder="Optionnel : précise ton intention en une phrase…"
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            style={FIELD_STYLE}
          />
        </>
      )}

      {step === "spread" && context && (
        <>
          <p style={LBL_STYLE}>2 · Ton tirage</p>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>{context.intro}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {SPREADS.map((s) => (
              <button key={s.id} className="oracle-choice" onClick={() => startDraw(s)}>
                <span>{s.label}</span>
                <small>{s.desc}</small>
              </button>
            ))}
          </div>
          <div>
            <Button variant="ghost" size="sm" onClick={() => setStep("context")}>← Changer de contexte</Button>
          </div>
        </>
      )}

      {step === "draw" && spread && (
        <>
          <p style={LBL_STYLE}>3 · Retourne tes cartes</p>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>Clique chaque carte pour la révéler.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", justifyContent: "center" }}>
            {cards.map((card, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "var(--tracking-wider)", marginBottom: "var(--space-2)" }}>
                  {spread.positions[i].name}
                </div>
                <button
                  className={`oracle-card ${revealed.includes(i) ? "flipped" : ""}`}
                  onClick={() => reveal(i)}
                  aria-label={revealed.includes(i) ? card.label : `Révéler la carte ${spread.positions[i].name}`}
                >
                  <div className="oracle-card-wrap">
                    <div className="oracle-face back"><span className="glyph">✦</span></div>
                    <div className="oracle-face front">
                      <span className="animal-emoji">{card.emoji}</span>
                      <span className="animal-name">{card.label}</span>
                      <span className="animal-kw">{card.meaning.join(" · ")}</span>
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>
          {allRevealed && (
            <Button variant="gold" onClick={() => setStep("reading")}>Lire mon tirage</Button>
          )}
        </>
      )}

      {step === "reading" && context && spread && (
        <div>
          <p style={LBL_STYLE}>Ta lecture · {spread.label}</p>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", marginBottom: "var(--space-5)" }}>
            {context.intro}{intention ? ` Ton intention : « ${intention} »` : ""}
          </p>

          {cards.map((card, i) => (
            <div key={i} style={READING_BLOCK}>
              <div style={{ fontSize: "var(--text-xs)", letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-gold)" }}>
                {spread.positions[i].name}
              </div>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", margin: "var(--space-1) 0 0", color: "var(--color-text-primary)", fontWeight: 600 }}>
                {card.emoji} {card.label}
              </h3>
              <p style={{ margin: "var(--space-2) 0 0", lineHeight: "var(--leading-normal)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
                {interpret(card, spread.positions[i].type)}
              </p>
            </div>
          ))}

          <div style={{ ...READING_BLOCK, borderLeftColor: "var(--color-text-muted)" }}>
            <div style={{ fontSize: "var(--text-xs)", letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Journaling</div>
            <p style={{ fontStyle: "italic", margin: "var(--space-2) 0 0", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
              « {cards[cards.length - 1].question} »
            </p>
          </div>

          {!aiReading && (
            <div style={{ marginTop: "var(--space-4)" }}>
              <Button variant="gold" loading={aiLoading} onClick={fetchAiReading}>✦ Lecture approfondie par IA</Button>
            </div>
          )}
          {aiError && <p style={{ color: "var(--color-danger)", fontSize: "var(--text-sm)", marginTop: "var(--space-3)" }}>{aiError}</p>}
          {aiReading && (
            <div style={{ background: "var(--color-gold-glow)", border: "var(--border-gold)", borderRadius: "var(--radius-md)", padding: "var(--space-5)", marginTop: "var(--space-5)" }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", margin: "0 0 var(--space-2)", color: "var(--color-gold)", fontWeight: 600 }}>✦ Lecture approfondie</h3>
              <p style={{ lineHeight: "var(--leading-loose)", fontSize: "var(--text-sm)", margin: 0, whiteSpace: "pre-wrap", color: "var(--color-text-secondary)" }}>{aiReading}</p>
            </div>
          )}

          <div style={{ marginTop: "var(--space-6)" }}>
            <Button variant="ghost" onClick={reset}>Nouveau tirage</Button>
          </div>
        </div>
      )}
    </div>
  );
}

const LBL_STYLE: React.CSSProperties = {
  fontSize: "var(--text-xs)", letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-gold)", margin: 0,
};

const FIELD_STYLE: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", background: "var(--color-bg-input)", border: "var(--border-subtle)",
  borderRadius: "var(--radius-sm)", color: "var(--color-text-primary)", fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)", padding: "var(--space-3) var(--space-4)", outline: "none", resize: "none",
};

const READING_BLOCK: React.CSSProperties = {
  background: "var(--color-bg-input)", borderLeft: "2px solid var(--color-gold)", borderRadius: "0 var(--radius-md) var(--radius-md) 0",
  padding: "var(--space-4) var(--space-5)", marginBottom: "var(--space-3)",
};
