import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  getTelegramConfig,
  saveTelegramConfig,
  resetTelegramConfig,
  sendTelegram,
  type TelegramConfig,
} from "@/lib/telegram";

const SECTION_TITLE: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--text-base)",
  fontWeight: 400,
  color: "var(--color-gold)",
  margin: 0,
};

const STEP: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-text-muted)",
  lineHeight: "var(--leading-normal)",
  margin: 0,
};

export function TelegramCard() {
  const [chatId, setChatId] = useState("");
  const [botToken, setBotToken] = useState("");
  const [cfg, setCfg] = useState<TelegramConfig>({ linked: false, chat_id: null, token_last4: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function hydrate(c: TelegramConfig) {
    setCfg(c);
    setChatId(c.chat_id ?? "");
    setBotToken("");
  }

  useEffect(() => {
    getTelegramConfig()
      .then(hydrate)
      .catch(() => setMsg({ kind: "err", text: "Impossible de charger la configuration Telegram." }))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const next = await saveTelegramConfig({
        chat_id: chatId.trim() || null,
        bot_token: botToken.trim() || null,
      });
      hydrate(next);
      setMsg({ kind: "ok", text: "Configuration enregistrée." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Échec de l'enregistrement." });
    }
    setSaving(false);
  }

  async function unlink() {
    setSaving(true);
    setMsg(null);
    try {
      hydrate(await resetTelegramConfig());
      setMsg({ kind: "ok", text: "Bot Telegram délié." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Échec." });
    }
    setSaving(false);
  }

  async function test() {
    setTesting(true);
    setMsg(null);
    try {
      await sendTelegram("✅ <b>Nova Solo</b> est bien connecté à votre bot Telegram.");
      setMsg({ kind: "ok", text: "Message test envoyé — vérifiez Telegram." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Échec de l'envoi." });
    }
    setTesting(false);
  }

  // Token requis seulement si aucun n'est déjà enregistré ; chat_id toujours requis.
  const canSave = Boolean(chatId.trim()) && (Boolean(botToken.trim()) || Boolean(cfg.token_last4));

  return (
    <Card glass>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
        <p style={SECTION_TITLE}>Notifications Telegram</p>
        <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, letterSpacing: "var(--tracking-wide)", color: cfg.linked ? "var(--color-success)" : "var(--color-text-muted)", border: `1px solid ${cfg.linked ? "var(--color-success)" : "var(--border-subtle)"}`, borderRadius: "var(--radius-xs)", padding: "1px 8px" }}>
          {cfg.linked ? "Lié" : "Non lié"}
        </span>
      </div>
      <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: "0 0 var(--space-4) 0", lineHeight: "var(--leading-normal)" }}>
        Recevez vos rappels et résumés sur Telegram via <strong>votre propre bot</strong> — rien
        ne dépend de Nova Solo. Votre token est chiffré côté serveur et n'est jamais réaffiché.
      </p>

      {loading ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>Chargement…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <p style={STEP}>1. Dans Telegram, ouvrez <strong>@BotFather</strong>, envoyez <strong>/newbot</strong>, suivez les étapes et copiez le <strong>token</strong> du bot.</p>
            <p style={STEP}>2. Ouvrez votre nouveau bot et envoyez-lui <strong>/start</strong>.</p>
            <p style={STEP}>3. Écrivez à <strong>@userinfobot</strong> pour obtenir votre <strong>chat ID</strong> numérique.</p>
            <p style={STEP}>4. Collez le token et le chat ID ci-dessous, puis enregistrez.</p>
          </div>

          <Input
            label="Token du bot"
            type="password"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder={cfg.token_last4 ? `•••• ${cfg.token_last4} — laisser vide pour conserver` : "123456789:AA…"}
          />

          <Input
            label="Chat ID"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="Ex. 123456789"
          />

          {msg && (
            <p style={{ fontSize: "var(--text-sm)", margin: 0, color: msg.kind === "ok" ? "var(--color-success)" : "var(--color-danger)" }}>
              {msg.text}
            </p>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <Button variant="gold" loading={saving} disabled={!canSave} onClick={save}>
              Enregistrer
            </Button>
            <Button variant="ghost" loading={testing} disabled={!cfg.linked} onClick={test}>
              Envoyer un test
            </Button>
            {(cfg.linked || cfg.token_last4) && (
              <Button variant="ghost" onClick={unlink} disabled={saving}>
                Délier
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
