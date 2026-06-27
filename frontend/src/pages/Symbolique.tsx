import { useEffect, useRef, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useUserStore } from "@/stores/useUserStore";
import { useAiGen, MODEL_REASONING } from "@/lib/useAiGen";
import {
  SYM_QUESTIONS,
  promptSymbolicIntake,
  promptSymbolicMap,
  promptSymbolicCoach,
  promptSymbolicActions,
  promptSymbolicChat,
} from "@/lib/lancementPrompts";
import { loadLocal, saveLocal, parseLooseJson } from "@/lib/local";

// ── Types ────────────────────────────────────────────────────────────────────
interface SymNode { id: string; label: string; icon: string; kind: string; note: string; x: number | null; y: number | null }
interface SymLink { from: string; to: string; relation: string }
interface SymIntake { answers: string[]; metaphore: string; plan: string[] }
interface SymAction { titre: string; echeance: string; mesure: string }
interface SymMap { nodes: SymNode[]; links: SymLink[]; lecture: string; questions: string[]; actions: SymAction[]; intake: SymIntake | null }
interface ChatMsg { role: "nova" | "user"; text: string; meta?: string }

// ── Taxonomie des symboles (reprise v1) ──────────────────────────────────────
const SYM_KINDS: Record<string, { name: string; color: string; ico: string }> = {
  vision: { name: "Vision", color: "#a78bfa", ico: "🌱" },
  offre: { name: "Offre", color: "#22d3ee", ico: "🎯" },
  client: { name: "Client", color: "#34d399", ico: "🧑" },
  partenaire: { name: "Partenaire", color: "#2dd4bf", ico: "🤝" },
  concurrent: { name: "Concurrent", color: "#94a3b8", ico: "♟️" },
  ressource: { name: "Ressource", color: "#fbbf24", ico: "🛠️" },
  obstacle: { name: "Obstacle", color: "#f87171", ico: "⛰️" },
  croyance: { name: "Frein", color: "#f472b6", ico: "⛓️" },
  levier: { name: "Levier", color: "#60a5fa", ico: "⚡" },
  action: { name: "Action", color: "#818cf8", ico: "✅" },
};
const KIND_ORDER = ["vision", "offre", "client", "partenaire", "concurrent", "ressource", "obstacle", "croyance", "levier", "action"];
const KIND_OF = (k: string) => SYM_KINDS[k] ?? { name: "Symbole", color: "var(--color-gold)", ico: "✦" };

const EMPTY_MAP: SymMap = { nodes: [], links: [], lecture: "", questions: [], actions: [], intake: null };
const BOARD_H = 460;

function genId() { return "s" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); }

// Place en cercle les nœuds sans position.
function circleLayout(nodes: SymNode[], w: number, h: number) {
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.34;
  nodes.forEach((n, i) => {
    if (n.x == null || n.y == null) {
      const a = -Math.PI / 2 + (i / Math.max(1, nodes.length)) * Math.PI * 2;
      n.x = Math.round(cx + r * Math.cos(a));
      n.y = Math.round(cy + r * Math.sin(a));
    }
  });
}

// Normalise la sortie IA : ids générés, liens résolus par label, kinds validés.
function normalizeMap(d: { nodes?: unknown; links?: unknown }, w: number): { nodes: SymNode[]; links: SymLink[] } {
  const labelToId: Record<string, string> = {};
  const nodes: SymNode[] = (Array.isArray(d.nodes) ? d.nodes : []).slice(0, 10).map((raw) => {
    const n = raw as Partial<SymNode>;
    const id = genId();
    labelToId[String(n.label ?? "").trim().toLowerCase()] = id;
    const kind = n.kind && SYM_KINDS[n.kind] ? n.kind : "vision";
    return { id, label: n.label || "Symbole", icon: n.icon || KIND_OF(kind).ico, kind, note: n.note || "", x: null, y: null };
  });
  const links: SymLink[] = (Array.isArray(d.links) ? d.links : []).map((raw) => {
    const l = raw as Partial<SymLink>;
    const f = labelToId[String(l.from ?? "").trim().toLowerCase()];
    const t = labelToId[String(l.to ?? "").trim().toLowerCase()];
    return f && t && f !== t ? { from: f, to: t, relation: l.relation || "" } : null;
  }).filter(Boolean) as SymLink[];
  circleLayout(nodes, w, BOARD_H);
  return { nodes, links };
}

// Contexte texte de la carte pour les prompts coach / actions / chat.
function mapContextText(map: SymMap): string {
  if (!map.nodes.length) return "(pas encore de carte symbolique — on part de ta phrase)";
  const byId = (id: string) => map.nodes.find((n) => n.id === id);
  const nodes = map.nodes.map((n) => `${KIND_OF(n.kind).name} « ${n.label} »${n.note ? ` — ${n.note}` : ""}`).join(" · ");
  const rel = map.links.map((l) => { const a = byId(l.from), b = byId(l.to); return a && b ? `${a.label} →${l.relation || ""}→ ${b.label}` : ""; }).filter(Boolean).join(" ; ");
  return "SYMBOLES : " + nodes + (rel ? "\nRELATIONS : " + rel : "");
}

// ── Styles partagés ──────────────────────────────────────────────────────────
const STEP: React.CSSProperties = {
  fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", background: "var(--color-bg-input)",
  border: "var(--border-subtle)", borderRadius: "var(--radius-xs)", padding: "var(--space-1) var(--space-3)",
};
const FIELD: React.CSSProperties = {
  width: "100%", marginTop: "var(--space-2)", background: "var(--color-bg-input)", border: "var(--border-subtle)",
  borderRadius: "var(--radius-sm)", color: "var(--color-text-primary)", fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)", padding: "var(--space-2) var(--space-3)", outline: "none", boxSizing: "border-box",
};
const LBL: React.CSSProperties = { fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "var(--tracking-wider)" };

interface EditState { id: string | null; label: string; icon: string; kind: string; note: string; linkTo: string; relation: string }
const BLANK_EDIT: EditState = { id: null, label: "", icon: "", kind: "offre", note: "", linkTo: "", relation: "" };

export function Symbolique() {
  const profile = useUserStore((s) => s.profile);
  const { gen } = useAiGen();
  const boardRef = useRef<HTMLDivElement>(null);

  const [map, setMap] = useState<SymMap>(() => loadLocal<SymMap>("ns_sym_map", EMPTY_MAP));
  const [messages, setMessages] = useState<ChatMsg[]>(() => loadLocal<ChatMsg[]>("ns_sym_chat", [
    { role: "nova", meta: "Vision symbolique · Question 1/3", text: SYM_QUESTIONS[0] },
  ]));
  const [step, setStep] = useState<number>(() => loadLocal<number>("ns_sym_step", 0));
  const [answers, setAnswers] = useState<string[]>(() => loadLocal<string[]>("ns_sym_answers", []));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<"" | "map" | "coach" | "actions" | "chat">("");
  const [edit, setEdit] = useState<EditState | null>(null);
  const dragRef = useRef<{ id: string } | null>(null);
  const chatBottom = useRef<HTMLDivElement>(null);

  const persistMap = useCallback((m: SymMap) => { setMap(m); saveLocal("ns_sym_map", m); }, []);
  const pushMsg = useCallback((m: ChatMsg) => {
    setMessages((prev) => { const next = [...prev, m]; saveLocal("ns_sym_chat", next); return next; });
  }, []);

  useEffect(() => { chatBottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const boardW = () => boardRef.current?.clientWidth ?? 680;

  // ── Drag des symboles (pointer events + fenêtre) ────────────────────────────
  const onMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current; const board = boardRef.current; if (!d || !board) return;
    const rect = board.getBoundingClientRect();
    const x = Math.max(44, Math.min(rect.width - 44, e.clientX - rect.left));
    const y = Math.max(36, Math.min(rect.height - 36, e.clientY - rect.top));
    setMap((m) => ({ ...m, nodes: m.nodes.map((n) => (n.id === d.id ? { ...n, x: Math.round(x), y: Math.round(y) } : n)) }));
  }, []);
  const onUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    setMap((m) => { saveLocal("ns_sym_map", m); return m; });
  }, [onMove]);
  function startDrag(e: React.PointerEvent, id: string) {
    e.preventDefault();
    dragRef.current = { id };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
  useEffect(() => () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); }, [onMove, onUp]);

  // ── Génération du tableau symbolique ────────────────────────────────────────
  async function generateMap(intake: SymIntake | null) {
    setBusy("map");
    const r = await gen("nova", promptSymbolicMap(profile, intake), { model: MODEL_REASONING });
    if (r) {
      const parsed = parseLooseJson<{ nodes?: unknown; links?: unknown; lecture?: string; questions?: string[] }>(r);
      if (parsed) {
        const { nodes, links } = normalizeMap(parsed, boardW());
        persistMap({ ...map, nodes, links, lecture: parsed.lecture ?? "", questions: Array.isArray(parsed.questions) ? parsed.questions : [], actions: [], intake });
      }
    }
    setBusy("");
  }

  // ── Chat guidé (intake 3 questions puis coaching libre) ─────────────────────
  async function send() {
    const txt = input.trim(); if (!txt || busy) return;
    setInput("");
    pushMsg({ role: "user", text: txt });
    const boardEmpty = map.nodes.length === 0;

    if (boardEmpty && step < 3) {
      const ans = answers.slice(); ans[step] = txt; setAnswers(ans); saveLocal("ns_sym_answers", ans);
      const next = step + 1; setStep(next); saveLocal("ns_sym_step", next);
      if (next < 3) {
        pushMsg({ role: "nova", meta: `Vision symbolique · Question ${next + 1}/3`, text: SYM_QUESTIONS[next] });
      } else {
        pushMsg({ role: "nova", text: "✦ Merci. Je compose ta vision symbolique…" });
        setBusy("chat");
        const raw1 = await gen("nova", promptSymbolicIntake(ans), { model: MODEL_REASONING });
        const ik = parseLooseJson<{ metaphore?: string; plan?: string[] }>(raw1 ?? "") ?? {};
        const intake: SymIntake = { answers: ans, metaphore: ik.metaphore ?? (raw1 ?? ""), plan: Array.isArray(ik.plan) ? ik.plan : [] };
        persistMap({ ...map, intake });
        pushMsg({ role: "nova", text: "Ta métaphore est prête — elle apparaît au-dessus. Je génère maintenant ton tableau symbolique…" });
        setBusy("");
        await generateMap(intake);
      }
      return;
    }

    setBusy("chat");
    const r = await gen("nova", promptSymbolicChat(profile, profile?.name ?? "", mapContextText(map), txt));
    pushMsg({ role: "nova", text: r ?? "Désolé, je ne peux pas répondre là, tout de suite. Réessaie dans un moment." });
    setBusy("");
  }

  async function coach() {
    if (!map.nodes.length) return;
    setBusy("coach");
    const r = await gen("nova", promptSymbolicCoach(profile, mapContextText(map)), { model: MODEL_REASONING });
    const data = parseLooseJson<{ lecture?: string; questions?: string[] }>(r ?? "");
    if (data) persistMap({ ...map, lecture: data.lecture ?? map.lecture, questions: Array.isArray(data.questions) ? data.questions : map.questions });
    setBusy("");
  }

  async function toActions() {
    if (!map.nodes.length) return;
    setBusy("actions");
    const r = await gen("nova", promptSymbolicActions(profile, mapContextText(map), map.lecture), { model: MODEL_REASONING });
    const data = parseLooseJson<{ actions?: SymAction[] }>(r ?? "");
    if (data && Array.isArray(data.actions)) persistMap({ ...map, actions: data.actions });
    setBusy("");
  }

  function resetIntake() {
    persistMap(EMPTY_MAP);
    setStep(0); saveLocal("ns_sym_step", 0);
    setAnswers([]); saveLocal("ns_sym_answers", []);
    const seed: ChatMsg[] = [{ role: "nova", meta: "Vision symbolique · Question 1/3", text: SYM_QUESTIONS[0] }];
    setMessages(seed); saveLocal("ns_sym_chat", seed);
  }

  // ── Édition d'un symbole (modal) ────────────────────────────────────────────
  function openEdit(id: string | null) {
    const n = id ? map.nodes.find((x) => x.id === id) : null;
    setEdit(n ? { id: n.id, label: n.label, icon: n.icon, kind: n.kind, note: n.note, linkTo: "", relation: "" } : { ...BLANK_EDIT });
  }
  function saveEdit() {
    if (!edit || !edit.label.trim()) return;
    let nodes = map.nodes.slice();
    let id = edit.id;
    if (id) {
      nodes = nodes.map((n) => (n.id === id ? { ...n, label: edit.label.trim(), kind: edit.kind, icon: edit.icon.trim(), note: edit.note.trim() } : n));
    } else {
      id = genId();
      nodes.push({ id, label: edit.label.trim(), kind: edit.kind, icon: edit.icon.trim() || KIND_OF(edit.kind).ico, note: edit.note.trim(), x: null, y: null });
      circleLayout(nodes, boardW(), BOARD_H);
    }
    const links = edit.linkTo ? [...map.links, { from: id, to: edit.linkTo, relation: edit.relation.trim() }] : map.links;
    persistMap({ ...map, nodes, links });
    setEdit(null);
  }
  function deleteNode() {
    if (!edit?.id) return;
    const id = edit.id;
    persistMap({ ...map, nodes: map.nodes.filter((n) => n.id !== id), links: map.links.filter((l) => l.from !== id && l.to !== id) });
    setEdit(null);
  }

  const w = boardW();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: 960 }}>
      <PageHeader title="Vision symbolique" subtitle="Coaching systémique : de l'idée floue à une structure lisible. Le symbole éclaire — il ne prouve rien." />

      {/* Méthode 5 temps */}
      <Card glass>
        <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 var(--space-3)" }}>La méthode, en 5 temps</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          {["1 · Représenter l'idée", "2 · Identifier les ressources", "3 · Visualiser clients & écosystème", "4 · Tester les obstacles", "5 · Traduire en actions SMART"].map((s) => (
            <span key={s} style={STEP}>{s}</span>
          ))}
        </div>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-warning)", background: "rgba(245,158,11,0.08)", borderRadius: "var(--radius-sm)", padding: "var(--space-3) var(--space-4)", marginTop: "var(--space-3)", marginBottom: 0 }}>
          ⚠️ <strong>Le piège du symbolique :</strong> une métaphore n'est pas une preuve de marché. Croise toujours avec du concret — entretiens clients, test d'offre, budget, scénarios de trésorerie.
        </p>
      </Card>

      {/* Canvas */}
      <Card glass>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
            {KIND_ORDER.map((k) => (
              <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                <i style={{ width: 8, height: 8, borderRadius: "50%", background: SYM_KINDS[k].color, display: "inline-block" }} />{SYM_KINDS[k].name}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Button size="sm" variant="gold" loading={busy === "map"} onClick={() => generateMap(map.intake)}>✦ Générer ma vision (IA)</Button>
            <Button size="sm" variant="ghost" onClick={() => openEdit(null)}>+ Symbole</Button>
          </div>
        </div>

        <div ref={boardRef} style={{ position: "relative", height: BOARD_H, background: "var(--color-bg-input)", border: "var(--border-subtle)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
          {map.nodes.length === 0 ? (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", fontSize: "var(--text-sm)", textAlign: "center", padding: "var(--space-6)" }}>
              {busy === "map" ? "✦ Ton coach compose ta vision systémique…" : "Réponds aux 3 questions dans le chat ci-dessous — ton tableau apparaîtra automatiquement."}
            </div>
          ) : (
            <>
              <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} viewBox={`0 0 ${w} ${BOARD_H}`} preserveAspectRatio="none">
                {map.links.map((l, i) => {
                  const a = map.nodes.find((n) => n.id === l.from), b = map.nodes.find((n) => n.id === l.to);
                  if (!a || !b || a.x == null || b.x == null) return null;
                  return (
                    <g key={i}>
                      <line x1={a.x} y1={a.y!} x2={b.x} y2={b.y!} stroke="rgba(197,165,114,0.45)" strokeWidth={1.5} />
                      {l.relation && <text x={(a.x + b.x!) / 2} y={(a.y! + b.y!) / 2 - 4} fontSize={9} fill="var(--color-gold)" textAnchor="middle" fontStyle="italic">{l.relation}</text>}
                    </g>
                  );
                })}
              </svg>
              {map.nodes.map((n) => {
                const k = KIND_OF(n.kind);
                return (
                  <div
                    key={n.id}
                    onPointerDown={(e) => startDrag(e, n.id)}
                    onDoubleClick={() => openEdit(n.id)}
                    style={{
                      position: "absolute", left: n.x ?? 0, top: n.y ?? 0, transform: "translate(-50%,-50%)",
                      width: 96, padding: "var(--space-2)", background: "var(--color-bg-surface)", border: `1.5px solid ${k.color}`,
                      borderRadius: "var(--radius-sm)", textAlign: "center", cursor: "grab", touchAction: "none", userSelect: "none",
                    }}
                  >
                    <div style={{ fontSize: 18 }}>{n.icon || k.ico}</div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-primary)", fontWeight: 500, lineHeight: 1.2 }}>{n.label}</div>
                    <div style={{ fontSize: 9, color: k.color, textTransform: "uppercase", letterSpacing: "var(--tracking-wide)" }}>{k.name}</div>
                    {n.note && <div style={{ fontSize: 9, color: "var(--color-text-muted)", marginTop: 2, lineHeight: 1.2 }}>{n.note}</div>}
                  </div>
                );
              })}
            </>
          )}
        </div>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: "var(--space-2)", marginBottom: 0 }}>
          💡 Glisse un symbole pour le rapprocher/éloigner — la disposition révèle les dynamiques. Double-clique pour l'éditer, le relier ou le supprimer.
        </p>
      </Card>

      {/* Métaphore + plan */}
      {map.intake?.metaphore && (
        <Card glass title="🌟 Votre vision symbolique" action={<Button size="sm" variant="ghost" onClick={resetIntake}>↺ Recommencer</Button>}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", color: "var(--color-text-primary)", lineHeight: "var(--leading-normal)", margin: "0 0 var(--space-4)" }}>{map.intake.metaphore}</p>
          {map.intake.plan.length > 0 && (
            <>
              <p style={{ ...LBL, margin: "0 0 var(--space-2)" }}>Plan d'action concret</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {map.intake.plan.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--color-gold)", color: "#0d0d0d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>{s}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      {/* Lecture du coach */}
      {(map.lecture || map.questions.length > 0) && (
        <Card glass title="👁️ La lecture de ton coach" action={
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Button size="sm" variant="ghost" loading={busy === "coach"} onClick={coach}>↻ Nouveau feedback</Button>
            <Button size="sm" variant="gold" loading={busy === "actions"} onClick={toActions}>→ Actions SMART</Button>
          </div>
        }>
          {map.lecture && <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: "var(--leading-normal)", whiteSpace: "pre-wrap", margin: 0 }}>{map.lecture}</p>}
          {map.questions.length > 0 && (
            <div style={{ marginTop: "var(--space-3)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {map.questions.map((q, i) => (
                <div key={i} style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)" }}><span style={{ color: "var(--color-gold)", marginRight: 8 }}>?</span>{q}</div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Actions SMART */}
      {map.actions.length > 0 && (
        <Card glass title="✅ Plan d'action SMART — du symbole au réel">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            {map.actions.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start", padding: "var(--space-2) 0", borderTop: i ? "var(--border-subtle)" : "none" }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--color-gold)", color: "#0d0d0d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                <div>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text-primary)" }}>{a.titre}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>⏱ {a.echeance || "—"} &nbsp;·&nbsp; 🎯 {a.mesure || "—"}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Chat coach */}
      <Card glass title="💬 Dialogue avec ton coach systémique">
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: "0 0 var(--space-3)" }}>Une étape à la fois, une question à la fois. Direct, ancré dans le réel — pas de thérapie.</p>
        <div style={{ height: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: "var(--space-3)", padding: "var(--space-2)", background: "var(--color-bg-input)", borderRadius: "var(--radius-sm)" }}>
          {messages.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%", background: m.role === "user" ? "var(--color-gold)" : "var(--color-bg-surface)", color: m.role === "user" ? "#0d0d0d" : "var(--color-text-secondary)", border: m.role === "user" ? "none" : "var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: "var(--space-2) var(--space-3)", fontSize: "var(--text-sm)", lineHeight: "var(--leading-normal)", whiteSpace: "pre-wrap" }}>
              {m.meta && <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--color-gold)", letterSpacing: "var(--tracking-wide)", marginBottom: 4 }}>{m.meta}</span>}
              {m.text}
            </div>
          ))}
          {busy === "chat" && <div style={{ alignSelf: "flex-start", color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>✦ Ton coach réfléchit…</div>}
          <div ref={chatBottom} />
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder="Décris ton projet en une phrase…"
            style={{ ...FIELD, marginTop: 0, flex: 1 }}
          />
          <Button variant="gold" loading={busy === "chat"} onClick={send} disabled={!input.trim()}>Envoyer</Button>
        </div>
      </Card>

      {/* Modal édition symbole */}
      {edit && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setEdit(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-4)" }}>
          <div style={{ background: "var(--color-bg-surface)", border: "var(--border-subtle)", borderRadius: "var(--radius-lg)", width: "100%", maxWidth: 460, padding: "var(--space-5)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", color: "var(--color-text-primary)" }}>{edit.id ? "Modifier le symbole" : "Nouveau symbole"}</span>
              <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>✕</Button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--space-3)" }}>
              <div><label style={LBL}>Nom</label><input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} placeholder="Ex : Mon client idéal" style={FIELD} /></div>
              <div><label style={LBL}>Emoji</label><input value={edit.icon} onChange={(e) => setEdit({ ...edit, icon: e.target.value })} placeholder="🌱" style={FIELD} /></div>
            </div>
            <div style={{ marginTop: "var(--space-3)" }}>
              <label style={LBL}>Type</label>
              <select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })} style={FIELD}>
                {KIND_ORDER.map((k) => <option key={k} value={k}>{SYM_KINDS[k].ico} {SYM_KINDS[k].name}</option>)}
              </select>
            </div>
            <div style={{ marginTop: "var(--space-3)" }}><label style={LBL}>Note courte</label><input value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} placeholder="Une phrase qui précise" style={FIELD} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
              <div>
                <label style={LBL}>Relier à</label>
                <select value={edit.linkTo} onChange={(e) => setEdit({ ...edit, linkTo: e.target.value })} style={FIELD}>
                  <option value="">— aucun —</option>
                  {map.nodes.filter((n) => n.id !== edit.id).map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
                </select>
              </div>
              <div><label style={LBL}>Relation</label><input value={edit.relation} onChange={(e) => setEdit({ ...edit, relation: e.target.value })} placeholder="nourrit, bloque, sert…" style={FIELD} /></div>
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-5)" }}>
              <Button variant="gold" onClick={saveEdit} disabled={!edit.label.trim()}>Enregistrer</Button>
              {edit.id && <Button variant="danger" onClick={deleteNode}>Supprimer</Button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
