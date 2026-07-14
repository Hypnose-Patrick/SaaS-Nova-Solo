import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getReferralSummary, type ReferralSummary } from "@/lib/referral";
import { useUserStore } from "@/stores/useUserStore";

// Bloc parrainage — démarrage progressif en 3 paliers (même mécanique que
// Nova Solo France, transposée en CHF) : 2 filleuls -> upgrade Trio au prix
// Solo ; 5 filleuls -> -10 CHF/mois (remplace le palier 1) ; 7 filleuls ->
// cash 7 CHF/mois par filleul à partir du 7e (bookkeeping uniquement tant que
// Stripe Connect n'est pas activé côté Sàrl — cf. _shared/referral.ts).
// Le palier BYOK (plan "solo") ne peut pas parrainer.

const SECTION_TITLE: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--text-base)",
  fontWeight: 400,
  color: "var(--color-gold)",
  margin: "0 0 var(--space-4) 0",
};

const STATUT_LABEL: Record<string, string> = {
  trial: "Essai",
  month1_paid: "1er mois payé",
  qualified: "Qualifié ✓",
  churned: "Parti",
  on_byok: "Passé BYOK",
};

const SHARE_MESSAGE =
  "Je gère mon activité indépendante avec Nova Solo (Pipeline, factures, Cabinet Hermès). " +
  "Essaie avec mon lien :";

export function ReferralCard() {
  const account = useUserStore((s) => s.account);
  const [data, setData] = useState<ReferralSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (account?.plan === "solo") { setLoading(false); return; } // BYOK : pas d'appel réseau inutile
    let alive = true;
    getReferralSummary()
      .then((s) => { if (alive) { setData(s); setLoading(false); } })
      .catch((e) => { if (alive) { setError(e instanceof Error ? e.message : String(e)); setLoading(false); } });
    return () => { alive = false; };
  }, [account?.plan]);

  const copyLink = async () => {
    if (!data?.link) return;
    try {
      await navigator.clipboard.writeText(data.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard indisponible */ }
  };

  // Palier BYOK : parrainage non disponible (aucun abonnement à modifier).
  if (account?.plan === "solo") {
    return (
      <Card glass>
        <h3 style={SECTION_TITLE}>Parrainage</h3>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)", lineHeight: 1.6 }}>
          Le parrainage n'est pas disponible sur la formule <strong style={{ color: "var(--color-text-primary)" }}>BYOK</strong>.
          Passe sur Solo (29 CHF) ou Trio (39 CHF) pour inviter d'autres indépendants et débloquer des récompenses.
        </p>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card glass>
        <h3 style={SECTION_TITLE}>Parrainage</h3>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>Chargement…</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card glass>
        <h3 style={SECTION_TITLE}>Parrainage</h3>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>
          Parrainage indisponible pour le moment.
        </p>
      </Card>
    );
  }

  if (!data) return null;

  // Non éligible : teaser (le droit de parrainer s'ouvre au 2e mois d'abonnement).
  if (!data.eligible_to_refer) {
    return (
      <Card glass>
        <h3 style={SECTION_TITLE}>Parrainage</h3>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)", lineHeight: 1.6 }}>
          Dès ton <strong style={{ color: "var(--color-text-primary)" }}>2ᵉ mois d'abonnement</strong> (Solo 29 CHF ou Trio 39 CHF),
          tu pourras inviter d'autres indépendants et débloquer des récompenses :
          <br />• 2 filleuls → passe en <strong>Trio (39 CHF)</strong> en continuant de payer 29 CHF.
          <br />• 5 filleuls → <strong>-10 CHF/mois</strong> sur ton abonnement (remplace l'avantage précédent).
          <br />• 7 filleuls → à partir du 7ᵉ, chaque filleul te rapporte <strong>7 CHF/mois</strong> en plus.
        </p>
      </Card>
    );
  }

  const nActifs = data.counts.n_actifs;
  const cashEligibleCount = data.counts.cash_eligible_count;
  const shareLink = data.link ?? "";
  const waHref = `https://wa.me/?text=${encodeURIComponent(`${SHARE_MESSAGE} ${shareLink}`)}`;
  const mailHref = `mailto:?subject=${encodeURIComponent("Nova Solo — mon outil pour gérer mon activité")}` +
    `&body=${encodeURIComponent(`${SHARE_MESSAGE}\n${shareLink}`)}`;

  return (
    <Card glass>
      <h3 style={SECTION_TITLE}>Parrainage</h3>

      {/* Code + lien */}
      <div style={{ marginBottom: "var(--space-4)" }}>
        <label style={{ fontSize: "var(--text-xs)", letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-text-secondary)" }}>
          Ton lien d'invitation
        </label>
        <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)", flexWrap: "wrap" }}>
          <code style={{
            flex: 1, minWidth: 220, padding: "var(--space-2) var(--space-3)",
            background: "var(--color-bg-secondary)", borderRadius: "var(--radius-md)",
            fontSize: "var(--text-sm)", color: "var(--color-text-primary)", overflowWrap: "anywhere",
          }}>{shareLink}</code>
          <Button onClick={copyLink}>{copied ? "Copié ✓" : "Copier"}</Button>
        </div>
      </div>

      {/* Module de partage (révélé après le pic émotionnel : 1er client / 1ère facture) */}
      {data.share_unlocked ? (
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-5)" }}>
          <a href={waHref} target="_blank" rel="noopener noreferrer">
            <Button>Partager sur WhatsApp</Button>
          </a>
          <a href={mailHref}>
            <Button variant="ghost">Par email</Button>
          </a>
        </div>
      ) : (
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-xs)", marginBottom: "var(--space-5)" }}>
          Le partage guidé se débloque après ton 1ᵉʳ client ajouté au Pipeline ou ta 1ʳᵉ facture envoyée.
          Tu peux déjà copier ton lien ci-dessus.
        </p>
      )}

      {/* Progression vers les paliers (le palier 2 remplace le palier 1 une fois atteint) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
        <ProgressRow label="Upgrade Trio (39 CHF au prix de 29 CHF)" value={Math.min(nActifs, 2)} max={2} note={`${nActifs} filleul(s) actif(s)`} />
        <ProgressRow label="Remise -10 CHF/mois" value={Math.min(nActifs, 5)} max={5} note={`${Math.min(nActifs, 5)}/5 filleuls actifs`} />
        <ProgressRow label="Cash 7 CHF/mois par filleul (dès le 7ᵉ)" value={Math.min(nActifs, 7)} max={7} note={cashEligibleCount > 0 ? `${cashEligibleCount} filleul(s) cash-éligible(s)` : `${Math.min(nActifs, 7)}/7 filleuls actifs`} />
      </div>

      {/* Liste des filleuls */}
      {data.filleuls.length > 0 && (
        <div>
          <label style={{ fontSize: "var(--text-xs)", letterSpacing: "var(--tracking-wider)", textTransform: "uppercase", color: "var(--color-text-secondary)" }}>
            Tes filleuls
          </label>
          <ul style={{ listStyle: "none", padding: 0, margin: "var(--space-2) 0 0" }}>
            {data.filleuls.map((f, i) => (
              <li key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "var(--space-2) 0", borderBottom: "1px solid var(--color-border)",
                fontSize: "var(--text-sm)",
              }}>
                <span style={{ color: "var(--color-text-secondary)" }}>
                  Invité le {new Date(f.created_at).toLocaleDateString("fr-CH")}
                </span>
                <span style={{ color: f.status === "qualified" ? "var(--color-gold)" : "var(--color-text-secondary)" }}>
                  {STATUT_LABEL[f.status] ?? f.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function ProgressRow({ label, value, max, note }: { label: string; value: number; max: number; note: string }) {
  const pct = Math.round((value / max) * 100);
  const done = value >= max;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-sm)", marginBottom: "var(--space-1)" }}>
        <span style={{ color: done ? "var(--color-gold)" : "var(--color-text-primary)" }}>{label}{done ? " ✓" : ""}</span>
        <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-xs)" }}>{note}</span>
      </div>
      <div style={{ height: 6, background: "var(--color-bg-secondary)", borderRadius: 999 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--color-gold)", borderRadius: 999, transition: "width .3s" }} />
      </div>
    </div>
  );
}
