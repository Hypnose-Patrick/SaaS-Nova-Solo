import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, signedUrl } from "@/lib/supabase";
import { useUserStore } from "@/stores/useUserStore";
import { ocrReceipt, transcribeNote } from "@/lib/ai";
import { activitePreset, type CaptureAction } from "@/lib/activite";
import type { CaptureItem, Mandat, TimeEntry } from "@/types";

/**
 * Terrain — le compagnon terrain de Nova Solo (V1 persistée, remplace la
 * maquette MobileChrono).
 *
 * Règle de rattachement (cœur du flux) : chrono actif → la capture est
 * rattachée au mandat en cours et triée d'office ; pas de chrono → la capture
 * naît orpheline dans l'inbox « à trier ». Aucune question posée au moment de
 * la capture (10 s, une main).
 *
 * Le profil métier (activite_type) ne pilote QUE la présentation : libellés
 * (« chantier » / « mandat » / « commande »), ordre des boutons de capture,
 * micro-textes. Les données sont métier-agnostiques.
 */

type Screen = "idle" | "running" | "stopped";

const CAPTURE_DEFS: Record<CaptureAction, { icon: string; label: string }> = {
  photo: { icon: "📷", label: "Photo" },
  voice: { icon: "🎤", label: "Vocal" },
  note: { icon: "📝", label: "Note" },
};

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

function fmtDur(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

export function Terrain() {
  const profile = useUserStore((s) => s.profile);
  const preset = activitePreset(profile);

  const [mandats, setMandats] = useState<Mandat[]>([]);
  const [running, setRunning] = useState<TimeEntry | null>(null);
  const [inbox, setInbox] = useState<CaptureItem[]>([]);
  const [unbilled, setUnbilled] = useState<{ count: number; total: number }>({ count: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  const [screen, setScreen] = useState<Screen>("idle");
  const [picker, setPicker] = useState<null | "start" | "manual" | { attach: CaptureItem }>(null);
  const [manualFor, setManualFor] = useState<Mandat | null>(null);
  const [noteSheet, setNoteSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Chrono affiché (le vrai état vit en base : running.started_at)
  const [now, setNow] = useState(Date.now());
  // Écran STOP : durée figée + éditable (rattrapage), description
  const [stopMin, setStopMin] = useState(0);
  const [stopNote, setStopNote] = useState("");
  const [captureCount, setCaptureCount] = useState(0);

  // Enregistrement vocal
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordStartRef = useRef(0);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const activeMandat = running ? mandats.find((m) => m.id === running.mandat_id) ?? null : null;
  const elapsedMs = running ? now - new Date(running.started_at).getTime() : 0;

  const showToast = useCallback((msg: string) => setToast(msg), []);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    setNow(Date.now());
    return () => window.clearInterval(id);
  }, [running]);

  // Chargement initial : mandats ouverts, chrono en cours, inbox, à facturer.
  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [mRes, tRes, cRes, uRes] = await Promise.all([
        supabase.from("mandats").select("*").eq("profile_id", profile.id).eq("status", "open").order("updated_at", { ascending: false }),
        supabase.from("time_entries").select("*").eq("profile_id", profile.id).is("ended_at", null).maybeSingle(),
        supabase.from("captures").select("*").eq("profile_id", profile.id).is("triaged_at", null).order("captured_at", { ascending: false }),
        supabase.from("time_entries").select("duration_min, hourly_rate").eq("profile_id", profile.id).eq("billed", false).not("ended_at", "is", null),
      ]);
      if (cancelled) return;
      setMandats((mRes.data as Mandat[]) ?? []);
      setInbox((cRes.data as CaptureItem[]) ?? []);
      const entries = (uRes.data as Array<{ duration_min: number | null; hourly_rate: number | null }>) ?? [];
      setUnbilled({
        count: entries.length,
        total: entries.reduce((s, e) => s + ((e.duration_min ?? 0) * (e.hourly_rate ?? 0)) / 60, 0),
      });
      const run = (tRes.data as TimeEntry | null) ?? null;
      setRunning(run);
      if (run) setScreen("running");
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [profile?.id]);

  /* ---------- Mandats ---------- */

  async function createMandat(title: string, clientName: string): Promise<Mandat | null> {
    if (!profile?.id) return null;
    const { data, error } = await supabase
      .from("mandats")
      .insert({ profile_id: profile.id, title, client_name: clientName || null })
      .select()
      .single();
    if (error || !data) { showToast("Création impossible — réessayez"); return null; }
    const m = data as Mandat;
    setMandats((prev) => [m, ...prev]);
    return m;
  }

  /* ---------- Chrono ---------- */

  async function startChrono(m: Mandat) {
    if (!profile?.id || running) return;
    const rate = m.hourly_rate ?? profile.pricing_tarif ?? null;
    const { data, error } = await supabase
      .from("time_entries")
      .insert({ profile_id: profile.id, mandat_id: m.id, started_at: new Date().toISOString(), hourly_rate: rate })
      .select()
      .single();
    if (error || !data) { showToast("Démarrage impossible — réessayez"); return; }
    setRunning(data as TimeEntry);
    setCaptureCount(0);
    setPicker(null);
    setScreen("running");
  }

  function stopChrono() {
    if (!running) return;
    setStopMin(Math.max(1, Math.round(elapsedMs / 60000)));
    setStopNote("");
    setScreen("stopped");
  }

  async function confirmStop() {
    if (!running) return;
    setBusy(true);
    const { error } = await supabase
      .from("time_entries")
      .update({ ended_at: new Date().toISOString(), duration_min: stopMin, note: stopNote.trim() || null })
      .eq("id", running.id);
    setBusy(false);
    if (error) { showToast("Enregistrement impossible — réessayez"); return; }
    const rate = running.hourly_rate ?? 0;
    setUnbilled((u) => ({ count: u.count + 1, total: u.total + (stopMin * rate) / 60 }));
    setRunning(null);
    setScreen("idle");
    showToast("✅ Temps enregistré");
  }

  async function addManualTime(m: Mandat, minutes: number) {
    if (!profile?.id || minutes <= 0) return;
    const rate = m.hourly_rate ?? profile.pricing_tarif ?? null;
    const end = Date.now();
    const { error } = await supabase.from("time_entries").insert({
      profile_id: profile.id,
      mandat_id: m.id,
      started_at: new Date(end - minutes * 60000).toISOString(),
      ended_at: new Date(end).toISOString(),
      duration_min: minutes,
      hourly_rate: rate,
    });
    if (error) { showToast("Ajout impossible — réessayez"); return; }
    setUnbilled((u) => ({ count: u.count + 1, total: u.total + (minutes * (rate ?? 0)) / 60 }));
    setManualFor(null);
    showToast(`✅ ${fmtDur(minutes)} ajouté à ${m.client_name ?? m.title}`);
  }

  /* ---------- Captures ---------- */

  // Chrono actif → rattachée au mandat en cours et triée d'office ; sinon inbox.
  function attachFields(): { mandat_id: string | null; triaged_at: string | null } {
    if (running?.mandat_id) return { mandat_id: running.mandat_id, triaged_at: new Date().toISOString() };
    return { mandat_id: null, triaged_at: null };
  }

  async function insertCapture(fields: Partial<CaptureItem>): Promise<CaptureItem | null> {
    if (!profile?.id) return null;
    const attach = attachFields();
    const { data, error } = await supabase
      .from("captures")
      .insert({ profile_id: profile.id, ...attach, ...fields })
      .select()
      .single();
    if (error || !data) { showToast("Capture perdue — réessayez"); return null; }
    if (attach.mandat_id) {
      setCaptureCount((c) => c + 1);
      showToast(`📎 Rattaché à ${activeMandat?.client_name ?? activeMandat?.title ?? preset.mandatLabel}`);
    } else {
      setInbox((prev) => [data as CaptureItem, ...prev]);
      showToast("📥 Dans l'inbox — à trier plus tard");
    }
    return data as CaptureItem;
  }

  // Transcription asynchrone (fire-and-forget) : l'UI n'attend jamais. Si la
  // capture est encore dans l'inbox quand le texte revient, on l'affiche.
  function transcribeInBackground(c: CaptureItem) {
    if (!c.storage_path) return;
    transcribeNote(c.storage_path, c.id)
      .then((transcript) => {
        if (!transcript) return;
        setInbox((prev) => prev.map((i) => (i.id === c.id ? { ...i, transcript } : i)));
      })
      .catch(() => { /* silencieux : l'audio brut reste réécoutable */ });
  }

  async function capturePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !profile?.user_id) return;
    if (!file.type.startsWith("image/")) { showToast("Choisissez une image (JPG, PNG…)."); return; }
    setBusy(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${profile.user_id}/captures/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from("nova-docs").upload(path, file, { upsert: true });
    if (error) { setBusy(false); showToast("Envoi impossible — réessayez"); return; }
    await insertCapture({ kind: "photo", storage_path: path, meta: { mime: file.type, size: file.size } });
    setBusy(false);
  }

  async function toggleVoice() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    if (!profile?.user_id) return;
    if (!navigator.mediaDevices?.getUserMedia) { showToast("Micro indisponible sur cet appareil"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      const chunks: Blob[] = [];
      rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunks.push(ev.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunks, { type: mime });
        if (blob.size === 0) { showToast("Enregistrement vide"); return; }
        setBusy(true);
        const ext = mime === "audio/webm" ? "webm" : "m4a";
        const path = `${profile.user_id}/captures/${Date.now()}-note.${ext}`;
        const { error } = await supabase.storage.from("nova-docs").upload(path, blob, { upsert: true, contentType: mime });
        if (error) { setBusy(false); showToast("Envoi impossible — réessayez"); return; }
        const durationS = Math.round((Date.now() - recordStartRef.current) / 1000);
        const created = await insertCapture({ kind: "voice", storage_path: path, meta: { mime, duration_s: durationS } });
        setBusy(false);
        if (created) transcribeInBackground(created);
      };
      recorderRef.current = rec;
      recordStartRef.current = Date.now();
      rec.start();
      setRecording(true);
    } catch {
      showToast("Accès micro refusé");
    }
  }

  async function captureNote(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setNoteSheet(false);
    await insertCapture({ kind: "note", note: trimmed });
  }

  function onCaptureAction(action: CaptureAction) {
    if (action === "photo") photoInputRef.current?.click();
    else if (action === "voice") void toggleVoice();
    else setNoteSheet(true);
  }

  /* ---------- Inbox : tri ---------- */

  async function triage(c: CaptureItem, mandatId: string | null) {
    const { error } = await supabase
      .from("captures")
      .update({ mandat_id: mandatId, triaged_at: new Date().toISOString() })
      .eq("id", c.id);
    if (error) { showToast("Tri impossible — réessayez"); return; }
    setInbox((prev) => prev.filter((i) => i.id !== c.id));
    setPicker(null);
    if (mandatId) {
      const m = mandats.find((x) => x.id === mandatId);
      showToast(`📎 Rattaché à ${m?.client_name ?? m?.title ?? preset.mandatLabel}`);
    } else {
      showToast("Archivé");
    }
  }

  // Photo-ticket → dépense : réutilise l'OCR existant (ocr-receipt) puis crée une
  // ligne de compta préremplie, avec la photo comme justificatif. Pose le lien
  // compta_entry_id + triaged_at sur la capture.
  async function convertToExpense(c: CaptureItem) {
    if (!profile?.id || c.kind !== "photo" || !c.storage_path) return;
    setBusy(true);
    showToast("Lecture de la quittance…");
    try {
      const r = await ocrReceipt(c.storage_path);
      const { data: entry, error: entryErr } = await supabase
        .from("compta_entries")
        .insert({
          profile_id: profile.id,
          date: r.date ?? new Date().toISOString().slice(0, 10),
          description: r.fournisseur ?? "Dépense terrain",
          amount: r.montant_ttc ?? 0,
          type: "depense",
          tva: r.tva_taux ?? null,
          fournisseur: r.fournisseur ?? null,
          category: r.categorie ?? null,
          receipt_url: c.storage_path,
        })
        .select()
        .single();
      if (entryErr || !entry) throw new Error(entryErr?.message ?? "insert");
      const { error: capErr } = await supabase
        .from("captures")
        .update({ compta_entry_id: entry.id, triaged_at: new Date().toISOString() })
        .eq("id", c.id);
      if (capErr) throw new Error(capErr.message);
      setInbox((prev) => prev.filter((i) => i.id !== c.id));
      showToast(`💰 Dépense créée${r.montant_ttc != null ? ` · CHF ${chf(r.montant_ttc)}` : ""} — à vérifier dans Compta`);
    } catch {
      showToast("Lecture impossible — rattachez ou saisissez dans Compta");
    }
    setBusy(false);
  }

  /* ---------- Rendu ---------- */

  if (loading) {
    return <div style={{ padding: "var(--space-8)", color: "var(--color-text-muted)", fontFamily: "var(--font-body)" }}>Chargement…</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: "var(--space-12)" }}>
      <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: "var(--space-6)", position: "relative" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", color: "var(--color-text-primary)", margin: 0 }}>
            Terrain
          </h1>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>
            {preset.terrainHint}
          </p>
        </div>

        {screen === "running" && running && (
          <RunningCard
            title={activeMandat ? `${activeMandat.client_name ?? ""} ${activeMandat.client_name ? "· " : ""}${activeMandat.title}` : "Mandat en cours"}
            rate={running.hourly_rate}
            clock={fmtClock(elapsedMs)}
            captureCount={captureCount}
            onStop={stopChrono}
          />
        )}

        {screen === "stopped" && running && (
          <StopCard
            label={activeMandat ? `${activeMandat.client_name ?? activeMandat.title}` : preset.mandatLabel}
            minutes={stopMin}
            rate={running.hourly_rate}
            note={stopNote}
            setNote={setStopNote}
            captureCount={captureCount}
            busy={busy}
            onAdjust={(d) => setStopMin((v) => Math.max(1, v + d))}
            onConfirm={() => void confirmStop()}
          />
        )}

        {screen === "idle" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-5)", padding: "var(--space-6) 0" }}>
            <button onClick={() => setPicker("start")} style={startBtn}>
              <span style={{ fontSize: 40 }}>⏱</span>
              Démarrer
            </button>
            <button style={ghostLink} onClick={() => setPicker("manual")}>
              + Ajouter du temps manuellement
            </button>
          </div>
        )}

        {/* Boutons de capture — ordre piloté par le profil métier (preset) */}
        {screen !== "stopped" && (
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            {preset.captureActions.map((a) => (
              <button key={a} onClick={() => onCaptureAction(a)} disabled={busy} style={{ ...captureBtn, ...(a === "voice" && recording ? recordingStyle : null) }}>
                <span style={{ fontSize: 26 }}>{a === "voice" && recording ? "⏹" : CAPTURE_DEFS[a].icon}</span>
                <span style={{ fontSize: "var(--text-xs)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--color-text-secondary)" }}>
                  {a === "voice" && recording ? "Stop" : CAPTURE_DEFS[a].label}
                </span>
              </button>
            ))}
          </div>
        )}

        <input ref={photoInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => void capturePhoto(e)} />

        {screen === "idle" && (
          <MiniRow icon="💰" label="À facturer" value={`${unbilled.count} ligne${unbilled.count > 1 ? "s" : ""} · CHF ${chf(unbilled.total)}`} highlight={unbilled.count > 0} />
        )}

        {/* Inbox « à trier » */}
        {inbox.length > 0 && (
          <InboxSection
            items={inbox}
            mandatLabel={preset.mandatLabel}
            busy={busy}
            onAttach={(c) => setPicker({ attach: c })}
            onArchive={(c) => void triage(c, null)}
            onExpense={(c) => void convertToExpense(c)}
          />
        )}

        {/* Bottom sheets */}
        {picker === "start" && (
          <MandatPicker
            title={`Démarrer sur quel ${preset.mandatLabel} ?`}
            mandats={mandats}
            mandatLabel={preset.mandatLabel}
            onPick={(m) => void startChrono(m)}
            onCreate={async (t, c) => { const m = await createMandat(t, c); if (m) void startChrono(m); }}
            onClose={() => setPicker(null)}
          />
        )}
        {picker === "manual" && !manualFor && (
          <MandatPicker
            title={`Du temps sur quel ${preset.mandatLabel} ?`}
            mandats={mandats}
            mandatLabel={preset.mandatLabel}
            onPick={(m) => { setManualFor(m); setPicker(null); }}
            onCreate={async (t, c) => { const m = await createMandat(t, c); if (m) { setManualFor(m); setPicker(null); } }}
            onClose={() => setPicker(null)}
          />
        )}
        {typeof picker === "object" && picker !== null && "attach" in picker && (
          <MandatPicker
            title={`Rattacher à quel ${preset.mandatLabel} ?`}
            mandats={mandats}
            mandatLabel={preset.mandatLabel}
            onPick={(m) => void triage(picker.attach, m.id)}
            onCreate={async (t, c) => { const m = await createMandat(t, c); if (m) void triage(picker.attach, m.id); }}
            onClose={() => setPicker(null)}
          />
        )}
        {manualFor && (
          <ManualTimeSheet
            mandat={manualFor}
            onConfirm={(min) => void addManualTime(manualFor, min)}
            onClose={() => setManualFor(null)}
          />
        )}
        {noteSheet && <NoteSheet onSave={(t) => void captureNote(t)} onClose={() => setNoteSheet(false)} />}

        {toast && (
          <div style={toastStyle}>{toast}</div>
        )}
      </div>
    </div>
  );
}

/* ---------- Chrono en cours ---------- */

function RunningCard({ title, rate, clock, captureCount, onStop }: {
  title: string; rate: number | null; clock: string; captureCount: number; onStop: () => void;
}) {
  return (
    <div style={{ ...card, textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", color: "var(--color-text-primary)" }}>{title}</div>
      {rate != null && (
        <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>CHF {rate}/h</div>
      )}
      <div style={{ padding: "var(--space-6) 0" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 52, color: "var(--color-gold)", position: "relative" }}>
          <span style={{ position: "absolute", top: -4, left: -16, fontSize: 13, color: "var(--color-success)" }}>●</span>
          {clock}
        </span>
      </div>
      {captureCount > 0 && (
        <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", marginBottom: "var(--space-4)" }}>
          📎 {captureCount} capture{captureCount > 1 ? "s" : ""} rattachée{captureCount > 1 ? "s" : ""}
        </div>
      )}
      <button onClick={onStop} style={{ ...bigBtn, borderColor: "var(--color-danger)", color: "var(--color-danger)" }}>
        ⏹ Arrêter
      </button>
    </div>
  );
}

/* ---------- STOP / capture de valeur ---------- */

function StopCard({ label, minutes, rate, note, setNote, captureCount, busy, onAdjust, onConfirm }: {
  label: string; minutes: number; rate: number | null; note: string; setNote: (v: string) => void;
  captureCount: number; busy: boolean; onAdjust: (deltaMin: number) => void; onConfirm: () => void;
}) {
  return (
    <div style={card}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 30 }}>✅</div>
        <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", color: "var(--color-success)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", marginTop: "var(--space-2)" }}>
          {fmtDur(minutes)} · {label}
        </div>
      </div>
      <div style={{ margin: "var(--space-5) 0", padding: "var(--space-5)", background: "var(--color-bg-surface)", border: "1px solid var(--color-gold-border)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
        {rate != null ? (
          <>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
              {fmtDur(minutes)} × CHF {rate}/h
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", color: "var(--color-gold)", marginTop: "var(--space-1)" }}>
              CHF {chf((rate * minutes) / 60)}
            </div>
          </>
        ) : (
          <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", color: "var(--color-gold)" }}>{fmtDur(minutes)}</div>
        )}
        <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
          <button style={adjustBtn} onClick={() => onAdjust(-15)}>−15 min</button>
          <button style={adjustBtn} onClick={() => onAdjust(15)}>+15 min</button>
        </div>
      </div>
      {captureCount > 0 && (
        <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", textAlign: "center", marginBottom: "var(--space-3)" }}>
          📎 {captureCount} capture{captureCount > 1 ? "s" : ""} rattachée{captureCount > 1 ? "s" : ""}
        </div>
      )}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Qu'as-tu fait ? (facultatif — tu peux remplir au bureau)"
        rows={2}
        style={textareaStyle}
      />
      <button onClick={onConfirm} disabled={busy} style={{ ...bigBtn, background: "var(--color-gold-glow)", marginTop: "var(--space-4)" }}>
        {busy ? "Enregistrement…" : "→ Ajouter à « à facturer »"}
      </button>
    </div>
  );
}

/* ---------- Inbox « à trier » ---------- */

function InboxSection({ items, mandatLabel, busy, onAttach, onArchive, onExpense }: {
  items: CaptureItem[]; mandatLabel: string; busy: boolean;
  onAttach: (c: CaptureItem) => void; onArchive: (c: CaptureItem) => void; onExpense: (c: CaptureItem) => void;
}) {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [playing, setPlaying] = useState<Record<string, string>>({});

  useEffect(() => {
    items
      .filter((c) => c.kind === "photo" && c.storage_path && !thumbs[c.id])
      .forEach(async (c) => {
        const url = await signedUrl(c.storage_path!);
        if (url) setThumbs((prev) => ({ ...prev, [c.id]: url }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  async function playVoice(c: CaptureItem) {
    if (!c.storage_path) return;
    const url = playing[c.id] ?? (await signedUrl(c.storage_path));
    if (url) setPlaying((prev) => ({ ...prev, [c.id]: url }));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <span style={sublabel}>📥 À trier ({items.length})</span>
      {items.map((c) => (
        <div key={c.id} style={{ ...card, padding: "var(--space-3) var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            {c.kind === "photo" && (
              thumbs[c.id]
                ? <img src={thumbs[c.id]} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: "var(--radius-sm)", flexShrink: 0 }} />
                : <span style={{ fontSize: 22 }}>📷</span>
            )}
            {c.kind === "voice" && <span style={{ fontSize: 22 }}>🎤</span>}
            {c.kind === "note" && <span style={{ fontSize: 22 }}>📝</span>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.note ?? c.transcript ?? (c.kind === "photo" ? "Photo" : c.kind === "voice" ? "Note vocale" : "Note")}
              </div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                {new Date(c.captured_at).toLocaleString("fr-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
          {c.kind === "voice" && playing[c.id] && (
            <audio controls src={playing[c.id]} style={{ width: "100%", height: 32 }} />
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
            <button style={smallBtn} onClick={() => onAttach(c)}>📎 Rattacher à un {mandatLabel}</button>
            {c.kind === "photo" && (
              <button style={smallBtnGhost} disabled={busy} onClick={() => onExpense(c)}>💰 En dépense</button>
            )}
            {c.kind === "voice" && !playing[c.id] && (
              <button style={smallBtnGhost} onClick={() => void playVoice(c)}>▶ Écouter</button>
            )}
            <button style={smallBtnGhost} onClick={() => onArchive(c)}>Archiver</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Bottom sheets ---------- */

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 60, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--color-bg-elevated)", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTop: "1px solid var(--color-gold-border)", padding: "var(--space-6)", paddingBottom: "calc(var(--space-6) + env(safe-area-inset-bottom, 0px))", display: "flex", flexDirection: "column", gap: "var(--space-4)", maxHeight: "75vh", overflowY: "auto" }}
      >
        <div style={{ width: 40, height: 4, background: "var(--color-text-muted)", borderRadius: 2, alignSelf: "center", flexShrink: 0 }} />
        {children}
      </div>
    </div>
  );
}

function MandatPicker({ title, mandats, mandatLabel, onPick, onCreate, onClose }: {
  title: string;
  mandats: Mandat[];
  mandatLabel: string;
  onPick: (m: Mandat) => void;
  onCreate: (title: string, clientName: string) => void;
  onClose: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newClient, setNewClient] = useState("");

  return (
    <Sheet onClose={onClose}>
      <span style={sublabel}>{title}</span>
      {!creating && mandats.map((m) => (
        <button key={m.id} onClick={() => onPick(m)} style={mandatRow}>
          <span style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-md)", color: "var(--color-text-primary)" }}>{m.client_name ?? m.title}</span>
            {m.client_name && <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>{m.title}</span>}
          </span>
          {m.hourly_rate != null && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "var(--color-gold)" }}>{m.hourly_rate}.-/h</span>
          )}
        </button>
      ))}
      {!creating ? (
        <button style={ghostLink} onClick={() => setCreating(true)}>➕ Nouveau {mandatLabel}</button>
      ) : (
        <>
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={`Titre du ${mandatLabel} (ex. Fuite cuisine)`}
            style={inputStyle}
          />
          <input
            value={newClient}
            onChange={(e) => setNewClient(e.target.value)}
            placeholder="Client (facultatif)"
            style={inputStyle}
          />
          <button
            style={{ ...bigBtn, opacity: newTitle.trim() ? 1 : 0.5 }}
            disabled={!newTitle.trim()}
            onClick={() => onCreate(newTitle.trim(), newClient.trim())}
          >
            Créer et continuer
          </button>
        </>
      )}
    </Sheet>
  );
}

function ManualTimeSheet({ mandat, onConfirm, onClose }: { mandat: Mandat; onConfirm: (minutes: number) => void; onClose: () => void }) {
  const [minutes, setMinutes] = useState(60);
  return (
    <Sheet onClose={onClose}>
      <span style={sublabel}>Temps passé sur {mandat.client_name ?? mandat.title}</span>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-4)" }}>
        <button style={adjustBtn} onClick={() => setMinutes((m) => Math.max(15, m - 15))}>−15</button>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-2xl)", color: "var(--color-gold)", minWidth: 110, textAlign: "center" }}>{fmtDur(minutes)}</span>
        <button style={adjustBtn} onClick={() => setMinutes((m) => m + 15)}>+15</button>
      </div>
      <button style={{ ...bigBtn, background: "var(--color-gold-glow)" }} onClick={() => onConfirm(minutes)}>
        Enregistrer
      </button>
    </Sheet>
  );
}

function NoteSheet({ onSave, onClose }: { onSave: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState("");
  return (
    <Sheet onClose={onClose}>
      <span style={sublabel}>Note rapide</span>
      <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Tape ta note…" style={textareaStyle} />
      <button style={{ ...bigBtn, background: "var(--color-gold-glow)", opacity: text.trim() ? 1 : 0.5 }} disabled={!text.trim()} onClick={() => onSave(text)}>
        Enregistrer
      </button>
    </Sheet>
  );
}

/* ---------- Primitives ---------- */

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

const card: React.CSSProperties = {
  padding: "var(--space-5)",
  background: "var(--color-bg-primary)",
  border: "1px solid var(--color-gold-border)",
  borderRadius: "var(--radius-md)",
};

const startBtn: React.CSSProperties = {
  width: 200,
  height: 200,
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
};

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

const recordingStyle: React.CSSProperties = {
  border: "1px solid var(--color-danger)",
  boxShadow: "0 0 20px rgba(255,80,80,0.25)",
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
};

const mandatRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  width: "100%",
  padding: "var(--space-4)",
  background: "var(--color-bg-surface)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "var(--radius-md)",
  cursor: "pointer",
};

const smallBtn: React.CSSProperties = {
  padding: "var(--space-2) var(--space-3)",
  background: "var(--color-gold-glow)",
  border: "1px solid var(--color-gold-border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-gold)",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-xs)",
  cursor: "pointer",
};

const smallBtnGhost: React.CSSProperties = {
  padding: "var(--space-2) var(--space-3)",
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text-secondary)",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-xs)",
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--color-bg-input)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text-primary)",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  padding: "var(--space-3)",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--color-bg-input)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text-primary)",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  padding: "var(--space-3)",
  resize: "none",
};

const toastStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 90,
  left: "50%",
  transform: "translateX(-50%)",
  background: "var(--color-bg-elevated)",
  border: "1px solid var(--color-gold-border)",
  color: "var(--color-text-primary)",
  fontSize: "var(--text-sm)",
  fontFamily: "var(--font-body)",
  padding: "var(--space-3) var(--space-5)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-lg)",
  zIndex: 70,
  whiteSpace: "nowrap",
};
