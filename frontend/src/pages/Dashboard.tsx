import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RoiSimulator } from "@/components/dashboard/RoiSimulator";
import { useUserStore } from "@/stores/useUserStore";
import { useAppStore } from "@/stores/useAppStore";
import { useChatStore } from "@/stores/useChatStore";
import { loadLocal, saveLocal } from "@/lib/local";
import { useIsMobile } from "@/lib/useIsMobile";
import { DashboardMobile } from "@/pages/DashboardMobile";

// Rituels génériques de momentum — mêmes pour tous, état coché remis à zéro chaque jour.
const RITUELS = [
  "Contacter 1 personne de mon réseau",
  "10 min de visibilité (LinkedIn, post, commentaire)",
  "Avancer un livrable clé (BMC, business plan, offre)",
  "Relancer 1 prospect en attente",
];

// Étapes génériques du soutien à l'indépendance (art. 71a–71d LACI).
// Informationnel — chaque assuré coche son avancement réel (per-tenant, démarre vide).
const LACI_71A_STEPS = [
  "S'annoncer à l'ORP et déclarer son projet d'activité indépendante",
  "Obtenir l'accord du conseiller ORP pour la phase de planification",
  "Élaborer le business plan (jusqu'à 90 indemnités journalières spécifiques)",
  "Faire expertiser le projet par un organisme reconnu",
  "Déposer la demande de soutien (art. 71a–71d LACI)",
  "Lancer l'activité avant la fin du délai-cadre d'indemnisation",
];

// Bien-être & Résilience — le risque n°1 du solo n'est pas financier, c'est
// l'isolement. Signaux génériques cochés par l'abonné (per-tenant, démarrent vides).
const BIENETRE_SIGNALS = [
  "Je travaille plus de 50h/semaine depuis 2 semaines",
  "Je n'ai pas parlé à un pair professionnel cette semaine",
  "J'ai du mal à me déconnecter le soir / week-end",
  "Je reporte mes propres soins (sport, repas, sommeil)",
];

// Ressources publiques de Suisse romande — génériques, non personnelles.
const BIENETRE_RESSOURCES: { nom: string; desc: string }[] = [
  { nom: "Masterminds & pairs", desc: "Un groupe de 4–6 indépendants pour se challenger (1h/sem)." },
  { nom: "Genilem", desc: "Accompagnement d'entrepreneurs (Genève / Vaud)." },
  { nom: "CCSO", desc: "Chambre de commerce Valais / Suisse occidentale." },
  { nom: "Innosuisse", desc: "Coaching d'innovation (activités à fort potentiel)." },
  { nom: "Coworking", desc: "Un bureau partagé pour briser l'isolement." },
];

// Aiguillage responsive : sous 768px on rend la version mobile dédiée, sinon le
// tableau de bord desktop historique (inchangé). Un seul hook ici → pas de
// violation des règles des hooks lors du basculement de breakpoint.
export function Dashboard() {
  const isMobile = useIsMobile();
  return isMobile ? <DashboardMobile /> : <DashboardDesktop />;
}

function DashboardDesktop() {
  const navigate = useNavigate();
  const profile = useUserStore((s) => s.profile);
  const { compta, fetchCompta, events, fetchEvents } = useAppStore();
  const setOpen = useChatStore((s) => s.setOpen);
  const setAgent = useChatStore((s) => s.setAgent);

  const isLaci = profile?.is_laci || profile?.statut === "laci";
  const [laciDone, setLaciDone] = useState<boolean[]>(() =>
    loadLocal("ns_laci_71a", LACI_71A_STEPS.map(() => false)),
  );
  function toggleLaci(i: number) {
    const next = laciDone.map((v, j) => (j === i ? !v : v));
    setLaciDone(next);
    saveLocal("ns_laci_71a", next);
  }
  const laciCount = laciDone.filter(Boolean).length;
  function askJuristeLaci() {
    setAgent("juriste");
    setOpen(true);
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const [rituels, setRituels] = useState<{ day: string; done: boolean[] }>(() =>
    loadLocal("ns_rituels", { day: todayKey, done: RITUELS.map(() => false) }),
  );
  // Reset quotidien
  const ritDone = rituels.day === todayKey ? rituels.done : RITUELS.map(() => false);
  function toggleRituel(i: number) {
    const done = ritDone.map((v, j) => (j === i ? !v : v));
    const next = { day: todayKey, done };
    setRituels(next);
    saveLocal("ns_rituels", next);
  }
  const ritCount = ritDone.filter(Boolean).length;

  const [bienetre, setBienetre] = useState<boolean[]>(() =>
    loadLocal("ns_bienetre", BIENETRE_SIGNALS.map(() => false)),
  );
  function toggleBienetre(i: number) {
    const next = bienetre.map((v, j) => (j === i ? !v : v));
    setBienetre(next);
    saveLocal("ns_bienetre", next);
  }
  const bienetreCount = bienetre.filter(Boolean).length;
  const bienetreRisk =
    bienetreCount >= 3
      ? { label: "À surveiller", color: "var(--color-danger)" }
      : bienetreCount >= 1
        ? { label: "Vigilance", color: "var(--color-warning)" }
        : { label: "Au vert", color: "var(--color-success)" };

  useEffect(() => {
    if (profile?.id) {
      fetchCompta(profile.id);
      fetchEvents(profile.id);
    }
  }, [profile?.id]);

  // KPIs comptabilité
  const revenus = compta
    .filter((e) => e.type === "revenu")
    .reduce((sum, e) => sum + e.amount, 0);
  const depenses = compta
    .filter((e) => e.type === "depense")
    .reduce((sum, e) => sum + e.amount, 0);
  const treso = revenus - depenses;

  // Prochains événements
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events
    .filter((e) => e.date >= today)
    .slice(0, 3);

  const runwayMonths = profile?.runway_months ?? null;

  function fmt(n: number) {
    return n.toLocaleString("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      {/* Bienvenue */}
      <div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-2xl)",
            fontWeight: 400,
            color: "var(--color-text-primary)",
            margin: "0 0 var(--space-2)",
          }}
        >
          Bonjour{profile?.name ? `, ${profile.name.split(" ")[0]}` : ""}
        </h2>
        {profile?.situation && (
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", margin: 0 }}>
            {profile.situation}
          </p>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "var(--space-4)" }}>
        <KpiCard label="Revenus" value={fmt(revenus)} color="success" />
        <KpiCard label="Dépenses" value={fmt(depenses)} color="warning" />
        <KpiCard
          label="Trésorerie"
          value={fmt(treso)}
          color={treso >= 0 ? "success" : "danger"}
        />
        {runwayMonths !== null && (
          <KpiCard
            label="Runway"
            value={runwayMonths}
            unit="mois"
            color={runwayMonths >= 3 ? "gold" : "danger"}
          />
        )}
      </div>

      {/* Plan de route & LACI (art. 71a) — uniquement si demandeur d'emploi */}
      {isLaci && (
        <Card title={`Plan de route & LACI · ${laciCount}/${LACI_71A_STEPS.length}`} glass style={{ borderColor: "rgba(197,165,114,0.25)" }}>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)", margin: "0 0 var(--space-3)", lineHeight: "var(--leading-normal)" }}>
            Soutien à l'activité indépendante (art. 71a–71d LACI). Repères généraux —
            confirmez chaque modalité auprès de votre ORP et de votre caisse de chômage.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {LACI_71A_STEPS.map((step, i) => (
              <label
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "var(--space-2)",
                  fontSize: "var(--text-sm)",
                  color: laciDone[i] ? "var(--color-text-muted)" : "var(--color-text-secondary)",
                  cursor: "pointer",
                  textDecoration: laciDone[i] ? "line-through" : "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={laciDone[i] ?? false}
                  onChange={() => toggleLaci(i)}
                  style={{ marginTop: 3, accentColor: "var(--color-gold)" }}
                />
                <span>
                  <span style={{ color: "var(--color-gold)", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", marginRight: 6 }}>
                    {i + 1}.
                  </span>
                  {step}
                </span>
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
            <Button size="sm" variant="ghost" onClick={() => navigate("/business-plan")}>
              Ouvrir le business plan
            </Button>
            <Button size="sm" variant="ghost" onClick={askJuristeLaci}>
              Questions ? Demander au Juriste
            </Button>
          </div>
        </Card>
      )}

      {/* Agenda + actions rapides */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "var(--space-6)" }}>
        <Card title="Prochains rendez-vous">
          {upcoming.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", margin: 0 }}>
              Aucun événement à venir.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {upcoming.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "var(--space-3) 0",
                    borderBottom: "var(--border-subtle)",
                  }}
                >
                  <div>
                    <div style={{ color: "var(--color-text-primary)", fontSize: "var(--text-sm)" }}>
                      {ev.title}
                    </div>
                    {ev.location && (
                      <div style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)" }}>
                        {ev.location}
                      </div>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-gold)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {new Date(ev.date).toLocaleDateString("fr-CH", { day: "numeric", month: "short" })}
                    {ev.time_start ? ` ${ev.time_start}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Colonne droite : rituels + actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <Card title={`Rituels du jour · ${ritCount}/${RITUELS.length}`} glass>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {RITUELS.map((r, i) => (
                <label key={i} style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: ritDone[i] ? "var(--color-text-muted)" : "var(--color-text-secondary)", cursor: "pointer", textDecoration: ritDone[i] ? "line-through" : "none" }}>
                  <input type="checkbox" checked={ritDone[i]} onChange={() => toggleRituel(i)} style={{ marginTop: 3, accentColor: "var(--color-gold)" }} />
                  <span>{r}</span>
                </label>
              ))}
            </div>
          </Card>

          <Card title="Actions rapides" glass>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <Button size="sm" variant="gold" onClick={() => setOpen(true)} style={{ width: "100%", justifyContent: "center" }}>
                Parler à Nova
              </Button>
              <Button size="sm" variant="ghost" onClick={() => navigate("/facture")} style={{ width: "100%", justifyContent: "center" }}>
                Nouvelle facture
              </Button>
              <Button size="sm" variant="ghost" onClick={() => navigate("/pipeline")} style={{ width: "100%", justifyContent: "center" }}>
                Ajouter prospect
              </Button>
              <Button size="sm" variant="ghost" onClick={() => navigate("/compta")} style={{ width: "100%", justifyContent: "center" }}>
                Saisir dépense
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Simulateur ROI — valeur tangible des modules utilisés */}
      <RoiSimulator />

      {/* Bien-être & Résilience — le risque n°1 du solo, c'est l'isolement */}
      <Card title="Bien-être & Résilience" glass>
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)", margin: "0 0 var(--space-4)", lineHeight: "var(--leading-normal)" }}>
          Le plus grand risque de l'indépendant solo n'est pas financier — c'est
          l'isolement. Faites le point sans jugement, et brisez la solitude avant qu'elle ne pèse.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "var(--space-6)" }}>
          {/* Signaux d'alerte */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text-primary)" }}>Signaux d'alerte</span>
              <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: bienetreRisk.color, border: `1px solid ${bienetreRisk.color}`, borderRadius: "var(--radius-xs)", padding: "1px 8px", letterSpacing: "var(--tracking-wide)" }}>
                {bienetreRisk.label}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {BIENETRE_SIGNALS.map((s, i) => (
                <label key={i} style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: bienetre[i] ? "var(--color-text-primary)" : "var(--color-text-secondary)", cursor: "pointer" }}>
                  <input type="checkbox" checked={bienetre[i] ?? false} onChange={() => toggleBienetre(i)} style={{ marginTop: 3, accentColor: "var(--color-gold)" }} />
                  <span>{s}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Ressources Suisse romande */}
          <div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "var(--space-3)" }}>
              Ressources — Suisse romande
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {BIENETRE_RESSOURCES.map((r) => (
                <div key={r.nom} style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", lineHeight: "var(--leading-normal)" }}>
                  <span style={{ color: "var(--color-gold)", fontWeight: 600 }}>{r.nom}</span> — {r.desc}
                </div>
              ))}
            </div>
          </div>
        </div>

        {bienetreCount >= 2 && (
          <div style={{ marginTop: "var(--space-4)", padding: "var(--space-3) var(--space-4)", background: "rgba(197,165,114,0.06)", borderRadius: "var(--radius-sm)", border: "var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
              Plusieurs signaux sont au rouge. Prendre 20 minutes pour en parler n'est pas du temps perdu.
            </span>
            <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>En parler à Nova</Button>
          </div>
        )}
      </Card>

      {/* Statut profil */}
      {profile && !profile.domaine && (
        <Card glass style={{ borderColor: "rgba(197,165,114,0.3)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ color: "var(--color-gold)", fontWeight: 500, marginBottom: "var(--space-1)" }}>
                Complétez votre profil
              </div>
              <div style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
                Le diagnostic Nova adapte tous les conseils à votre activité.
              </div>
            </div>
            <Button size="sm" variant="gold" onClick={() => setOpen(true)}>
              Démarrer
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
