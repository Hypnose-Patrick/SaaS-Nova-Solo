import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useUserStore } from "@/stores/useUserStore";
import { useAppStore } from "@/stores/useAppStore";
import { askAgent } from "@/lib/ai";
import { printHtml, downloadWord } from "@/lib/exportDoc";

const SECTIONS = [
  {
    key:         "bp_executive",
    num:         "01",
    title:       "Résumé exécutif",
    hint:        "Qui vous êtes, votre offre, pour qui, pourquoi maintenant.",
    placeholder: "Coach certifié spécialisé dans la reconversion des cadres suisses romands. Offre de 3 séances diagnostics + suivi mensuel à CHF 450/mois. Différenciation : approche intégrant hypnose et stratégie concrète…",
  },
  {
    key:         "bp_offer",
    num:         "02",
    title:       "Offre & Positionnement",
    hint:        "Services, tarifs, packages, argument de différenciation clé.",
    placeholder: "Séances individuelles à CHF 150 (1h). Package Lancement 3 mois : CHF 1 200. Formation en ligne : CHF 297. Positionnement premium local-first…",
  },
  {
    key:         "bp_market",
    num:         "03",
    title:       "Marché cible",
    hint:        "Profil client idéal (ICP), besoins, taille du marché, concurrence.",
    placeholder: "ICP : 35–55 ans, cadre ou indépendant romand, en transition ou stagnation professionnelle. Budget disponible CHF 200–500/mois. Concurrents directs : coaches généralistes, plateformes en ligne (Malt, CoachHub)…",
  },
  {
    key:         "bp_commercial",
    num:         "04",
    title:       "Stratégie commerciale",
    hint:        "Canaux d'acquisition, script de vente, fidélisation, objectifs trimestriels.",
    placeholder: "Canaux : réseau LinkedIn, bouche-à-oreille, partenariats RH, contenu organique. Objectif T1 : 5 clients. Conversion : 1 RDV offert → proposition → suivi. Fidélisation : check-in mensuel gratuit…",
  },
  {
    key:         "bp_financials",
    num:         "05",
    title:       "Plan financier",
    hint:        "CA mensuel cible, charges, point mort, projection 12 mois.",
    placeholder: "CA cible M6 : CHF 5 000/mois. Charges fixes : CHF 2 200 (loyer bureau partagé, assurances, outils). Point mort : 5 clients/mois. Projection M12 : CHF 8 000 (10 clients + produit en ligne)…",
  },
  {
    key:         "bp_roadmap",
    num:         "06",
    title:       "Roadmap 12 mois",
    hint:        "Jalons clés, milestones, ressources nécessaires.",
    placeholder: "M1–2 : Positionnement + 3 premiers clients. M3–4 : Stabiliser 6 clients récurrents. M5–6 : Lancer produit digital. M7–9 : Atteindre point mort. M10–12 : Recruter 1 partenaire ou déléguer admin…",
  },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildAiPrompt(key: SectionKey, sections: Record<string, string>, profile: ReturnType<typeof useUserStore.getState>["profile"]): string {
  const ctx = [
    profile?.name     ? `Prénom : ${profile.name}` : null,
    profile?.domaine  ? `Domaine : ${profile.domaine}` : null,
    profile?.situation ? `Situation : ${profile.situation}` : null,
    sections.bp_executive  ? `Résumé exécutif : ${sections.bp_executive}` : null,
    sections.bp_offer      ? `Offre : ${sections.bp_offer}` : null,
    sections.bp_market     ? `Marché : ${sections.bp_market}` : null,
    sections.bp_commercial ? `Commercial : ${sections.bp_commercial}` : null,
    sections.bp_financials ? `Finances : ${sections.bp_financials}` : null,
    sections.bp_roadmap    ? `Roadmap : ${sections.bp_roadmap}` : null,
  ].filter(Boolean).join("\n");

  const sec = SECTIONS.find((s) => s.key === key)!;
  return `Tu es Hermès-Stratège, expert en plans d'affaires pour indépendants suisse-romands.\n\nContexte disponible :\n${ctx || "(aucun)"}\n\nRédige la section "${sec.title}" (${sec.hint}) en 150–250 mots, ton professionnel mais humain, orienté action et chiffres concrets. Adapte au contexte si disponible, sinon propose un modèle pertinent. Pas de titre, pas de preamble — commence directement par le contenu.`;
}

export function BusinessPlan() {
  const profile = useUserStore((s) => s.profile);
  const { bmc, fetchBmc, upsertBmcBlock } = useAppStore();

  const [editing, setEditing]   = useState<SectionKey | null>(null);
  const [draft, setDraft]       = useState("");
  const [generating, setGenerating] = useState<SectionKey | null>(null);

  useEffect(() => {
    if (profile?.id) fetchBmc(profile.id);
  }, [profile?.id]);

  function getContent(key: SectionKey): string {
    return bmc.find((b) => b.block_key === key)?.content ?? "";
  }

  function sections(): Record<string, string> {
    return Object.fromEntries(SECTIONS.map((s) => [s.key, getContent(s.key)]));
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
      const text = await askAgent("strategist", buildAiPrompt(key, sections(), profile));
      await upsertBmcBlock({ profile_id: profile.id, block_key: key, content: text });
    } catch {
      // silently ignore — user can retry
    } finally {
      setGenerating(null);
    }
  }

  const filledCount = SECTIONS.filter((s) => getContent(s.key)).length;

  // Construit le document complet (page de garde + sections remplies) en HTML.
  function buildDocHtml(): string {
    const title = profile?.brand_name || profile?.name || "Business Plan";
    const subtitle = [profile?.domaine, [profile?.ville, profile?.canton].filter(Boolean).join(" ")]
      .filter(Boolean).join(" · ");
    const today = new Date().toLocaleDateString("fr-CH", { day: "numeric", month: "long", year: "numeric" });
    const logo = profile?.logo_url
      ? `<img src="${profile.logo_url}" alt="" style="max-height:90px;max-width:260px;object-fit:contain;margin-bottom:24px" />`
      : "";
    const cover =
      `<div class="cover">${logo}<div class="ctitle">${escapeHtml(title)}</div>` +
      (subtitle ? `<div class="csub">${escapeHtml(subtitle)}</div>` : "") +
      `<div class="cdoc">Business Plan</div><div class="cdate">${escapeHtml(today)}</div></div>`;
    const body = SECTIONS.map((s) => {
      const content = getContent(s.key);
      if (!content) return "";
      return `<section><h2><span class="num">${s.num}</span> ${escapeHtml(s.title)}</h2>` +
        `<div class="content">${escapeHtml(content)}</div></section>`;
    }).join("");
    return (
      `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(title)} — Business Plan</title>` +
      `<style>` +
      `body{font-family:Calibri,Arial,sans-serif;color:#1a1a1a;line-height:1.6;font-size:13px;max-width:780px;margin:0 auto;padding:0 32px}` +
      `.cover{text-align:center;padding:120px 0 80px;page-break-after:always}` +
      `.ctitle{font-size:30px;font-weight:800;letter-spacing:.5px}` +
      `.csub{font-size:15px;color:#555;margin-top:8px}` +
      `.cdoc{margin-top:48px;font-size:20px;color:#a8842c;font-weight:700;text-transform:uppercase;letter-spacing:3px}` +
      `.cdate{margin-top:8px;color:#888;font-size:13px}` +
      `section{margin-bottom:28px}` +
      `h2{font-size:16px;border-bottom:2px solid #a8842c;padding-bottom:6px;margin:0 0 10px;color:#1a1a1a}` +
      `h2 .num{color:#a8842c;font-weight:800;margin-right:8px}` +
      `.content{white-space:pre-wrap}` +
      `</style></head><body>${cover}${body}</body></html>`
    );
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
          <Button size="sm" variant="ghost" disabled={filledCount === 0} onClick={exportWord}>Word</Button>
          <Button size="sm" variant="gold" disabled={filledCount === 0} onClick={exportPdf}>Exporter PDF</Button>
        </div>
      </div>

      {/* Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {SECTIONS.map((section) => {
          const content   = getContent(section.key);
          const isEditing = editing === section.key;
          const isGen     = generating === section.key;
          const filled    = Boolean(content);

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
            </Card>
          );
        })}
      </div>
    </div>
  );
}
