import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useUserStore } from "@/stores/useUserStore";
import type { Profile } from "@/types";
import { useAiGen } from "@/lib/useAiGen";
import { promptBio } from "@/lib/lancementPrompts";
import { applyAccent, DEFAULT_ACCENT } from "@/lib/theme";
import { AiEngineCard } from "@/components/settings/AiEngineCard";

const MAX_LOGO_BYTES = 500 * 1024; // 500 Ko — stocké en data URL dans le profil

type Statut = Profile["statut"];

const STATUTS: { value: Statut; label: string }[] = [
  { value: "laci",         label: "Chômeur (LACI / RAC)" },
  { value: "reconversion", label: "En reconversion" },
  { value: "creation",     label: "En création d'activité" },
  { value: "existant",     label: "Indépendant actif" },
];

const SECTION_TITLE: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--text-base)",
  fontWeight: 400,
  color: "var(--color-gold)",
  margin: "0 0 var(--space-4) 0",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  fontWeight: 500,
  letterSpacing: "var(--tracking-wider)",
  textTransform: "uppercase" as const,
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

interface FormState {
  name: string;
  statut: Statut;
  domaine: string;
  situation: string;
  ville: string;
  canton: string;
  is_laci: boolean;
  brand_name: string;
  slogan: string;
  accent_color: string;
  logo_url: string;
  bio: string;
  contact_email: string;
  contact_tel: string;
  contact_adresse: string;
  website: string;
  capital: string;
  charges_fixes: string;
  pricing_tarif: string;
  pricing_clients: string;
}

function profileToForm(p: Profile): FormState {
  return {
    name:            p.name ?? "",
    statut:          p.statut ?? null,
    domaine:         p.domaine ?? "",
    situation:       p.situation ?? "",
    ville:           p.ville ?? "",
    canton:          p.canton ?? "",
    is_laci:         p.is_laci ?? false,
    brand_name:      p.brand_name ?? "",
    slogan:          p.slogan ?? "",
    accent_color:    p.accent_color ?? DEFAULT_ACCENT,
    logo_url:        p.logo_url ?? "",
    bio:             p.bio ?? "",
    contact_email:   p.contact_email ?? "",
    contact_tel:     p.contact_tel ?? "",
    contact_adresse: p.contact_adresse ?? "",
    website:         p.website ?? "",
    capital:         p.capital != null ? String(p.capital) : "",
    charges_fixes:   p.charges_fixes != null ? String(p.charges_fixes) : "",
    pricing_tarif:   p.pricing_tarif != null ? String(p.pricing_tarif) : "",
    pricing_clients: p.pricing_clients != null ? String(p.pricing_clients) : "",
  };
}

export function Settings() {
  const { profile, updateProfile, loading } = useUserStore();
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { loading: bioLoading, gen } = useAiGen();
  const [logoError, setLogoError] = useState<string | null>(null);

  async function improveBio() {
    if (!form?.bio.trim()) return;
    const r = await gen("communicant", promptBio(form.bio));
    if (r) setF({ bio: r });
  }

  // Applique la couleur en direct pendant l'édition (aperçu avant sauvegarde).
  function changeAccent(hex: string) {
    setF({ accent_color: hex });
    applyAccent(hex);
  }

  function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoError(null);
    if (!file.type.startsWith("image/")) { setLogoError("Format non supporté — choisissez une image."); return; }
    if (file.size > MAX_LOGO_BYTES) { setLogoError("Logo trop lourd (max 500 Ko)."); return; }
    const reader = new FileReader();
    reader.onload = () => setF({ logo_url: String(reader.result) });
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    if (profile) setForm(profileToForm(profile));
  }, [profile]);

  // En quittant les Réglages, on rétablit la couleur réellement enregistrée
  // (au cas où l'utilisateur a prévisualisé sans sauvegarder).
  useEffect(() => {
    return () => applyAccent(profile?.accent_color);
  }, [profile?.accent_color]);

  function setF(patch: Partial<FormState>) {
    setForm((f) => f ? { ...f, ...patch } : f);
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setSaved(false);
    await updateProfile({
      name:            form.name || null,
      statut:          form.statut ?? null,
      domaine:         form.domaine || null,
      situation:       form.situation || null,
      ville:           form.ville || null,
      canton:          form.canton || null,
      is_laci:         form.is_laci,
      brand_name:      form.brand_name || null,
      slogan:          form.slogan || null,
      accent_color:    form.accent_color || null,
      logo_url:        form.logo_url || null,
      bio:             form.bio || null,
      contact_email:   form.contact_email || null,
      contact_tel:     form.contact_tel || null,
      contact_adresse: form.contact_adresse || null,
      website:         form.website || null,
      capital:         form.capital ? parseFloat(form.capital) : 0,
      charges_fixes:   form.charges_fixes ? parseFloat(form.charges_fixes) : 0,
      pricing_tarif:   form.pricing_tarif ? parseFloat(form.pricing_tarif) : null,
      pricing_clients: form.pricing_clients ? parseInt(form.pricing_clients) : null,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading || !form) {
    return <p style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-body)" }}>Chargement…</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: 860 }}>
      {/* Header */}
      <div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 400, color: "var(--color-text-primary)", margin: 0 }}>
          Réglages
        </h2>
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", marginTop: "var(--space-1)" }}>
          Votre profil, votre marque, et les paramètres financiers utilisés par le Dashboard.
        </p>
      </div>

      {/* Section : Identité */}
      <Card glass>
        <p style={SECTION_TITLE}>Identité</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
          <Input
            label="Nom complet"
            value={form.name}
            onChange={(e) => setF({ name: e.target.value })}
            placeholder="Ex. Marie Dupont"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <label style={LABEL_STYLE}>Statut</label>
            <select
              value={form.statut ?? ""}
              onChange={(e) => setF({ statut: (e.target.value || null) as Statut })}
              style={SELECT_STYLE}
            >
              <option value="">— Sélectionner —</option>
              {STATUTS.map((s) => (
                <option key={s.value} value={s.value ?? ""}>{s.label}</option>
              ))}
            </select>
          </div>
          <Input
            label="Domaine d'activité"
            value={form.domaine}
            onChange={(e) => setF({ domaine: e.target.value })}
            placeholder="Coaching professionnel, hypnose…"
          />
          <Input
            label="Situation actuelle"
            value={form.situation}
            onChange={(e) => setF({ situation: e.target.value })}
            placeholder="Ex-employé, lancé depuis 6 mois…"
          />
          <Input
            label="Ville"
            value={form.ville}
            onChange={(e) => setF({ ville: e.target.value })}
            placeholder="Lausanne"
          />
          <Input
            label="Canton"
            value={form.canton}
            onChange={(e) => setF({ canton: e.target.value })}
            placeholder="VD"
          />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginTop: "var(--space-4)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={form.is_laci}
            onChange={(e) => setF({ is_laci: e.target.checked })}
            style={{ accentColor: "var(--color-gold)", width: 16, height: 16 }}
          />
          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
            Je perçois des indemnités LACI (chômage suisse)
          </span>
        </label>
      </Card>

      {/* Section : Marque */}
      <Card glass>
        <p style={SECTION_TITLE}>Marque</p>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
          <div style={{ width: 72, height: 72, borderRadius: "var(--radius-sm)", border: "var(--border-subtle)", background: "var(--color-bg-input)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
            {form.logo_url ? (
              <img src={form.logo_url} alt="Logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            ) : (
              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>Logo</span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <label style={{ display: "inline-flex" }}>
                <input type="file" accept="image/*" onChange={uploadLogo} style={{ display: "none" }} />
                <span style={{ display: "inline-flex", alignItems: "center", padding: "var(--space-2) var(--space-4)", borderRadius: "var(--radius-sm)", border: "var(--border-subtle)", background: "var(--color-bg-input)", color: "var(--color-text-secondary)", fontSize: "var(--text-sm)", cursor: "pointer" }}>
                  {form.logo_url ? "Changer le logo" : "Téléverser un logo"}
                </span>
              </label>
              {form.logo_url && (
                <Button size="sm" variant="ghost" onClick={() => setF({ logo_url: "" })}>Retirer</Button>
              )}
            </div>
            <span style={{ fontSize: "var(--text-xs)", color: logoError ? "var(--color-danger)" : "var(--color-text-muted)" }}>
              {logoError ?? "PNG ou SVG, fond transparent de préférence — max 500 Ko."}
            </span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
          <Input
            label="Nom de marque"
            value={form.brand_name}
            onChange={(e) => setF({ brand_name: e.target.value })}
            placeholder="Nova Solo"
          />
          <Input
            label="Slogan"
            value={form.slogan}
            onChange={(e) => setF({ slogan: e.target.value })}
            placeholder="L'assistant des indépendants"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <label style={LABEL_STYLE}>Couleur accent</label>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <input
                type="color"
                value={form.accent_color}
                onChange={(e) => changeAccent(e.target.value)}
                style={{ width: 40, height: 36, border: "var(--border-subtle)", borderRadius: "var(--radius-xs)", background: "none", cursor: "pointer", padding: 2 }}
              />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                {form.accent_color}
              </span>
              {form.accent_color.toLowerCase() !== DEFAULT_ACCENT && (
                <button
                  onClick={() => changeAccent(DEFAULT_ACCENT)}
                  style={{ background: "none", border: "none", color: "var(--color-text-muted)", fontSize: "var(--text-xs)", cursor: "pointer", textDecoration: "underline" }}
                >
                  réinitialiser
                </button>
              )}
            </div>
          </div>
        </div>
        <div style={{ marginTop: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={LABEL_STYLE}>Bio / Pitch</label>
            <Button size="sm" variant="ghost" loading={bioLoading} onClick={improveBio} disabled={!form.bio.trim()}>
              Améliorer avec l'IA
            </Button>
          </div>
          <textarea
            value={form.bio}
            onChange={(e) => setF({ bio: e.target.value })}
            placeholder="Coach certifié PNL et hypnothérapeute, j'accompagne les indépendants à développer leur activité avec sérénité…"
            style={{
              width: "100%",
              marginTop: "var(--space-2)",
              minHeight: 100,
              background: "var(--color-bg-input)",
              border: "var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              color: "var(--color-text-primary)",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-sm)",
              lineHeight: "var(--leading-normal)",
              padding: "var(--space-3) var(--space-4)",
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      </Card>

      {/* Section : Contact */}
      <Card glass>
        <p style={SECTION_TITLE}>Contact professionnel</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
          <Input
            label="Email professionnel"
            type="email"
            value={form.contact_email}
            onChange={(e) => setF({ contact_email: e.target.value })}
            placeholder="vous@monactivite.ch"
          />
          <Input
            label="Téléphone"
            type="tel"
            value={form.contact_tel}
            onChange={(e) => setF({ contact_tel: e.target.value })}
            placeholder="+41 79 000 00 00"
          />
          <Input
            label="Site web"
            type="url"
            value={form.website}
            onChange={(e) => setF({ website: e.target.value })}
            placeholder="https://monactivite.ch"
          />
          <Input
            label="Adresse"
            value={form.contact_adresse}
            onChange={(e) => setF({ contact_adresse: e.target.value })}
            placeholder="Rue de la Paix 12, 1000 Lausanne"
          />
        </div>
      </Card>

      {/* Section : Paramètres financiers */}
      <Card glass>
        <p style={SECTION_TITLE}>Paramètres financiers</p>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: "calc(-1 * var(--space-2)) 0 var(--space-4) 0" }}>
          Utilisés pour le calcul du runway et des projections de revenus.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
          <Input
            label="Capital disponible (CHF)"
            type="number"
            min="0"
            step="100"
            value={form.capital}
            onChange={(e) => setF({ capital: e.target.value })}
            placeholder="10000"
          />
          <Input
            label="Charges fixes mensuelles (CHF)"
            type="number"
            min="0"
            step="50"
            value={form.charges_fixes}
            onChange={(e) => setF({ charges_fixes: e.target.value })}
            placeholder="2500"
          />
          <Input
            label="Tarif journalier / séance (CHF)"
            type="number"
            min="0"
            step="10"
            value={form.pricing_tarif}
            onChange={(e) => setF({ pricing_tarif: e.target.value })}
            placeholder="180"
          />
          <Input
            label="Nombre clients cibles / mois"
            type="number"
            min="0"
            step="1"
            value={form.pricing_clients}
            onChange={(e) => setF({ pricing_clients: e.target.value })}
            placeholder="8"
          />
        </div>

        {form.capital && form.charges_fixes && parseFloat(form.charges_fixes) > 0 && (
          <div style={{ marginTop: "var(--space-4)", padding: "var(--space-3)", background: "rgba(197,165,114,0.06)", borderRadius: "var(--radius-sm)", border: "var(--border-subtle)" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
              Runway estimé :{" "}
              <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-sm)", color: "var(--color-gold)" }}>
                {Math.floor(parseFloat(form.capital) / parseFloat(form.charges_fixes))} mois
              </span>
              {form.pricing_tarif && form.pricing_clients && (
                <>
                  {" · "}Objectif CA mensuel :{" "}
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-sm)", color: "var(--color-success)" }}>
                    CHF {(parseFloat(form.pricing_tarif) * parseInt(form.pricing_clients)).toLocaleString("fr-CH")}
                  </span>
                </>
              )}
            </span>
          </div>
        )}
      </Card>

      {/* Section : Moteur IA (BYOK) — conf propre, sauvegardée séparément */}
      <AiEngineCard />

      {/* Bouton global */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
        <Button variant="gold" loading={saving} onClick={save}>
          Sauvegarder le profil
        </Button>
        {saved && (
          <span style={{ fontSize: "var(--text-sm)", color: "var(--color-success)" }}>
            Profil mis à jour ✓
          </span>
        )}
      </div>
    </div>
  );
}
