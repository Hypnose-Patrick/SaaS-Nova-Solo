import { useEffect } from "react";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useUserStore } from "@/stores/useUserStore";
import { useAppStore } from "@/stores/useAppStore";
import { useChatStore } from "@/stores/useChatStore";

export function Dashboard() {
  const profile = useUserStore((s) => s.profile);
  const { compta, fetchCompta, events, fetchEvents } = useAppStore();
  const setOpen = useChatStore((s) => s.setOpen);

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

        {/* Actions rapides */}
        <Card title="Actions rapides" glass>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <Button size="sm" variant="gold" onClick={() => setOpen(true)} style={{ width: "100%", justifyContent: "center" }}>
              Parler à Nova
            </Button>
            <Button size="sm" variant="ghost" style={{ width: "100%", justifyContent: "center" }}>
              Nouvelle facture
            </Button>
            <Button size="sm" variant="ghost" style={{ width: "100%", justifyContent: "center" }}>
              Ajouter prospect
            </Button>
            <Button size="sm" variant="ghost" style={{ width: "100%", justifyContent: "center" }}>
              Saisir dépense
            </Button>
          </div>
        </Card>
      </div>

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
