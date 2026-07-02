import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/stores/useUserStore";
import { useAppStore } from "@/stores/useAppStore";
import { useChatStore } from "@/stores/useChatStore";
import { loadLocal, saveLocal } from "@/lib/local";
import { DevisExpress } from "@/components/dashboard/DevisExpress";
import { OracleCard } from "@/components/dashboard/OracleCard";

/**
 * DashboardMobile — version mobile du tableau de bord (design Claude Design,
 * re-skinné sur les tokens réels Nova Solo). Rendu par <Dashboard> sous 768px.
 * Réutilise les MÊMES clés localStorage que le dashboard desktop : les cases
 * cochées (rituels, LACI, bien-être) restent synchronisées entre les deux vues.
 */

// — Constantes partagées avec le dashboard desktop (mêmes libellés / mêmes clés) —
const RITUELS = [
  "Contacter 1 personne de mon réseau",
  "10 min de visibilité (LinkedIn, post, commentaire)",
  "Avancer un livrable clé (BMC, business plan, offre)",
  "Relancer 1 prospect en attente",
];
const LACI_71A_STEPS = [
  "S'annoncer à l'ORP et déclarer son projet d'activité indépendante",
  "Obtenir l'accord du conseiller ORP pour la phase de planification",
  "Élaborer le business plan (jusqu'à 90 indemnités journalières spécifiques)",
  "Faire expertiser le projet par un organisme reconnu",
  "Déposer la demande de soutien (art. 71a–71d LACI)",
  "Lancer l'activité avant la fin du délai-cadre d'indemnisation",
];
// Numéros d'urgence suisses — tapables (tel:) pour un accès immédiat.
const URGENCES: { nom: string; tel: string; note: string }[] = [
  { nom: "Police secours", tel: "117", note: "Danger, agression, vol" },
  { nom: "Pompiers", tel: "118", note: "Incendie, fuite, sauvetage" },
  { nom: "Urgences sanitaires", tel: "144", note: "Ambulance · urgence vitale" },
];

const DAYS = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

const card: React.CSSProperties = {
  background: "var(--color-bg-surface)",
  border: "var(--border-subtle)",
  borderRadius: "var(--radius-lg)",
  padding: "var(--space-4)",
};
const sectionLabel: React.CSSProperties = {
  margin: "0 0 var(--space-2)",
  fontFamily: "var(--font-mono)",
  fontSize: "10px",
  letterSpacing: "var(--tracking-wider)",
  textTransform: "uppercase",
  color: "var(--color-text-muted)",
};
const cardTitle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-display)",
  fontSize: "var(--text-md)",
  fontWeight: 400,
  color: "var(--color-text-primary)",
};

function CheckRow({ active, label, onToggle, variant = "done" }: { active: boolean; label: string; onToggle: () => void; variant?: "done" | "flag" }) {
  const isFlag = variant === "flag";
  const accent = isFlag ? "var(--color-warning)" : "var(--color-gold)";
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%",
        padding: "9px 6px", minHeight: 44, background: active && !isFlag ? "var(--color-gold-glow)" : "transparent",
        border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", textAlign: "left",
      }}
    >
      <span
        style={{
          width: 20, height: 20, borderRadius: "var(--radius-sm)", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, lineHeight: 1,
          background: active ? (isFlag ? "rgba(184,146,58,0.12)" : accent) : "transparent",
          border: `1.5px solid ${active ? accent : "var(--color-gold-border)"}`,
          color: active ? (isFlag ? accent : "var(--color-text-inverse)") : "transparent",
        }}
      >
        {isFlag ? "!" : "✓"}
      </span>
      <span
        style={{
          flex: 1, fontSize: "var(--text-sm)", lineHeight: 1.4,
          color: active && !isFlag ? "var(--color-text-muted)" : "var(--color-text-secondary)",
          textDecoration: active && !isFlag ? "line-through" : "none",
        }}
      >
        {label}
      </span>
    </button>
  );
}

function Kpi({ label, value, unit, tone }: { label: string; value: string; unit: string; tone?: string }) {
  return (
    <div style={{ ...card, padding: "var(--space-3) var(--space-4)" }}>
      <p style={{ margin: "0 0 6px", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>{label}</p>
      <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 600, color: tone ?? "var(--color-text-primary)", letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</p>
      <p style={{ margin: "6px 0 0", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-muted)" }}>{unit}</p>
    </div>
  );
}

export function DashboardMobile() {
  const navigate = useNavigate();
  const profile = useUserStore((s) => s.profile);
  const { compta, fetchCompta, events, fetchEvents } = useAppStore();
  const setOpen = useChatStore((s) => s.setOpen);
  const setAgent = useChatStore((s) => s.setAgent);

  useEffect(() => {
    if (profile?.id) { fetchCompta(profile.id); fetchEvents(profile.id); }
  }, [profile?.id]);

  // — LACI (art. 71a) —
  const isLaci = profile?.is_laci || profile?.statut === "laci";
  const [laciOpen, setLaciOpen] = useState(true);
  const [laciDone, setLaciDone] = useState<boolean[]>(() => loadLocal("ns_laci_71a", LACI_71A_STEPS.map(() => false)));
  function toggleLaci(i: number) {
    const next = laciDone.map((v, j) => (j === i ? !v : v));
    setLaciDone(next); saveLocal("ns_laci_71a", next);
  }
  const laciCount = laciDone.filter(Boolean).length;

  // — Rituels du jour (reset quotidien) —
  const todayKey = new Date().toISOString().slice(0, 10);
  const [rituels, setRituels] = useState<{ day: string; done: boolean[] }>(() => loadLocal("ns_rituels", { day: todayKey, done: RITUELS.map(() => false) }));
  const ritDone = rituels.day === todayKey ? rituels.done : RITUELS.map(() => false);
  function toggleRituel(i: number) {
    const done = ritDone.map((v, j) => (j === i ? !v : v));
    const next = { day: todayKey, done };
    setRituels(next); saveLocal("ns_rituels", next);
  }
  const ritCount = ritDone.filter(Boolean).length;
  const ritLeft = RITUELS.length - ritCount;

  // — KPIs compta —
  const revenus = compta.filter((e) => e.type === "revenu").reduce((s, e) => s + e.amount, 0);
  const depenses = compta.filter((e) => e.type === "depense").reduce((s, e) => s + e.amount, 0);
  const treso = revenus - depenses;
  const runwayMonths = profile?.runway_months ?? null;
  const fmt = (n: number) => n.toLocaleString("fr-CH", { maximumFractionDigits: 0 }).replace(/ /g, "’");

  // — Prochains rendez-vous —
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => e.date >= today).slice(0, 3);

  const now = new Date();
  const todayLabel = `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`.toUpperCase();
  const [profileVisible, setProfileVisible] = useState(true);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", paddingBottom: "var(--space-6)" }}>

      {/* 1. Greeting */}
      <div>
        <p style={{ margin: "0 0 2px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>{todayLabel}</p>
        <h1 style={{ margin: "0 0 4px", fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 400, letterSpacing: "var(--tracking-tight)", color: "var(--color-text-primary)", lineHeight: 1.15 }}>
          Bonjour{profile?.name ? `, ${profile.name.split(" ")[0]}` : ""} 👋
        </h1>
        {profile?.situation && (
          <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>{profile.situation}</p>
        )}
        {ritLeft > 0 && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, padding: "5px 11px", background: "var(--color-gold-glow)", border: "var(--border-gold)", borderRadius: "var(--radius-sm)" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--color-gold)" }} />
            <span style={{ fontSize: 11, color: "var(--color-gold)", fontFamily: "var(--font-mono)" }}>{ritLeft} rituel{ritLeft > 1 ? "s" : ""} à faire</span>
          </div>
        )}
      </div>

      {/* 2. KPI 2×2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
        <Kpi label="Revenus" value={fmt(revenus)} unit="CHF" tone="var(--color-success)" />
        <Kpi label="Dépenses" value={fmt(depenses)} unit="CHF" tone="var(--color-warning)" />
        <Kpi label="Trésorerie" value={fmt(treso)} unit="CHF" tone={treso >= 0 ? "var(--color-text-primary)" : "var(--color-danger)"} />
        {runwayMonths !== null
          ? <Kpi label="Runway" value={String(runwayMonths)} unit={runwayMonths >= 3 ? "mois" : "mois · vigilance"} tone={runwayMonths >= 3 ? "var(--color-gold)" : "var(--color-danger)"} />
          : <Kpi label="Runway" value="—" unit="à renseigner" />}
      </div>

      {/* 3. Plan de route & LACI */}
      {isLaci && (
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <button onClick={() => setLaciOpen((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", minHeight: 48, background: "transparent", border: "none", cursor: "pointer" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-gold)" }} />
              <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-md)", color: "var(--color-text-primary)" }}>Plan de route &amp; LACI</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-gold)" }}>{laciCount}/{LACI_71A_STEPS.length}</span>
              <span style={{ fontSize: 14, color: "var(--color-text-muted)", display: "inline-block", transform: laciOpen ? "rotate(180deg)" : "none", transition: "transform var(--transition-base)" }}>▾</span>
            </span>
          </button>
          <div style={{ maxHeight: laciOpen ? 520 : 0, overflow: "hidden", transition: "max-height var(--transition-slow)" }}>
            <div style={{ padding: "0 10px 10px" }}>
              {LACI_71A_STEPS.map((step, i) => (
                <CheckRow key={i} active={laciDone[i] ?? false} label={step} onToggle={() => toggleLaci(i)} />
              ))}
              <div style={{ display: "flex", gap: "var(--space-2)", padding: "6px 6px 0" }}>
                <button onClick={() => navigate("/business-plan")} style={ghostBtn}>Business plan</button>
                <button onClick={() => { setAgent("juriste"); setOpen(true); }} style={ghostBtn}>Demander au Juriste</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Prochains rendez-vous */}
      <div>
        <p style={sectionLabel}>Prochains rendez-vous</p>
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          {upcoming.length === 0 ? (
            <p style={{ margin: 0, padding: "var(--space-4)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>Aucun événement à venir.</p>
          ) : upcoming.map((ev, i) => (
            <div key={ev.id} style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", borderBottom: i < upcoming.length - 1 ? "var(--border-subtle)" : "none" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: "0 0 2px", fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</p>
                {ev.location && <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-muted)" }}>{ev.location}</p>}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ margin: "0 0 1px", fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-gold)" }}>{ev.time_start ?? ""}</p>
                <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-muted)" }}>{new Date(ev.date).toLocaleDateString("fr-CH", { weekday: "short", day: "numeric", month: "short" })}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Rituels du jour */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
          <p style={cardTitle}>Rituels du jour</p>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-gold)" }}>{ritCount}/{RITUELS.length}</span>
        </div>
        {RITUELS.map((r, i) => <CheckRow key={i} active={ritDone[i] ?? false} label={r} onToggle={() => toggleRituel(i)} />)}
      </div>

      {/* 6. Actions rapides */}
      <div>
        <p style={sectionLabel}>Actions rapides</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <ActionBtn primary icon="💬" label="Parler à Nova" sub="Note vocale ou écrite" onClick={() => setOpen(true)} />
          <ActionBtn icon="📄" label="Nouvelle facture" onClick={() => navigate("/facture")} />
          <ActionBtn icon="👤" label="Ajouter un prospect" onClick={() => navigate("/pipeline")} />
          <ActionBtn icon="💸" label="Saisir une dépense" onClick={() => navigate("/compta")} />
        </div>
      </div>

      {/* 7. Devis express — outil terrain (chiffrer + copier/envoyer) */}
      <DevisExpress />

      {/* 7b. Oracle du jour — mini-jeu de pause */}
      <OracleCard />

      {/* 8. Numéros d'urgence & soutien */}
      <div>
        <p style={sectionLabel}>Numéros d'urgence &amp; soutien</p>
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          {URGENCES.map((u, i) => (
            <a
              key={u.tel}
              href={`tel:${u.tel.replace(/\s/g, "")}`}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", padding: "12px 16px", textDecoration: "none", borderBottom: i < URGENCES.length - 1 ? "var(--border-subtle)" : "none" }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-text-primary)" }}>{u.nom}</span>
                <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{u.note}</span>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "var(--color-gold)" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>{u.tel}
              </span>
            </a>
          ))}
        </div>
      </div>

      {/* 9. Compléter le profil */}
      {profile && !profile.domaine && profileVisible && (
        <div style={{ background: "var(--color-gold-glow)", border: "var(--border-gold)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-3)" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
              <span>✨</span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-md)", color: "var(--color-text-primary)" }}>Complétez votre profil</span>
            </div>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--color-text-secondary)" }}>Domaine manquant — 2 min pour finaliser.</p>
            <button onClick={() => navigate("/settings")} style={{ ...ghostBtn, borderColor: "var(--color-gold)", color: "var(--color-gold)" }}>Compléter maintenant →</button>
          </div>
          <button onClick={() => setProfileVisible(false)} aria-label="Masquer" style={{ width: 26, height: 26, flexShrink: 0, background: "transparent", border: "var(--border-subtle)", borderRadius: "50%", cursor: "pointer", color: "var(--color-text-muted)", fontSize: 12 }}>✕</button>
        </div>
      )}
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  padding: "7px 12px", background: "transparent", border: "var(--border-subtle)",
  borderRadius: "var(--radius-sm)", color: "var(--color-text-secondary)",
  fontFamily: "var(--font-body)", fontSize: "var(--text-xs)", cursor: "pointer",
};

function ActionBtn({ icon, label, sub, onClick, primary }: { icon: string; label: string; sub?: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 13, width: "100%", minHeight: 52,
        padding: "12px 18px", borderRadius: "var(--radius-lg)", cursor: "pointer", textAlign: "left",
        background: primary ? "var(--color-gold)" : "var(--color-bg-elevated)",
        border: primary ? "none" : "var(--border-subtle)",
        color: primary ? "var(--color-text-inverse)" : "var(--color-text-primary)",
        fontFamily: "var(--font-display)", fontSize: "var(--text-base)", fontWeight: primary ? 600 : 400,
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
      <span style={{ display: "flex", flexDirection: "column", gap: 1, lineHeight: 1.2 }}>
        <span>{label}</span>
        {sub && <span style={{ fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 400, opacity: 0.75 }}>{sub}</span>}
      </span>
    </button>
  );
}

