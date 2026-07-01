import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getAiConfig, saveAiConfig, type AiConfig, type AiMode } from "@/lib/aiConfig";
import { useUserStore } from "@/stores/useUserStore";

const SECTION_TITLE: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--text-base)",
  fontWeight: 400,
  color: "var(--color-gold)",
  margin: "0 0 var(--space-2) 0",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  fontWeight: 500,
  letterSpacing: "var(--tracking-wider)",
  textTransform: "uppercase",
  color: "var(--color-text-muted)",
};

const SELECT_STYLE: React.CSSProperties = {
  background: "var(--color-bg-input)",
  border: "var(--border-subtle)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text-primary)",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  padding: "var(--space-3) var(--space-4)",
  outline: "none",
  width: "100%",
};

type Provider = "openai" | "anthropic";

export function AiEngineCard() {
  const profile = useUserStore((s) => s.profile);
  const isSolo = profile?.plan === "solo";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<AiMode>("managed");
  const [provider, setProvider] = useState<Provider>("openai");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [savedLast4, setSavedLast4] = useState<string | null>(null);

  function hydrate(c: AiConfig) {
    // L'édition Solo n'inclut pas l'IA managée : pas de choix "Tout-compris"
    // possible, on force l'affichage sur la config BYOK dès l'ouverture.
    setMode(isSolo && c.mode === "managed" ? "byok_remote" : c.mode);
    setProvider((c.provider as Provider) ?? "openai");
    setBaseUrl(c.base_url ?? "");
    setModel(c.model ?? "");
    setSavedLast4(c.key_last4);
    setKey("");
  }

  useEffect(() => {
    getAiConfig()
      .then(hydrate)
      .catch(() => setError("Impossible de charger la configuration du moteur IA."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      const next = await saveAiConfig(
        mode === "byok_remote"
          ? { mode, provider, base_url: provider === "openai" ? baseUrl : baseUrl || null, model, key: key || null }
          : { mode },
      );
      hydrate(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'enregistrement.");
    }
    setSaving(false);
  }

  const isByok = mode === "byok_remote";
  // En BYOK, le bouton est actif si une clé existe déjà OU si l'abonné en saisit une.
  const keyReady = Boolean(key.trim()) || Boolean(savedLast4);
  const canSave =
    !isByok ||
    (Boolean(model.trim()) && keyReady && (provider === "anthropic" || Boolean(baseUrl.trim())));

  return (
    <Card glass>
      <p style={SECTION_TITLE}>Moteur IA — votre édition</p>
      {isSolo ? (
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-gold-muted)", margin: "0 0 var(--space-4) 0", lineHeight: "var(--leading-normal)" }}>
          <strong>Édition Solo (CHF 9/mois) — BYOK obligatoire.</strong> L'IA managée n'est pas
          incluse dans ce palier : configurez votre propre clé (OpenAI, OpenRouter, Anthropic…)
          ci-dessous pour utiliser les agents IA. Votre clé est chiffrée côté serveur, jamais
          réaffichée ; sa consommation est facturée directement par votre fournisseur.
        </p>
      ) : (
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: "0 0 var(--space-4) 0", lineHeight: "var(--leading-normal)" }}>
          Deux moteurs, deux éditions. En <strong>Tout-compris (Pro)</strong>, l'IA est incluse —
          rien à configurer, vous n'y pensez plus. En <strong>Autonome (Solo)</strong>, vous branchez
          votre propre fournisseur : c'est vous qui le réglez directement (en plus de l'abonnement),
          et votre clé est chiffrée côté serveur, jamais réaffichée.
        </p>
      )}

      {loading ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>Chargement…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <label style={LABEL_STYLE}>Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as AiMode)}
              style={SELECT_STYLE}
              disabled={isSolo}
            >
              {!isSolo && <option value="managed">Tout-compris (Pro) — IA incluse</option>}
              <option value="byok_remote">Autonome (Solo) — votre clé, votre fournisseur</option>
            </select>
          </div>

          {isByok && (
            <>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--color-gold-muted)", margin: 0, lineHeight: "var(--leading-normal)" }}>
                Édition Autonome : les appels IA sont facturés par <strong>votre</strong> fournisseur,
                pas par Nova Solo. Vous gardez la main sur votre quota et vos modèles.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                <label style={LABEL_STYLE}>Fournisseur</label>
                <select value={provider} onChange={(e) => setProvider(e.target.value as Provider)} style={SELECT_STYLE}>
                  <option value="openai">Compatible OpenAI (OpenAI · OpenRouter · Groq · Together)</option>
                  <option value="anthropic">Anthropic (direct)</option>
                </select>
              </div>

              <Input
                label={provider === "openai" ? "URL de base (API)" : "URL de base (optionnelle)"}
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={provider === "openai" ? "https://api.openai.com/v1 · https://openrouter.ai/api/v1" : "https://api.anthropic.com (défaut)"}
              />

              <Input
                label="Modèle"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={provider === "openai" ? "gpt-4o-mini · llama-3.1-70b" : "claude-sonnet-4-6"}
              />

              <Input
                label="Clé API"
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={savedLast4 ? `•••• ${savedLast4} — laisser vide pour conserver` : "sk-…"}
              />
            </>
          )}

          {error && <p style={{ color: "var(--color-danger)", fontSize: "var(--text-sm)", margin: 0 }}>{error}</p>}

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
            <Button variant="gold" loading={saving} disabled={!canSave} onClick={save}>
              Enregistrer le moteur IA
            </Button>
            {saved && <span style={{ fontSize: "var(--text-sm)", color: "var(--color-success)" }}>Enregistré ✓</span>}
          </div>
        </div>
      )}
    </Card>
  );
}
