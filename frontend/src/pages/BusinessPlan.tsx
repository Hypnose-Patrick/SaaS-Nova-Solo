import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useUserStore } from "@/stores/useUserStore";
import { useAppStore } from "@/stores/useAppStore";
import { askAgent } from "@/lib/ai";
import { printHtml, downloadWord } from "@/lib/exportDoc";
import { fillTemplate } from "@/lib/fillTemplate";
import bpTemplateHtml from "@/lib/templates/business-plan.html?raw";
import { loadFinanceModel, buildBudgetMarkdown } from "@/lib/finance";
import { ExportGate } from "@/components/ExportGate";

// Les 9 blocs du Business Model Canvas (mêmes clés que la page BMC).
const BMC_LABELS: Record<string, string> = {
  segments: "Segments clients", valeur: "Proposition de valeur", canaux: "Canaux",
  relations: "Relations clients", revenus: "Flux de revenus", ressources: "Ressources clés",
  activites: "Activités clés", partenaires: "Partenaires clés", couts: "Structure de coûts",
};

// Structure alignée sur le template officiel d'une banque cantonale suisse
// (BCVS « Aide à la rédaction Business Plan ») : 10 sections attendues dans
// un dossier de crédit / cautionnement. `aiGuide` ancre la rédaction IA.
const SECTIONS = [
  {
    key:         "bp_executive",
    num:         "01",
    title:       "Résumé exécutif",
    hint:        "Qui vous êtes, votre offre, pour qui, pourquoi maintenant.",
    placeholder: "Coach certifié spécialisé dans la reconversion des cadres suisses romands. Offre de 3 séances diagnostics + suivi mensuel à CHF 450/mois. Différenciation : approche intégrant hypnose et stratégie concrète…",
    aiGuide:     "Synthèse d'une page : projet, porteur, marché, besoin de financement et rentabilité visée. C'est la première chose que lit le conseiller bancaire.",
  },
  {
    key:         "bp_founder",
    num:         "02",
    title:       "Porteur de projet",
    hint:        "Parcours, formation, expérience, compétences clés, motivation.",
    placeholder: "15 ans en RH dont 6 comme responsable formation. Certifié coach ICF + praticien PNL. Réseau actif dans l'industrie romande. Motivation : accompagner les transitions que j'ai moi-même vécues…",
    aiGuide:     "Mets en avant la crédibilité et la légitimité du porteur (formation, expérience, certifications, réseau) — c'est un critère décisif pour une banque ou un cautionnement. Reste factuel, pas de superlatifs gratuits.",
  },
  {
    key:         "bp_offer",
    num:         "03",
    title:       "Offre & Positionnement",
    hint:        "Services, tarifs, packages, argument de différenciation clé.",
    placeholder: "Séances individuelles à CHF 150 (1h). Package Lancement 3 mois : CHF 1 200. Formation en ligne : CHF 297. Positionnement premium local-first…",
    aiGuide:     "Décris le problème résolu et la valeur ajoutée concrète. Distingue l'offre de la concurrence locale.",
  },
  {
    key:         "bp_market",
    num:         "04",
    title:       "Marché cible",
    hint:        "Profil client idéal (ICP), besoins, taille du marché, concurrence.",
    placeholder: "ICP : 35–55 ans, cadre ou indépendant romand, en transition ou stagnation professionnelle. Budget disponible CHF 200–500/mois. Concurrents directs : coaches généralistes, plateformes en ligne (Malt, CoachHub)…",
    aiGuide:     "Quantifie le marché si des chiffres existent dans le contexte ; sinon reste qualitatif. Nomme 2–3 concurrents et le positionnement relatif.",
  },
  {
    key:         "bp_commercial",
    num:         "05",
    title:       "Stratégie commerciale",
    hint:        "Canaux d'acquisition, script de vente, fidélisation, objectifs trimestriels.",
    placeholder: "Canaux : réseau LinkedIn, bouche-à-oreille, partenariats RH, contenu organique. Objectif T1 : 5 clients. Conversion : 1 RDV offert → proposition → suivi. Fidélisation : check-in mensuel gratuit…",
    aiGuide:     "Canaux d'acquisition réalistes pour un indépendant romand, tunnel de conversion, et objectifs trimestriels mesurables.",
  },
  {
    key:         "bp_legal",
    num:         "06",
    title:       "Forme juridique",
    hint:        "Structure choisie (RI / Sàrl / SA) et justification.",
    placeholder: "Démarrage en raison individuelle (pas de capital minimum, comptabilité simplifiée, inscription au RC dès CHF 100'000 de CA). Passage en Sàrl envisagé à M12 pour limiter la responsabilité…",
    aiGuide:     "Compare raison individuelle, Sàrl et éventuellement SA selon la situation. Repères suisses : RI = responsabilité illimitée, pas de capital minimum, inscription au registre du commerce obligatoire dès 100'000 CHF de CA ; Sàrl = capital 20'000 CHF, responsabilité limitée ; SA = capital 100'000 CHF (50'000 libérés). Justifie le choix retenu. N'affirme rien sur la fiscalité personnelle exacte (renvoie à la fiduciaire).",
  },
  {
    key:         "bp_organisation",
    num:         "07",
    title:       "Organisation & ressources",
    hint:        "Équipe, partenaires, sous-traitants, locaux, outils, assurances.",
    placeholder: "Solo la première année. Comptabilité déléguée à une fiduciaire. Bureau partagé à Lausanne. Partenaires : 2 thérapeutes pour orientation croisée. Assurance RC professionnelle + LAA…",
    aiGuide:     "Décris les ressources humaines et matérielles, les partenaires clés et les externalisations (fiduciaire, etc.). Mentionne les assurances pertinentes (RC pro, LAA, perte de gain) sans inventer de montants.",
  },
  {
    key:         "bp_financials",
    num:         "08",
    title:       "Plan financier",
    hint:        "CA mensuel cible, charges, point mort, projection 12 mois.",
    placeholder: "CA cible M6 : CHF 5 000/mois. Charges fixes : CHF 2 200 (loyer bureau partagé, assurances, outils). Point mort : 5 clients/mois. Projection M12 : CHF 8 000 (10 clients + produit en ligne)…",
    aiGuide:     "Appuie-toi STRICTEMENT sur le budget réel injecté depuis Finances s'il est présent. Commente liquidités, point mort et besoin de financement. N'invente aucun chiffre.",
  },
  {
    key:         "bp_risks",
    num:         "09",
    title:       "Risques & mesures",
    hint:        "Principaux risques et plan B (analyse demandée par les banques).",
    placeholder: "Risque : montée en charge clients plus lente que prévu → réserve de trésorerie 3 mois + activité de transition à temps partiel. Risque : dépendance à un canal → diversifier dès M4…",
    aiGuide:     "Identifie 3–5 risques concrets (commercial, financier, dépendance, santé/disponibilité du solo) et pour chacun une mesure d'atténuation réaliste. Section explicitement attendue dans un dossier bancaire.",
  },
  {
    key:         "bp_roadmap",
    num:         "10",
    title:       "Roadmap 12 mois",
    hint:        "Jalons clés, milestones, ressources nécessaires.",
    placeholder: "M1–2 : Positionnement + 3 premiers clients. M3–4 : Stabiliser 6 clients récurrents. M5–6 : Lancer produit digital. M7–9 : Atteindre point mort. M10–12 : Recruter 1 partenaire ou déléguer admin…",
    aiGuide:     "Jalons trimestriels concrets et mesurables, alignés sur le plan financier (point mort, lancements).",
  },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildAiPrompt(
  key: SectionKey,
  sections: Record<string, string>,
  bmcSummary: string,
  profile: ReturnType<typeof useUserStore.getState>["profile"],
): string {
  // Contexte = profil + BMC + toutes les autres sections déjà remplies.
  const sectionCtx = SECTIONS
    .filter((s) => s.key !== key && sections[s.key])
    .map((s) => `${s.title} : ${sections[s.key]}`);
  const ctx = [
    profile?.name     ? `Prénom : ${profile.name}` : null,
    profile?.domaine  ? `Domaine : ${profile.domaine}` : null,
    profile?.situation ? `Situation : ${profile.situation}` : null,
    [profile?.ville, profile?.canton].filter(Boolean).length ? `Localisation : ${[profile?.ville, profile?.canton].filter(Boolean).join(" ")}` : null,
    bmcSummary ? `Business Model Canvas de l'utilisateur :\n${bmcSummary}` : null,
    ...sectionCtx,
  ].filter(Boolean).join("\n");

  const sec = SECTIONS.find((s) => s.key === key)!;
  return `Tu es Hermès-Stratège, expert en plans d'affaires pour indépendants de Suisse romande.\n\n` +
    `Contexte disponible :\n${ctx || "(aucun)"}\n\n` +
    `Rédige la section "${sec.title}" (${sec.hint}) en 200–350 mots, ton professionnel mais humain, orienté action et chiffres concrets. ` +
    `Consigne pour cette section : ${sec.aiGuide} ` +
    `Appuie-toi sur le Business Model Canvas et les données ci-dessus quand ils sont présents. ` +
    `Ancre tout dans la réalité suisse romande : AVS ~10 %, TVA 8.1 % (seuil d'assujettissement 100'000 CHF de chiffre d'affaires), prévoyance, dispositif LACI/ORP si pertinent. ` +
    `N'invente AUCUN chiffre absent du contexte : si une donnée manque, reste qualitatif ou signale-la comme « à compléter ». ` +
    `Pas de titre, pas de préambule — commence directement par le contenu.`;
}

export function BusinessPlan() {
  const profile = useUserStore((s) => s.profile);
  const { bmc, fetchBmc, upsertBmcBlock } = useAppStore();

  const [editing, setEditing]   = useState<SectionKey | null>(null);
  const [draft, setDraft]       = useState("");
  const [generating, setGenerating] = useState<SectionKey | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [budgetMsg, setBudgetMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) fetchBmc(profile.id);
  }, [profile?.id]);

  function getContent(key: SectionKey): string {
    return bmc.find((b) => b.block_key === key)?.content ?? "";
  }

  function sections(): Record<string, string> {
    return Object.fromEntries(SECTIONS.map((s) => [s.key, getContent(s.key)]));
  }

  // Résumé des 9 blocs BMC remplis — injecté dans le contexte IA.
  function bmcSummary(): string {
    return bmc
      .filter((b) => BMC_LABELS[b.block_key] && b.content)
      .map((b) => `- ${BMC_LABELS[b.block_key]} : ${b.content}`)
      .join("\n");
  }

  function startEdit(key: SectionKey) {
    setEditing(key);
    setDraft(getContent(key));
  }

  async function save(key: SectionKey) {
    if (!profile?.id) return;
    await upsertBmcBlock({ profile_id: profile.id, block_key: key, content: draft });
    setEditing(null);
  }

  async function generate(key: SectionKey) {
    if (!profile?.id) return;
    setGenerating(key);
    try {
      const text = await askAgent("strategist", buildAiPrompt(key, sections(), bmcSummary(), profile));
      await upsertBmcBlock({ profile_id: profile.id, block_key: key, content: text });
    } catch {
      // silently ignore — user can retry
    } finally {
      setGenerating(null);
    }
  }

  // Écart 3 — génère toutes les sections en parallèle (comme la v1).
  async function generateAll() {
    if (!profile?.id || generatingAll) return;
    setGeneratingAll(true);
    await Promise.allSettled(SECTIONS.map((s) => generate(s.key)));
    setGeneratingAll(false);
  }

  // Écart 1 — insère le budget RÉEL de la page Finances dans la section financière.
  async function insertBudget() {
    if (!profile?.id) return;
    setBudgetMsg(null);
    const f = loadFinanceModel();
    if (!f) {
      setBudgetMsg("Renseignez d'abord votre budget dans la page Finances.");
      return;
    }
    await upsertBmcBlock({ profile_id: profile.id, block_key: "bp_financials", content: buildBudgetMarkdown(f) });
    setBudgetMsg("Budget réel inséré depuis Finances — complétez le commentaire au besoin.");
  }

  const filledCount = SECTIONS.filter((s) => getContent(s.key)).length;

  // Construit le document complet via le template Claude Design.
  function buildDocHtml(): string {
    const today = new Date().toLocaleDateString("fr-CH", { day: "numeric", month: "long", year: "numeric" });
    const g = (key: SectionKey) => getContent(key);
    return fillTemplate(bpTemplateHtml, {
      LOGO_URL:            profile?.logo_url     ?? "",
      ACCENT_COLOR:        profile?.accent_color ?? "#8b6f47",
      BRAND_NAME:          profile?.brand_name   ?? profile?.name ?? "",
      NAME:                profile?.name         ?? "",
      DOMAINE:             profile?.domaine      ?? "",
      EMAIL:               profile?.contact_email ?? profile?.email ?? "",
      VILLE:               [profile?.ville, profile?.canton].filter(Boolean).join(" "),
      DATE:                today,
      SECTION_RESUME:      [g("bp_executive"), g("bp_founder") ? `\n\n**Porteur de projet**\n${g("bp_founder")}` : ""].join(""),
      SECTION_MARCHE:      g("bp_market"),
      SECTION_OFFRE:       g("bp_offer"),
      SECTION_CLIENTS:     g("bp_commercial"),
      SECTION_CANAUX:      g("bp_commercial"),
      SECTION_FINANCES:    g("bp_financials"),
      SECTION_CONCURRENCE: [g("bp_organisation"), g("bp_legal") ? `\n\n**Forme juridique**\n${g("bp_legal")}` : ""].join(""),
      SECTION_RISQUES:     g("bp_risks"),
      SECTION_PLAN_ACTION: g("bp_roadmap"),
    });
  }

  function exportPdf() { printHtml(buildDocHtml()); }

  function exportWord() {
    downloadWord(`business-plan-${profile?.brand_name || profile?.name || "nova"}`, buildDocHtml());
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: 820 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 400, color: "var(--color-text-primary)", margin: 0 }}>
            Business Plan
          </h2>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", marginTop: "var(--space-1)" }}>
            Cliquez une section pour l'éditer. Le Stratège peut rédiger chaque partie.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
            {filledCount}/{SECTIONS.length} sections
          </span>
          <div style={{
            width: 80,
            height: 4,
            background: "rgba(197,165,114,0.12)",
            borderRadius: 2,
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${(filledCount / SECTIONS.length) * 100}%`,
              background: "var(--color-gold)",
              borderRadius: 2,
              transition: "width 0.3s ease",
            }} />
          </div>
          <Button size="sm" variant="gold" loading={generatingAll} onClick={generateAll}>✦ Tout générer</Button>
          <ExportGate>
            <Button size="sm" variant="ghost" disabled={filledCount === 0} onClick={exportWord}>Word</Button>
            <Button size="sm" variant="ghost" disabled={filledCount === 0} onClick={exportPdf}>PDF</Button>
          </ExportGate>
        </div>
      </div>

      {/* Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {SECTIONS.map((section) => {
          const content   = getContent(section.key);
          const isEditing = editing === section.key;
          const isGen     = generating === section.key || generatingAll;
          const filled    = Boolean(content);
          const isFinancial = section.key === "bp_financials";

          return (
            <Card glass key={section.key}>
              {/* En-tête section */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", color: filled ? "rgba(197,165,114,0.3)" : "rgba(197,165,114,0.12)", lineHeight: 1 }}>
                    {section.num}
                  </span>
                  <div>
                    <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-base)", fontWeight: 400, color: "var(--color-text-primary)" }}>
                      {section.title}
                    </p>
                    {!isEditing && (
                      <p style={{ margin: "2px 0 0", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                        {section.hint}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>
                  {!isEditing && (
                    <>
                      {isFinancial && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={insertBudget}
                          style={{ fontSize: "var(--text-xs)", padding: "2px 8px" }}
                        >
                          📊 Insérer mon budget
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={isGen}
                        onClick={() => generate(section.key)}
                        style={{ fontSize: "var(--text-xs)", padding: "2px 8px" }}
                      >
                        {isGen ? "Rédaction…" : "IA Stratège"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(section.key)}
                        style={{ fontSize: "var(--text-xs)", padding: "2px 8px" }}
                      >
                        {filled ? "Éditer" : "Rédiger"}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Contenu */}
              {isEditing ? (
                <>
                  <textarea
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={section.placeholder}
                    style={{
                      width: "100%",
                      minHeight: 160,
                      background: "var(--color-bg-input)",
                      border: "var(--border-subtle)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--color-text-primary)",
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--text-sm)",
                      lineHeight: "var(--leading-normal)",
                      padding: "var(--space-3) var(--space-4)",
                      resize: "vertical",
                      outline: "none",
                      boxSizing: "border-box",
                      marginBottom: "var(--space-3)",
                    }}
                  />
                  <div style={{ display: "flex", gap: "var(--space-2)" }}>
                    <Button size="sm" variant="gold" onClick={() => save(section.key)}>Sauvegarder</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Annuler</Button>
                  </div>
                </>
              ) : (
                <div
                  onClick={() => startEdit(section.key)}
                  style={{
                    cursor: "pointer",
                    minHeight: 48,
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius-xs)",
                    background: filled ? "var(--color-bg-primary)" : "transparent",
                    border: filled ? "var(--border-subtle)" : "1px dashed rgba(255,255,255,0.06)",
                    transition: "background var(--transition-fast)",
                  }}
                >
                  {filled ? (
                    <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: "var(--leading-normal)", whiteSpace: "pre-wrap" }}>
                      {content}
                    </p>
                  ) : (
                    <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                      Cliquez pour rédiger, ou laissez le Stratège écrire ce paragraphe…
                    </p>
                  )}
                </div>
              )}

              {isFinancial && budgetMsg && (
                <p style={{ margin: "var(--space-3) 0 0", fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
                  {budgetMsg}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

