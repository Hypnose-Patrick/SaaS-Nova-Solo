import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useUserStore } from "@/stores/useUserStore";
import { useAppStore } from "@/stores/useAppStore";
import { supabase } from "@/lib/supabase";
import type { CalendarEvent } from "@/types";

const DAYS_FR   = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

type EventType = NonNullable<CalendarEvent["type"]>;

const TYPE_COLOR: Record<EventType, "gold" | "warning" | "success" | "muted"> = {
  rdv:       "gold",
  tache:     "warning",
  formation: "success",
  autre:     "muted",
};
const TYPE_LABEL: Record<EventType, string> = {
  rdv: "RDV", tache: "Tâche", formation: "Formation", autre: "Autre",
};
const TYPE_DOT: Record<EventType, string> = {
  rdv:       "var(--color-gold)",
  tache:     "var(--color-warning, #f59e0b)",
  formation: "var(--color-success)",
  autre:     "var(--color-text-muted)",
};

function buildCalendar(year: number, month: number): (number | null)[] {
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7; // Lun=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function dateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface NewEvent {
  title: string;
  date: string;
  time_start: string;
  time_end: string;
  type: EventType;
  location: string;
  all_day: boolean;
}

export function Agenda() {
  const profile = useUserStore((s) => s.profile);
  const { events, fetchEvents } = useAppStore();

  const now = new Date();
  const [viewYear, setViewYear]   = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(now.getDate());
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);

  const [form, setForm] = useState<NewEvent>({
    title:      "",
    date:       dateStr(now.getFullYear(), now.getMonth(), now.getDate()),
    time_start: "",
    time_end:   "",
    type:       "rdv",
    location:   "",
    all_day:    false,
  });

  useEffect(() => {
    if (profile?.id) fetchEvents(profile.id);
  }, [profile?.id]);

  function eventsForDay(day: number) {
    return events.filter((e) => e.date === dateStr(viewYear, viewMonth, day));
  }

  function prevMonth() {
    setSelectedDay(null);
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    setSelectedDay(null);
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }

  function selectDay(day: number) {
    setSelectedDay(day);
    setForm((f) => ({ ...f, date: dateStr(viewYear, viewMonth, day) }));
    setShowForm(false);
  }

  function setF(patch: Partial<NewEvent>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function addEvent() {
    if (!profile?.id || !form.title.trim() || !form.date) return;
    setSaving(true);
    const { data } = await supabase
      .from("events")
      .insert({
        profile_id: profile.id,
        title:      form.title.trim(),
        date:       form.date,
        time_start: form.all_day ? null : form.time_start || null,
        time_end:   form.all_day ? null : form.time_end   || null,
        type:       form.type,
        location:   form.location || null,
        all_day:    form.all_day,
      })
      .select()
      .single();

    if (data) {
      useAppStore.setState((s) => ({
        events: [...s.events, data as CalendarEvent].sort((a, b) => a.date.localeCompare(b.date)),
      }));
    }
    setForm((f) => ({ ...f, title: "", time_start: "", time_end: "", location: "", all_day: false }));
    setShowForm(false);
    setSaving(false);
  }

  async function deleteEvent(id: string) {
    await supabase.from("events").delete().eq("id", id);
    useAppStore.setState((s) => ({ events: s.events.filter((e) => e.id !== id) }));
  }

  const cells      = buildCalendar(viewYear, viewMonth);
  const todayStr   = dateStr(now.getFullYear(), now.getMonth(), now.getDate());
  const selEvents  = selectedDay ? eventsForDay(selectedDay) : [];

  const upcomingEnd = new Date(now);
  upcomingEnd.setDate(upcomingEnd.getDate() + 7);
  const upcoming = events
    .filter((e) => e.date >= todayStr && e.date <= upcomingEnd.toISOString().slice(0, 10))
    .slice(0, 6);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 400, color: "var(--color-text-primary)", margin: 0 }}>
            Agenda
          </h2>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", marginTop: "var(--space-1)" }}>
            RDV, tâches et formations. Cliquez un jour pour le détailler.
          </p>
        </div>
        <Button size="sm" variant="gold" onClick={() => setShowForm((v) => !v)}>
          + Événement
        </Button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 268px", gap: "var(--space-6)", alignItems: "start" }}>
        {/* Colonne principale */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>

          {/* Calendrier */}
          <Card glass>
            {/* Navigation */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
              <button
                onClick={prevMonth}
                style={{ background: "none", border: "var(--border-subtle)", borderRadius: "var(--radius-xs)", color: "var(--color-text-muted)", cursor: "pointer", padding: "2px 10px", fontSize: "var(--text-base)", lineHeight: "1.8" }}
              >
                ‹
              </button>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", color: "var(--color-text-primary)" }}>
                {MONTHS_FR[viewMonth]} {viewYear}
              </span>
              <button
                onClick={nextMonth}
                style={{ background: "none", border: "var(--border-subtle)", borderRadius: "var(--radius-xs)", color: "var(--color-text-muted)", cursor: "pointer", padding: "2px 10px", fontSize: "var(--text-base)", lineHeight: "1.8" }}
              >
                ›
              </button>
            </div>

            {/* Jours semaine */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: "var(--space-2)" }}>
              {DAYS_FR.map((d) => (
                <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", padding: "var(--space-1) 0" }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Grille jours */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
              {cells.map((day, idx) => {
                if (!day) return <div key={idx} style={{ minHeight: 52 }} />;
                const ds        = dateStr(viewYear, viewMonth, day);
                const isToday   = ds === todayStr;
                const isSel     = day === selectedDay;
                const dayEvents = eventsForDay(day);

                return (
                  <div
                    key={idx}
                    onClick={() => selectDay(day)}
                    style={{
                      borderRadius: "var(--radius-xs)",
                      padding: "var(--space-1)",
                      cursor: "pointer",
                      background: isSel
                        ? "var(--color-gold)"
                        : isToday
                        ? "rgba(197,165,114,0.12)"
                        : "transparent",
                      border: isSel
                        ? "none"
                        : isToday
                        ? "1px solid rgba(197,165,114,0.3)"
                        : "1px solid transparent",
                      minHeight: 52,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 3,
                      transition: "background var(--transition-fast)",
                    }}
                  >
                    <span style={{
                      fontSize: "var(--text-xs)",
                      fontWeight: isToday || isSel ? 600 : 400,
                      color: isSel ? "var(--color-bg-primary)" : isToday ? "var(--color-gold)" : "var(--color-text-secondary)",
                    }}>
                      {day}
                    </span>
                    <div style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
                      {dayEvents.slice(0, 3).map((e, i) => (
                        <span key={i} style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: isSel ? "rgba(0,0,0,0.3)" : TYPE_DOT[e.type ?? "autre"],
                        }} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Détail jour sélectionné */}
          {selectedDay && (
            <Card glass>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-base)", color: "var(--color-text-primary)", margin: 0 }}>
                  {selectedDay} {MONTHS_FR[viewMonth]} {viewYear}
                </p>
                <Button size="sm" variant="ghost" onClick={() => setShowForm(true)} style={{ fontSize: "var(--text-xs)", padding: "2px 8px" }}>
                  + Ajouter
                </Button>
              </div>

              {selEvents.length === 0 ? (
                <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>Aucun événement ce jour.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {selEvents.map((e) => (
                    <div
                      key={e.id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        padding: "var(--space-3)",
                        background: "var(--color-bg-primary)",
                        borderRadius: "var(--radius-sm)",
                        border: "var(--border-subtle)",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                          {e.type && <Badge color={TYPE_COLOR[e.type]}>{TYPE_LABEL[e.type]}</Badge>}
                          <span style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                            {e.title}
                          </span>
                        </div>
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                          {e.all_day ? "Journée entière" : [e.time_start, e.time_end].filter(Boolean).join(" → ")}
                          {e.location ? ` · ${e.location}` : ""}
                        </span>
                      </div>
                      <button
                        onClick={() => deleteEvent(e.id)}
                        title="Supprimer"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", fontSize: 11, opacity: 0.4, padding: 2, lineHeight: 1 }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Formulaire ajout */}
          {showForm && (
            <Card glass>
              <p style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-text-primary)", marginBottom: "var(--space-4)" }}>
                Nouvel événement
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
                <Input
                  label="Titre *"
                  value={form.title}
                  onChange={(e) => setF({ title: e.target.value })}
                  placeholder="Réunion client, formation…"
                />
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                  <label style={{ fontSize: "var(--text-xs)", fontWeight: 500, letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
                    Type
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setF({ type: e.target.value as EventType })}
                    style={{ background: "var(--color-bg-input)", border: "var(--border-subtle)", borderRadius: "var(--radius-sm)", color: "var(--color-text-primary)", fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", padding: "var(--space-3) var(--space-4)", outline: "none" }}
                  >
                    <option value="rdv">RDV</option>
                    <option value="tache">Tâche</option>
                    <option value="formation">Formation</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <Input
                  label="Date *"
                  type="date"
                  value={form.date}
                  onChange={(e) => setF({ date: e.target.value })}
                />
                <Input
                  label="Lieu"
                  value={form.location}
                  onChange={(e) => setF({ location: e.target.value })}
                  placeholder="Lausanne / Zoom"
                />
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.all_day}
                  onChange={(e) => setF({ all_day: e.target.checked })}
                  style={{ accentColor: "var(--color-gold)", width: 14, height: 14 }}
                />
                <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>Journée entière</span>
              </label>

              {!form.all_day && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
                  <Input label="Heure début" type="time" value={form.time_start} onChange={(e) => setF({ time_start: e.target.value })} />
                  <Input label="Heure fin"   type="time" value={form.time_end}   onChange={(e) => setF({ time_end:   e.target.value })} />
                </div>
              )}

              <div style={{ display: "flex", gap: "var(--space-3)" }}>
                <Button size="sm" variant="gold" loading={saving} onClick={addEvent}>Créer</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Annuler</Button>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Card glass>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "var(--space-3)", margin: "0 0 var(--space-3) 0" }}>
              7 prochains jours
            </p>
            {upcoming.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>Agenda libre.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {upcoming.map((e) => (
                  <div key={e.id} style={{ paddingBottom: "var(--space-3)", borderBottom: "var(--border-subtle)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
                      {e.type && <Badge color={TYPE_COLOR[e.type]}>{TYPE_LABEL[e.type]}</Badge>}
                    </div>
                    <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-text-primary)" }}>{e.title}</div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                      {e.date}{e.time_start ? ` · ${e.time_start}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card glass>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-muted)", margin: "0 0 var(--space-3) 0" }}>
              Légende
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {(Object.entries(TYPE_LABEL) as [EventType, string][]).map(([type, label]) => (
                <div key={type} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: TYPE_DOT[type], flexShrink: 0 }} />
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>{label}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
