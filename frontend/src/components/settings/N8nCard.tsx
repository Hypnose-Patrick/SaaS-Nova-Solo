import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getN8nConfig, saveN8nConfig, resetN8nConfig, type N8nConfig } from "@/lib/n8n";

const SECTION_TITLE: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--text-base)",
  fontWeight: 400,
  color: "var(--color-gold)",
  margin: 0,
};

export function N8nCard() {
  const [researchUrl, setResearchUrl] = useState("");
  const [researchSecret, setResearchSecret] = useState("");
  const [sendUrl, setSendUrl] = useState("");
  const [sendSecret, setSendSecret] = useState("");
  const [cfg, setCfg] = useState<N8nConfig>({ research_url: null, research_secret_last4: null, send_url: null, send_secret_last4: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function hydrate(c: N8nConfig) {
    setCfg(c);
    setResearchUrl(c.research_url ?? "");
    setSendUrl(c.send_url ?? "");
    setResearchSecret("");
    setSendSecret("");
  }

  useEffect(() => {
    getN8nConfig()
      .then(hydrate)
      .catch(() => setMsg({ kind: "err", text: "Impossible de charger la configuration n8n." }))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const next = await saveN8nConfig({
        research_url: researchUrl.trim() || null,
        research_secret: researchSecret.trim() || null,
        send_url: sendUrl.trim() || null,
        send_secret: sendSecret.trim() || null,
      });
      hydrate(next);
      setMsg({ kind: "ok", text: "Configuration enregistrée." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Échec de l'enregistrement." });
    }
    setSaving(false);
  }

  async function reset() {
    setSaving(true);
    setMsg(null);
    try {
      hydrate(await resetN8nConfig());
      setMsg({ kind: "ok", text: "Webhooks n8n retirés." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Échec." });
    }
    setSaving(false);
  }

  const linked = Boolean(cfg.research_url || cfg.send_url);

  return (
    <Card glass>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
        <p style={SECTION_TITLE}>Webhooks n8n (prospection)</p>
        <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, letterSpacing: "var(--tracking-wide)", color: linked ? "var(--color-success)" : "var(--color-text-muted)", border: `1px solid ${linked ? "var(--color-success)" : "var(--border-subtle)"}`, borderRadius: "var(--radius-xs)", padding: "1px 8px" }}>
          {linked ? "Configuré" : "Non configuré"}
        </span>
      </div>
      <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: "0 0 var(--space-4) 0", lineHeight: "var(--leading-normal)" }}>
        Branchez <strong>vos propres workflows n8n</strong> pour la prospection : un webhook pour la
        recherche d'entreprise, un pour l'envoi automatique (mail/dossier). Optionnel — sans
        configuration, Nova Solo utilise l'IA classique et un brouillon d'e-mail. Le jeton
        d'authentification (si fourni) est chiffré côté serveur et n'est jamais réaffiché.
      </p>

      {loading ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>Chargement…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Input
            label="Webhook — recherche d'entreprise"
            value={researchUrl}
            onChange={(e) => setResearchUrl(e.target.value)}
            placeholder="https://votre-n8n.exemple.ch/webhook/recherche"
          />
          <Input
            label="Jeton d'authentification (recherche)"
            type="password"
            value={researchSecret}
            onChange={(e) => setResearchSecret(e.target.value)}
            placeholder={cfg.research_secret_last4 ? `•••• ${cfg.research_secret_last4} — laisser vide pour conserver` : "optionnel"}
          />
          <Input
            label="Webhook — envoi (mail/dossier)"
            value={sendUrl}
            onChange={(e) => setSendUrl(e.target.value)}
            placeholder="https://votre-n8n.exemple.ch/webhook/envoi"
          />
          <Input
            label="Jeton d'authentification (envoi)"
            type="password"
            value={sendSecret}
            onChange={(e) => setSendSecret(e.target.value)}
            placeholder={cfg.send_secret_last4 ? `•••• ${cfg.send_secret_last4} — laisser vide pour conserver` : "optionnel"}
          />

          {msg && (
            <p style={{ fontSize: "var(--text-sm)", margin: 0, color: msg.kind === "ok" ? "var(--color-success)" : "var(--color-danger)" }}>
              {msg.text}
            </p>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <Button variant="gold" loading={saving} onClick={save}>
              Enregistrer
            </Button>
            {linked && (
              <Button variant="ghost" onClick={reset} disabled={saving}>
                Retirer
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
