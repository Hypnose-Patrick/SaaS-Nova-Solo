import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { loadLocal, saveLocal } from "@/lib/local";

// Économies de temps par module (en heures/mois).
// Les modules "lancement" sont des gains one-time étalés sur 3 mois.
// Les modules "quotidiens" sont des gains récurrents chaque mois.
const MODULES_LANCEMENT: { id: string; label: string; heures: number; detail: string }[] = [
  { id: "diagnostic",  label: "Diagnostic",          heures: 1,   detail: "Bilan structuré en 20 min vs 3h de tâtonnement" },
  { id: "bmc",         label: "Business Model Canvas", heures: 2, detail: "Canvas guidé par IA vs atelier de 6h solo" },
  { id: "bp",          label: "Business Plan",         heures: 4, detail: "Rédaction assistée vs semaines de recherche" },
  { id: "pricing",     label: "Offre & Pricing",       heures: 1.5, detail: "Calculateur AVS/TVA vs tableur manuel" },
  { id: "cv",          label: "CV & Dossier",           heures: 2, detail: "Génération auto depuis votre profil" },
  { id: "symbolique",  label: "Vision symbolique",      heures: 1, detail: "Séance de coaching structurée en autonomie" },
];

const MODULES_QUOTIDIENS: { id: string; label: string; heures: number; detail: string }[] = [
  { id: "pipeline",    label: "Pipeline prospects",   heures: 3,   detail: "Suivi commercial vs post-its + mails épars" },
  { id: "finances",    label: "Finances & trésorerie", heures: 2,  detail: "Tableau de bord vs Excel manuel" },
  { id: "compta",      label: "Comptabilité",          heures: 2,  detail: "Saisie guidée vs recherche de catégories" },
  { id: "factures",    label: "Factures",              heures: 1.5, detail: "Génération + envoi en 2 clics" },
  { id: "hermes",      label: "Cabinet Hermès",        heures: 2,  detail: "6 experts IA vs recherche dispersée" },
  { id: "marketing",   label: "Marketing",             heures: 1.5, detail: "Contenus assistés vs rédaction from scratch" },
];

const TAUX_DEFAULT = 120; // CHF/h — taux typique d'un coach indépendant romand

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-2)",
        padding: "var(--space-2) var(--space-3)",
        borderRadius: "var(--radius-sm)",
        border: active ? "1px solid var(--color-gold)" : "var(--border-subtle)",
        background: active ? "rgba(197,165,114,0.10)" : "var(--color-bg-surface)",
        cursor: "pointer",
        textAlign: "left",
        transition: "all var(--transition-base)",
        width: "100%",
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: active ? "none" : "1px solid var(--color-text-muted)",
          background: active ? "var(--color-gold)" : "transparent",
          flexShrink: 0,
          marginTop: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {active && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span style={{ flex: 1 }}>
        <span style={{ fontSize: "var(--text-sm)", color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)", fontWeight: active ? 500 : 400, display: "block" }}>
          {children}
        </span>
      </span>
    </button>
  );
}

export function RoiSimulator() {
  const [taux, setTaux] = useState<number>(() => loadLocal("ns_roi_taux", TAUX_DEFAULT));
  const [activeLancement, setActiveLancement] = useState<Record<string, boolean>>(() =>
    loadLocal("ns_roi_lancement", {}),
  );
  const [activeQuotidien, setActiveQuotidien] = useState<Record<string, boolean>>(() =>
    loadLocal("ns_roi_quotidien", {}),
  );

  function toggleLancement(id: string) {
    const next = { ...activeLancement, [id]: !activeLancement[id] };
    setActiveLancement(next);
    saveLocal("ns_roi_lancement", next);
  }
  function toggleQuotidien(id: string) {
    const next = { ...activeQuotidien, [id]: !activeQuotidien[id] };
    setActiveQuotidien(next);
    saveLocal("ns_roi_quotidien", next);
  }
  function handleTaux(v: number) {
    setTaux(v);
    saveLocal("ns_roi_taux", v);
  }

  // Calcul : gains lancement étalés sur 3 mois → ÷ 3
  const heuresLancement = MODULES_LANCEMENT
    .filter((m) => activeLancement[m.id])
    .reduce((s, m) => s + m.heures, 0);
  const heuresQuotidien = MODULES_QUOTIDIENS
    .filter((m) => activeQuotidien[m.id])
    .reduce((s, m) => s + m.heures, 0);

  const heuresMois = Math.round((heuresLancement / 3 + heuresQuotidien) * 10) / 10;
  const valeurCHF = Math.round(heuresMois * taux);
  const nbActifs = Object.values(activeLancement).filter(Boolean).length + Object.values(activeQuotidien).filter(Boolean).length;

  return (
    <Card
      title="Valeur Nova Solo — Simulateur ROI"
      glass
      style={{ borderColor: "rgba(197,165,114,0.2)" }}
    >
      {/* Explication utilisateur */}
      <div style={{
        background: "rgba(197,165,114,0.06)",
        border: "1px solid rgba(197,165,114,0.18)",
        borderRadius: "var(--radius-sm)",
        padding: "var(--space-4) var(--space-5)",
        marginBottom: "var(--space-5)",
      }}>
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-text-primary)", marginBottom: "var(--space-2)" }}>
          Comment ça fonctionne ?
        </div>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", margin: "0 0 var(--space-3)", lineHeight: 1.7 }}>
          Chaque module Nova remplace une tâche que vous feriez à la main. Ce simulateur estime combien d'heures vous récupérez chaque mois — et ce que ces heures valent en CHF selon votre taux horaire.
        </p>
        <div style={{
          background: "var(--color-bg-surface)",
          borderRadius: "var(--radius-xs)",
          padding: "var(--space-3) var(--space-4)",
          fontSize: "var(--text-xs)",
          color: "var(--color-text-muted)",
          lineHeight: 1.7,
          borderLeft: "2px solid var(--color-gold)",
        }}>
          <span style={{ color: "var(--color-gold)", fontWeight: 500 }}>Exemple concret :</span>
          {" "}Laure est coach indépendante à 120 CHF/h. Elle active <em>Factures</em> (1,5h/mois), <em>Pipeline prospects</em> (3h/mois) et <em>Business Plan</em> (4h réparties sur 3 mois). Nova lui économise <strong style={{ color: "var(--color-text-primary)" }}>5,8h/mois</strong>, soit{" "}
          <strong style={{ color: "var(--color-gold)" }}>696 CHF/mois</strong> de temps valorisé — l'abonnement est rentabilisé en quelques heures.
        </div>
      </div>

      {/* Taux horaire */}
      <div style={{ marginBottom: "var(--space-6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-2)" }}>
          <span style={{ fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
            Votre taux horaire
          </span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", color: "var(--color-gold)" }}>
            {taux} CHF/h
          </span>
        </div>
        <input
          type="range"
          min={60}
          max={350}
          step={10}
          value={taux}
          onChange={(e) => handleTaux(Number(e.target.value))}
          style={{ width: "100%", accentColor: "var(--color-gold)", cursor: "pointer" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>
          <span>60 CHF — assistant</span>
          <span>200 CHF — coach</span>
          <span>350 CHF — expert</span>
        </div>
      </div>

      {/* Modules */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--space-6)", marginBottom: "var(--space-6)" }}>
        {/* Lancement */}
        <div>
          <div style={{ fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "var(--space-3)" }}>
            Modules de lancement
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {MODULES_LANCEMENT.map((m) => (
              <Chip key={m.id} active={!!activeLancement[m.id]} onClick={() => toggleLancement(m.id)}>
                <span style={{ display: "block" }}>{m.label}</span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", fontWeight: 400 }}>{m.detail}</span>
              </Chip>
            ))}
          </div>
        </div>

        {/* Quotidiens */}
        <div>
          <div style={{ fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "var(--space-3)" }}>
            Modules quotidiens
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {MODULES_QUOTIDIENS.map((m) => (
              <Chip key={m.id} active={!!activeQuotidien[m.id]} onClick={() => toggleQuotidien(m.id)}>
                <span style={{ display: "block" }}>{m.label}</span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", fontWeight: 400 }}>{m.detail}</span>
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {/* Résultats */}
      <div
        style={{
          padding: "var(--space-5) var(--space-6)",
          background: "rgba(197,165,114,0.07)",
          borderRadius: "var(--radius-sm)",
          border: "1px solid rgba(197,165,114,0.2)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        <div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "var(--tracking-wider)", marginBottom: "var(--space-1)" }}>
            Modules actifs
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", color: "var(--color-gold)" }}>
            {nbActifs}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "var(--tracking-wider)", marginBottom: "var(--space-1)" }}>
            Heures récupérées / mois
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", color: heuresMois > 0 ? "var(--color-success)" : "var(--color-text-muted)" }}>
            {heuresMois > 0 ? `+${heuresMois}h` : "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "var(--tracking-wider)", marginBottom: "var(--space-1)" }}>
            Valeur générée / mois
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", color: valeurCHF > 0 ? "var(--color-gold)" : "var(--color-text-muted)" }}>
            {valeurCHF > 0 ? `${valeurCHF.toLocaleString("fr-CH")} CHF` : "—"}
          </div>
        </div>
        {valeurCHF > 0 && (
          <div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "var(--tracking-wider)", marginBottom: "var(--space-1)" }}>
              ROI annuel estimé
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", color: "var(--color-success)" }}>
              {(valeurCHF * 12).toLocaleString("fr-CH")} CHF
            </div>
          </div>
        )}
      </div>

      {nbActifs === 0 && (
        <p style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: "var(--text-xs)", marginTop: "var(--space-3)" }}>
          Sélectionnez les modules utilisés pour voir votre ROI.
        </p>
      )}
    </Card>
  );
}
