import { useEffect, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { useUserStore } from "@/stores/useUserStore";
import { useAppStore } from "@/stores/useAppStore";

const MONTHS_FR = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

function formatChf(n: number) {
  return n.toLocaleString("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 });
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ width: "100%", height: 80, display: "flex", alignItems: "flex-end" }}>
        <div
          style={{
            width: "100%",
            height: `${pct}%`,
            background: color,
            borderRadius: "2px 2px 0 0",
            minHeight: pct > 0 ? 2 : 0,
            transition: "height 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

export function Finances() {
  const profile = useUserStore((s) => s.profile);
  const { compta, fetchCompta } = useAppStore();

  useEffect(() => {
    if (profile?.id) fetchCompta(profile.id);
  }, [profile?.id]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  const { totalRevenu, totalDepense, byMonth, tvaCollectee } = useMemo(() => {
    const yearEntries = compta.filter((e) => e.date.startsWith(String(currentYear)));
    const totalRevenu = yearEntries.filter((e) => e.type === "revenu").reduce((s, e) => s + e.amount, 0);
    const totalDepense = yearEntries.filter((e) => e.type === "depense").reduce((s, e) => s + e.amount, 0);
    const tvaCollectee = yearEntries
      .filter((e) => e.type === "revenu" && e.tva)
      .reduce((s, e) => s + (e.amount * (e.tva ?? 0)) / (100 + (e.tva ?? 0)), 0);

    const byMonth = Array.from({ length: 12 }, (_, i) => {
      const prefix = `${currentYear}-${String(i + 1).padStart(2, "0")}`;
      const m = yearEntries.filter((e) => e.date.startsWith(prefix));
      return {
        revenu: m.filter((e) => e.type === "revenu").reduce((s, e) => s + e.amount, 0),
        depense: m.filter((e) => e.type === "depense").reduce((s, e) => s + e.amount, 0),
      };
    });
    return { totalRevenu, totalDepense, byMonth, tvaCollectee };
  }, [compta, currentYear]);

  const benefice = totalRevenu - totalDepense;
  const runway = profile?.charges_fixes && profile.charges_fixes > 0
    ? Math.floor((profile.capital ?? 0) / profile.charges_fixes)
    : null;

  const maxBar = Math.max(...byMonth.flatMap((m) => [m.revenu, m.depense]), 1);

  const recentEntries = [...compta].slice(0, 10);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 400, color: "var(--color-text-primary)", margin: 0 }}>
          Finances {currentYear}
        </h2>
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", marginTop: "var(--space-1)" }}>
          Revenus, dépenses et TVA. Complétez via Comptabilité.
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-4)" }}>
        <KpiCard label="Revenus YTD" value={formatChf(totalRevenu)} trend="up" />
        <KpiCard label="Dépenses YTD" value={formatChf(totalDepense)} trend="flat" />
        <KpiCard
          label="Bénéfice net"
          value={formatChf(benefice)}
          trend={benefice >= 0 ? "up" : "down"}
        />
        <KpiCard label="TVA collectée" value={formatChf(tvaCollectee)} trend="flat" />
      </div>

      {/* Runway */}
      {runway !== null && (
        <Card glass>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-text-muted)", margin: 0 }}>
                Runway estimé
              </p>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", color: runway < 3 ? "var(--color-danger)" : runway < 6 ? "var(--color-warning)" : "var(--color-gold)", margin: "var(--space-2) 0 0" }}>
                {runway} mois
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: 0 }}>Capital</p>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", margin: "var(--space-1) 0 0" }}>
                {formatChf(profile?.capital ?? 0)}
              </p>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: "var(--space-2) 0 0" }}>Charges fixes/mois</p>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", margin: "var(--space-1) 0 0" }}>
                {formatChf(profile?.charges_fixes ?? 0)}
              </p>
            </div>
          </div>
          {runway < 3 && (
            <p style={{ marginTop: "var(--space-3)", fontSize: "var(--text-xs)", color: "var(--color-danger)", background: "rgba(239,68,68,0.08)", borderRadius: "var(--radius-xs)", padding: "var(--space-2)" }}>
              Runway critique — moins de 3 mois. Consulter le Financier Hermès.
            </p>
          )}
        </Card>
      )}

      {/* Graphe mensuel */}
      <Card glass>
        <p style={{ fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "var(--space-4)" }}>
          Revenus vs Dépenses — mensuel
        </p>
        <div style={{ display: "flex", gap: "var(--space-1)", alignItems: "flex-end" }}>
          {byMonth.map((m, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
              <div style={{ width: "100%", display: "flex", gap: 2, alignItems: "flex-end", height: 80 }}>
                <Bar value={m.revenu} max={maxBar} color="var(--color-gold)" />
                <Bar value={m.depense} max={maxBar} color="rgba(239,68,68,0.5)" />
              </div>
              <span style={{ fontSize: 9, color: i === currentMonth ? "var(--color-gold)" : "var(--color-text-muted)", fontWeight: i === currentMonth ? 600 : 400 }}>
                {MONTHS_FR[i]}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: "var(--space-6)", marginTop: "var(--space-3)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--color-gold)", display: "inline-block" }} />
            Revenus
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(239,68,68,0.5)", display: "inline-block" }} />
            Dépenses
          </span>
        </div>
      </Card>

      {/* Dernières transactions */}
      <Card glass>
        <p style={{ fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "var(--space-4)" }}>
          Dernières transactions
        </p>
        {recentEntries.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
            Aucune transaction. Ajoutez-en via <a href="/compta" style={{ color: "var(--color-gold)" }}>Comptabilité</a>.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {recentEntries.map((e) => (
              <div
                key={e.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "var(--space-3) 0",
                  borderBottom: "var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)" }}>
                    {e.description ?? "Sans description"}
                  </span>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                    {e.date} {e.fournisseur ? `· ${e.fournisseur}` : ""} {e.category ? `· ${e.category}` : ""}
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-sm)",
                    fontWeight: 500,
                    color: e.type === "revenu" ? "var(--color-success)" : "var(--color-danger)",
                  }}
                >
                  {e.type === "revenu" ? "+" : "-"}{formatChf(e.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
