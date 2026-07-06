import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { useUserStore } from "@/stores/useUserStore";
import { supabase } from "@/lib/supabase";
import { activitePreset } from "@/lib/activite";
import type { CaptureItem, Mandat, TimeEntry } from "@/types";

/**
 * Mandats — vue desktop en lecture enrichie du compagnon terrain.
 *
 * Pas de gestion de projet : c'est le miroir « au calme » de ce qui a été
 * capturé sur le terrain. Chaque mandat agrège son temps cumulé (time_entries)
 * et ses captures rattachées. Le vocabulaire suit le profil métier (preset).
 */

function chf(n: number): string {
  return new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtDur(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

const KIND_ICON: Record<string, string> = { photo: "📷", voice: "🎤", note: "📝" };

export function Mandats() {
  const profile = useUserStore((s) => s.profile);
  const preset = activitePreset(profile);
  const label = preset.mandatLabel;
  const labelPlural = preset.mandatLabelPlural;

  const [mandats, setMandats] = useState<Mandat[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [mRes, tRes, cRes] = await Promise.all([
        supabase.from("mandats").select("*").eq("profile_id", profile.id).order("updated_at", { ascending: false }),
        supabase.from("time_entries").select("*").eq("profile_id", profile.id).not("ended_at", "is", null),
        supabase.from("captures").select("*").eq("profile_id", profile.id).not("mandat_id", "is", null),
      ]);
      if (cancelled) return;
      setMandats((mRes.data as Mandat[]) ?? []);
      setEntries((tRes.data as TimeEntry[]) ?? []);
      setCaptures((cRes.data as CaptureItem[]) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [profile?.id]);

  const byMandat = useMemo(() => {
    const map = new Map<string, { minutes: number; amount: number; captures: number }>();
    for (const e of entries) {
      if (!e.mandat_id) continue;
      const cur = map.get(e.mandat_id) ?? { minutes: 0, amount: 0, captures: 0 };
      const min = e.duration_min ?? 0;
      cur.minutes += min;
      cur.amount += (min * (e.hourly_rate ?? 0)) / 60;
      map.set(e.mandat_id, cur);
    }
    for (const c of captures) {
      if (!c.mandat_id) continue;
      const cur = map.get(c.mandat_id) ?? { minutes: 0, amount: 0, captures: 0 };
      cur.captures += 1;
      map.set(c.mandat_id, cur);
    }
    return map;
  }, [entries, captures]);

  if (loading) {
    return <div style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-body)" }}>Chargement…</div>;
  }

  if (mandats.length === 0) {
    return (
      <Card>
        <p style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", margin: 0 }}>
          Aucun {label} pour l'instant. Vos {labelPlural} apparaîtront ici dès que vous démarrerez un chrono ou classerez une capture depuis le compagnon <strong>Terrain</strong> (mobile).
        </p>
      </Card>
    );
  }

  const openCount = mandats.filter((m) => m.status === "open").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <p style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", margin: 0 }}>
        {mandats.length} {mandats.length > 1 ? labelPlural : label} · {openCount} en cours
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {mandats.map((m) => {
          const agg = byMandat.get(m.id) ?? { minutes: 0, amount: 0, captures: 0 };
          return (
            <Card key={m.id} style={{ padding: "var(--space-4) var(--space-5)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-md)", color: "var(--color-text-primary)" }}>
                      {m.client_name ?? m.title}
                    </span>
                    <StatusPill status={m.status} />
                  </div>
                  {m.client_name && (
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>{m.title}</div>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
                  <Stat label="Temps" value={agg.minutes > 0 ? fmtDur(agg.minutes) : "—"} />
                  <Stat label="À facturer" value={agg.amount > 0 ? `CHF ${chf(agg.amount)}` : "—"} gold />
                  <Stat label="Captures" value={agg.captures > 0 ? String(agg.captures) : "—"} />
                </div>
              </div>

              {agg.captures > 0 && (
                <div style={{ marginTop: "var(--space-3)", display: "flex", gap: "var(--space-2)" }}>
                  {captures
                    .filter((c) => c.mandat_id === m.id)
                    .slice(0, 8)
                    .map((c) => (
                      <span key={c.id} title={c.note ?? c.transcript ?? c.kind} style={{ fontSize: 16, opacity: 0.85 }}>
                        {KIND_ICON[c.kind] ?? "•"}
                      </span>
                    ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Mandat["status"] }) {
  const map: Record<Mandat["status"], { label: string; color: string }> = {
    open: { label: "En cours", color: "var(--color-success)" },
    done: { label: "Terminé", color: "var(--color-text-muted)" },
    invoiced: { label: "Facturé", color: "var(--color-gold)" },
  };
  const s = map[status];
  return (
    <span style={{ fontSize: 10, letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: s.color, border: `1px solid ${s.color}`, borderRadius: "var(--radius-sm)", padding: "1px 6px", opacity: 0.9 }}>
      {s.label}
    </span>
  );
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: 10, letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--color-text-muted)" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: gold ? "var(--color-gold)" : "var(--color-text-primary)" }}>{value}</div>
    </div>
  );
}
