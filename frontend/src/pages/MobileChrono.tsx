import { useEffect, useMemo, useRef, useState } from "react";

/**
 * MobileChrono — Maquette cliquable du "companion mobile" Nova Solo.
 *
 * Prototype jetable pour tester l'hypothèse #1 : "l'indépendant lancera un chrono".
 * 3 écrans : Accueil (idle) → Chrono en cours (running) → Stop / capture de valeur (stopped).
 * Aucune persistance, aucune vraie logique — juste le flow, pour le montrer à un artisan réel.
 */

type Mandate = { id: string; client: string; label: string; rate: number; agenda?: boolean };
type Screen = "idle" | "running" | "stopped";
type Capture = "ticket" | "note" | "extension";
type BillItem = { id: string; label: string; client: string; amount: number };

const MANDATES: Mandate[] = [
  { id: "m1", client: "Dupont", label: "Fuite cuisine", rate: 120, agenda: true },
  { id: "m2", client: "Résidence Bellevue", label: "Entretien chauffage", rate: 110 },
  { id: "m3", client: "Café du Marché", label: "WC bouché", rate: 130 },
];

const CAPTURES: { key: Capture; icon: string; label: string; toast: string }[] = [
  { key: "ticket", icon: "📷", label: "Ticket", toast: "Ticket rattaché" },
  { key: "note", icon: "🎤", label: "Note", toast: "Note vocale rattachée" },
  { key: "extension", icon: "➕", label: "Extension", toast: "Extension notée" },
];

function fmtClock(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function chf(n: number): string {
  return new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function MobileChrono() {
  const [screen, setScreen] = useState<Screen>("idle");
  const [picker, setPicker] = useState(false);
  const [active, setActive] = useState<Mandate | null>(null);

  // Chrono : on stocke le timestamp de départ (survit à un re-render) + un offset "démo".
  const startRef = useRef<number>(0);
  const [demoOffset, setDemoOffset] = useState(0);
  const [now, setNow] = useState(0);

  const [captures, setCaptures] = useState<Record<Capture, number>>({ ticket: 0, note: 0, extension: 0 });
  const [toast, setToast] = useState<string | null>(null);

  // Écran STOP : durée figée + éditable (rattrapage), description
  const [stopMs, setStopMs] = useState(0);
  const [note, setNote] = useState("");

  const [pile, setPile] = useState<BillItem[]>([]);

  const elapsed = now + demoOffset;

  useEffect(() => {
    if (screen !== "running") return;
    const id = window.setInterval(() => setNow(Date.now() - startRef.current), 1000);
    setNow(Date.now() - startRef.current);
    return () => window.clearInterval(id);
  }, [screen]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 1600);
    return () => window.clearTimeout(id);
  }, [toast]);

  function startMandate(m: Mandate) {
    setActive(m);
    startRef.current = Date.now();
    setDemoOffset(0);
    setNow(0);
    setCaptures({ ticket: 0, note: 0, extension: 0 });
    setPicker(false);
    setScreen("running");
  }

  function doCapture(c: (typeof CAPTURES)[number]) {
    setCaptures((prev) => ({ ...prev, [c.key]: prev[c.key] + 1 }));
    setToast(`${c.icon} ${c.toast} à ${active?.client}`);
  }

  function stop() {
    setStopMs(elapsed);
    setNote("");
    setScreen("stopped");
  }

  const stopMinutes = Math.max(1, Math.round(stopMs / 60000));
  const stopAmount = active ? (active.rate * stopMinutes) / 60 : 0;
  const capCount = captures.ticket + captures.note + captures.extension;

  function confirmStop() {
    if (active) {
      setPile((p) => [
        { id: `${Date.now()}`, label: active.label, client: active.client, amount: stopAmount },
        ...p,
      ]);
    }
    setActive(null);
    setScreen("idle");
  }

  const pileTotal = useMemo(() => pile.reduce((s, i) => s + i.amount, 0), [pile]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-6)", paddingBottom: "var(--space-12)" }}>
      <div style={{ textAlign: "center", maxWidth: 520 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", color: "var(--color-text-primary)", margin: 0 }}>
          Companion mobile — Chrono
        </h1>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)", marginTop: "var(--space-2)" }}>
          Maquette cliquable · À montrer à un artisan pour valider l'hypothèse « il lancera un chrono ».
        </p>
      </div>

      {/* Cadre téléphone */}
      <div
        style={{
          width: 390,
          height: 800,
          borderRadius: 40,
          border: "1px solid var(--color-gold-border)",
          background: "var(--color-bg-primary)",
          boxShadow: "var(--shadow-xl)",
          padding: 12,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Encoche */}
        <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", width: 120, height: 22, background: "#000", borderBottomLeftRadius: 12, borderBottomRightRadius: 12, zIndex: 5 }} />

        <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 30, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {screen === "idle" && <IdleScreen pile={pile} pileTotal={pileTotal} onStart={() => setPicker(true)} />}
          {screen === "running" && active && (
            <RunningScreen mandate={active} clock={fmtClock(elapsed)} captures={captures} onCapture={doCapture} onStop={stop} onFastForward={() => setDemoOffset((o) => o + 30 * 60000)} />
          )}
          {screen === "stopped" && active && (
            <StopScreen
              mandate={active}
              minutes={stopMinutes}
              amount={stopAmount}
              capCount={capCount}
              note={note}
              setNote={setNote}
              onAdjust={(delta) => setStopMs((ms) => Math.max(60000, ms + delta * 60000))}
              onConfirm={confirmStop}
            />
          )}

          {/* Bottom sheet : choix du mandat */}
          {picker && <MandatePicker onPick={startMandate} onClose={() => setPicker(false)} />}

          {/* Toast */}
          {toast && (
            <div style={{ position: "absolute", bottom: 100, left: "50%", transform: "translateX(-50%)", background: "var(--color-bg-elevated)", border: "1px solid var(--color-gold-border)", color: "var(--color-text-primary)", fontSize: "var(--text-sm)", fontFamily: "var(--font-body)", padding: "var(--space-3) var(--space-5)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)", zIndex: 40, whiteSpace: "nowrap" }}>
              {toast}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Écran 0 : Accueil ---------- */

function IdleScreen({ pile, pileTotal, onStart }: { pile: BillItem[]; pileTotal: number; onStart: () => void }) {
  return (
    <ScreenShell>
      <TopLabel>Nova Solo · Terrain</TopLabel>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "var(--space-8)" }}>
        <button
          onClick={onStart}
          style={{
            width: 220,
            height: 220,
            borderRadius: "50%",
            border: "1px solid var(--color-gold)",
            background: "var(--color-gold-glow)",
            color: "var(--color-gold)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-md)",
            fontWeight: 500,
            letterSpacing: "var(--tracking-wider)",
            textTransform: "uppercase",
            cursor: "pointer",
            boxShadow: "0 0 40px var(--color-gold-glow)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-2)",
          }}
        >
          <span style={{ fontSize: 40 }}>⏱</span>
          Démarrer
        </button>
        <button style={ghostLink} onClick={onStart}>
          + Ajouter du temps manuellement
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <MiniRow icon="💰" label="À facturer" value={`${pile.length} ligne${pile.length > 1 ? "s" : ""} · CHF ${chf(pileTotal)}`} highlight={pile.length > 0} />
        <MiniRow icon="📅" label="Prochain RDV" value="14:30 · Résidence Bellevue" />
      </div>
    </ScreenShell>
  );
}

/* ---------- Écran 1 : Chrono en cours ---------- */

function RunningScreen({
  mandate,
  clock,
  captures,
  onCapture,
  onStop,
  onFastForward,
}: {
  mandate: Mandate;
  clock: string;
  captures: Record<Capture, number>;
  onCapture: (c: (typeof CAPTURES)[number]) => void;
  onStop: () => void;
  onFastForward: () => void;
}) {
  return (
    <ScreenShell>
      <TopLabel>Mandat actif</TopLabel>

      <div style={{ textAlign: "center", marginTop: "var(--space-4)" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", color: "var(--color-text-primary)" }}>{mandate.client}</div>
        <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>{mandate.label} · CHF {mandate.rate}/h</div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 56, color: "var(--color-gold)", letterSpacing: "0.02em", position: "relative" }}>
          <span style={{ position: "absolute", top: -6, left: -18, fontSize: 14, color: "var(--color-success)" }}>●</span>
          {clock}
        </span>
      </div>

      {/* Captures rattachées auto au mandat */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
        {CAPTURES.map((c) => (
          <button key={c.key} onClick={() => onCapture(c)} style={captureBtn}>
            <span style={{ fontSize: 26 }}>{c.icon}</span>
            <span style={{ fontSize: "var(--text-xs)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--color-text-secondary)" }}>{c.label}</span>
            {captures[c.key] > 0 && (
              <span style={{ position: "absolute", top: 6, right: 10, fontSize: "var(--text-xs)", color: "var(--color-gold)" }}>{captures[c.key]}</span>
            )}
          </button>
        ))}
      </div>

      <button onClick={onStop} style={{ ...bigBtn, borderColor: "var(--color-danger)", color: "var(--color-danger)" }}>
        ⏹ Arrêter
      </button>

      <button onClick={onFastForward} style={{ ...ghostLink, marginTop: "var(--space-3)", fontSize: 10 }}>
        démo : avancer de 30 min ⏩
      </button>
    </ScreenShell>
  );
}

/* ---------- Écran 2 : STOP / capture de valeur ---------- */

function StopScreen({
  mandate,
  minutes,
  amount,
  capCount,
  note,
  setNote,
  onAdjust,
  onConfirm,
}: {
  mandate: Mandate;
  minutes: number;
  amount: number;
  capCount: number;
  note: string;
  setNote: (v: string) => void;
  onAdjust: (deltaMin: number) => void;
  onConfirm: () => void;
}) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const dur = h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;

  return (
    <ScreenShell>
      <div style={{ textAlign: "center", marginTop: "var(--space-6)" }}>
        <div style={{ fontSize: 34 }}>✅</div>
        <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", color: "var(--color-success)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", marginTop: "var(--space-2)" }}>
          {dur} enregistré
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", color: "var(--color-text-primary)", marginTop: "var(--space-1)" }}>
          {mandate.client} · {mandate.label}
        </div>
      </div>

      {/* Le moment "argent gagné" */}
      <div style={{ margin: "var(--space-6) 0", padding: "var(--space-5)", background: "var(--color-bg-surface)", border: "1px solid var(--color-gold-border)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
          {dur} × CHF {mandate.rate}/h
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", color: "var(--color-gold)", marginTop: "var(--space-1)" }}>
          CHF {chf(amount)}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
          <button style={adjustBtn} onClick={() => onAdjust(-15)}>−15 min</button>
          <button style={adjustBtn} onClick={() => onAdjust(15)}>+15 min</button>
        </div>
      </div>

      {capCount > 0 && (
        <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", textAlign: "center", marginBottom: "var(--space-4)" }}>
          📎 {capCount} élément{capCount > 1 ? "s" : ""} rattaché{capCount > 1 ? "s" : ""} à ce mandat
        </div>
      )}

      <TopLabel>Qu'as-tu fait ? (facultatif)</TopLabel>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="🎤 ou tape ici… (tu peux aussi remplir au bureau)"
        rows={2}
        style={{
          width: "100%",
          marginTop: "var(--space-2)",
          marginBottom: "var(--space-5)",
          background: "var(--color-bg-input)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "var(--radius-sm)",
          color: "var(--color-text-primary)",
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-sm)",
          padding: "var(--space-3)",
          resize: "none",
        }}
      />

      <div style={{ flex: 1 }} />

      <button onClick={onConfirm} style={{ ...bigBtn, background: "var(--color-gold-glow)" }}>
        → Ajouter à « à facturer »
      </button>
    </ScreenShell>
  );
}

/* ---------- Bottom sheet : sélection du mandat ---------- */

function MandatePicker({ onPick, onClose }: { onPick: (m: Mandate) => void; onClose: () => void }) {
  const agenda = MANDATES.filter((m) => m.agenda);
  const recents = MANDATES.filter((m) => !m.agenda);
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 30, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--color-bg-elevated)", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTop: "1px solid var(--color-gold-border)", padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
      >
        <div style={{ width: 40, height: 4, background: "var(--color-text-muted)", borderRadius: 2, alignSelf: "center" }} />
        <TopLabel>Démarrer sur…</TopLabel>

        {agenda.length > 0 && (
          <>
            <div style={sublabel}>RDV maintenant</div>
            {agenda.map((m) => (
              <MandateRow key={m.id} m={m} highlight onPick={onPick} />
            ))}
          </>
        )}

        <div style={sublabel}>Mandats récents</div>
        {recents.map((m) => (
          <MandateRow key={m.id} m={m} onPick={onPick} />
        ))}

        <button style={{ ...ghostLink, marginTop: "var(--space-2)" }} onClick={() => onPick({ id: "new", client: "Nouveau client", label: "Job ad hoc", rate: 120 })}>
          ➕ Nouveau (client / job ad hoc)
        </button>
      </div>
    </div>
  );
}

function MandateRow({ m, highlight, onPick }: { m: Mandate; highlight?: boolean; onPick: (m: Mandate) => void }) {
  return (
    <button
      onClick={() => onPick(m)}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        padding: "var(--space-4)",
        background: highlight ? "var(--color-gold-glow)" : "var(--color-bg-surface)",
        border: highlight ? "1px solid var(--color-gold)" : "1px solid rgba(255,255,255,0.06)",
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-md)", color: "var(--color-text-primary)" }}>{m.client}</span>
        <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>{m.label}</span>
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "var(--color-gold)" }}>{m.rate}.-/h</span>
    </button>
  );
}

/* ---------- Primitives ---------- */

function ScreenShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "var(--space-8) var(--space-5) var(--space-5)", background: "var(--color-bg-primary)" }}>
      {children}
    </div>
  );
}

function TopLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-xs)", letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
      {children}
    </span>
  );
}

function MiniRow({ icon, label, value, highlight }: { icon: string; label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-3) var(--space-4)", background: "var(--color-bg-surface)", border: highlight ? "1px solid var(--color-gold-border)" : "1px solid rgba(255,255,255,0.05)", borderRadius: "var(--radius-md)" }}>
      <span style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-xs)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--color-text-muted)" }}>{label}</span>
      </span>
      <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", color: highlight ? "var(--color-gold)" : "var(--color-text-secondary)" }}>{value}</span>
    </div>
  );
}

const bigBtn: React.CSSProperties = {
  width: "100%",
  padding: "var(--space-4)",
  background: "transparent",
  border: "1px solid var(--color-gold)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-gold)",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  fontWeight: 500,
  letterSpacing: "var(--tracking-wider)",
  textTransform: "uppercase",
  cursor: "pointer",
};

const captureBtn: React.CSSProperties = {
  position: "relative",
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "var(--space-2)",
  padding: "var(--space-4) var(--space-2)",
  background: "var(--color-bg-surface)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "var(--radius-md)",
  cursor: "pointer",
};

const adjustBtn: React.CSSProperties = {
  padding: "var(--space-2) var(--space-4)",
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text-secondary)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-xs)",
  cursor: "pointer",
};

const ghostLink: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--color-text-muted)",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: 3,
};

const sublabel: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-xs)",
  letterSpacing: "var(--tracking-wide)",
  textTransform: "uppercase",
  color: "var(--color-text-muted)",
  marginTop: "var(--space-2)",
};
