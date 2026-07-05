import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { escapeHtml } from "@/lib/exportDoc";

type Lang = "fr" | "de" | "it";

const LANG_LABELS: Record<Lang, string> = { fr: "Français", de: "Deutsch", it: "Italiano" };

const CONTENT: Record<Lang, { mentions: string; cgu: string; privacy: string }> = {
  fr: {
    mentions: `## Responsable du site
Patrick Beiner · Monthey, Canton du Valais, Suisse
Email : info@start-mybusiness.com · https://start-mybusiness.ch

*Activité exercée en nom propre dans l'attente de la constitution de la société.*

## Hébergement
**Hostinger International Ltd.** · 61 Lordou Vironos Street, 6023 Larnaca, Chypre · hostinger.com
**Supabase Inc.** (base de données — région EU Frankfurt) · supabase.com

## Responsabilité
Patrick Beiner décline toute responsabilité pour les dommages résultant de l'utilisation de la plateforme. Les contenus générés par IA sont fournis à titre informatif uniquement.

## Propriété intellectuelle
L'ensemble des éléments de Nova Solo (code, textes, visuels, agents IA) sont la propriété exclusive de Patrick Beiner. Toute reproduction sans autorisation écrite préalable est interdite.

## Droit applicable
Droit suisse · For exclusif : tribunaux du Canton du Valais.`,

    cgu: `## 1. Objet
Les présentes CGU régissent l'utilisation de **Nova Solo** (https://start-mybusiness.ch), éditée par Patrick Beiner, Monthey, Suisse.

## 2. Service
Nova Solo est une plateforme SaaS pour solopreneurs proposant : outils de pilotage business (BMC, pipeline, finances, facturation), assistance à la création d'activité, agents IA conversationnels (Claude/Anthropic, OpenRouter), agenda et gestion de documents.

## 3. Compte
Accès par compte personnel (email). L'utilisateur est responsable de la confidentialité de ses identifiants.

## 4. Utilisation autorisée
Usage légal et professionnel uniquement. Interdit : partage de compte, scraping, revente, contenus illicites.

## 5. Données personnelles
Voir Politique de confidentialité. Conformité nLPD (RS 235.1) + RGPD UE.

## 6. Propriété intellectuelle
Nova Solo et tous ses éléments sont la propriété de Patrick Beiner. Les données saisies restent la propriété de l'utilisateur.

## 7. Limitation de responsabilité
Service fourni « tel quel ». Les réponses IA sont indicatives et ne remplacent pas un conseil professionnel. Responsabilité limitée au montant payé sur 12 mois.

## 8. Résiliation
Suppression du compte à tout moment dans Réglages, ou résiliation de l'abonnement (annulation du paiement récurrent). Dans les deux cas, les données ne sont pas effacées immédiatement : elles sont conservées 30 jours (délai de grâce), durant lesquels l'utilisateur peut se réabonner ou réactiver son compte pour retrouver l'intégralité de son accès et de ses données. Passé ce délai de 30 jours, toutes les données sont effacées définitivement et irréversiblement, sans possibilité de restauration. L'Éditeur peut résilier avec 30 jours de préavis.

## 9. Modifications
Modifications notifiées 15 jours à l'avance par email.

## 10. Droit applicable
Droit suisse (CO RS 220) · For exclusif : Canton du Valais · Contact : info@start-mybusiness.com`,

    privacy: `## 1. Responsable du traitement
Patrick Beiner · Monthey, Valais, Suisse · info@start-mybusiness.com

## 2. Données collectées

| Catégorie | Données | Finalité | Conservation |
|---|---|---|---|
| Compte | Email, mot de passe (haché) | Authentification | Durée compte + 3 ans |
| Profil business | Statut, secteur, logo, bio | Personnalisation | Durée compte |
| Données business | BMC, pipeline, finances, factures, CV | Service | Compte + 5 ans |
| Conversations IA | Messages agents Nova Solo | Réponses IA | 12 mois |
| Données techniques | IP, logs | Sécurité | 30 jours |
| Facturation | Référence transaction | Comptabilité | 10 ans (CO 958f) |
| Compte supprimé / abonnement résilié | Toutes les données du compte (profil, business, conversations IA) | Permettre la réactivation à la demande de l'utilisateur | 30 jours (délai de grâce), puis effacement définitif |

## 3. Sous-traitants
Hostinger (EU) · Supabase EU Frankfurt · Anthropic USA (DPA + CCS) · OpenRouter USA (CCS) · Bunny.net EU (audio, sans données perso)

## 4. Vos droits (nLPD art. 25–28)
Accès · Rectification · Effacement (Réglages) · Portabilité (JSON) · Opposition · Réclamation PFPDT (edoeb.admin.ch)
La suppression du compte (ou la résiliation de l'abonnement) déclenche un délai de grâce de 30 jours durant lequel les données sont conservées et l'accès peut être restauré en se réabonnant ou en réactivant le compte. Passé ce délai, l'effacement est définitif et irréversible : aucune récupération n'est possible au-delà des 30 jours.
**Contact** : info@start-mybusiness.com — réponse sous 30 jours.

## 5. Sécurité
TLS 1.2+ · AES-256 (Supabase) · Row Level Security · Supabase Auth

## 6. Cookies
Cookies fonctionnels uniquement (session). Aucun tracking ni publicité.

## 7. IA
Les messages envoyés aux agents IA transitent par Anthropic et OpenRouter. Ne partagez pas de données sensibles (médicales, bancaires) dans les conversations IA.

## 8. Droit applicable
nLPD RS 235.1 (Suisse) + RGPD UE si applicable.`,
  },

  de: {
    mentions: `## Verantwortlicher
Patrick Beiner · Monthey, Kanton Wallis, Schweiz
E-Mail: info@start-mybusiness.com · https://start-mybusiness.ch

*Tätigkeit unter eigenem Namen bis zur Gesellschaftsgründung.*

## Hosting
**Hostinger International Ltd.** · 61 Lordou Vironos Street, 6023 Larnaca, Zypern · hostinger.com
**Supabase Inc.** (Datenbank — Region EU Frankfurt) · supabase.com

## Haftung
Patrick Beiner haftet nicht für Schäden aus der Nutzung der Plattform. KI-Inhalte dienen nur zu Informationszwecken.

## Geistiges Eigentum
Alle Elemente von Nova Solo (Code, Texte, Bilder, KI-Agenten) sind Eigentum von Patrick Beiner. Vervielfältigung ohne Genehmigung untersagt.

## Anwendbares Recht
Schweizerisches Recht · Gerichtsstand: Kanton Wallis.`,

    cgu: `## 1. Gegenstand
Diese NB regeln die Nutzung von **Nova Solo** (https://start-mybusiness.ch) von Patrick Beiner, Monthey, Schweiz.

## 2. Dienst
Nova Solo ist eine SaaS-Plattform für Solopreneure: Business-Tools (BMC, Pipeline, Finanzen, Rechnungen), Gründungsunterstützung, KI-Agenten (Claude/Anthropic, OpenRouter), Kalender und Dokumentenverwaltung.

## 3. Konto
Persönliches Konto (E-Mail). Benutzer ist für Zugangsdaten verantwortlich.

## 4. Zulässige Nutzung
Nur rechtmässige berufliche Nutzung. Verboten: Kontoteilung, Scraping, Weiterverkauf, rechtswidrige Inhalte.

## 5. Personenbezogene Daten
Siehe Datenschutzerklärung. Konformität nDSG (SR 235.1) + DSGVO.

## 6. Geistiges Eigentum
Nova Solo und alle Elemente gehören Patrick Beiner. Benutzerdaten bleiben Eigentum des Benutzers.

## 7. Haftungsbeschränkung
Dienst «wie besehen». KI-Antworten sind indikativ, kein professioneller Rat. Haftung begrenzt auf gezahlten Betrag der letzten 12 Monate.

## 8. Kündigung
Kontolöschung jederzeit in Einstellungen, oder Kündigung des Abonnements (Beendigung der wiederkehrenden Zahlung). In beiden Fällen werden die Daten nicht sofort gelöscht: Sie werden 30 Tage lang aufbewahrt (Karenzfrist), innerhalb derer der Benutzer sein Abonnement erneuern oder sein Konto reaktivieren kann, um vollständigen Zugriff auf sein Konto und seine Daten zurückzuerhalten. Nach Ablauf dieser 30-tägigen Frist werden alle Daten endgültig und unwiderruflich gelöscht, ohne Möglichkeit der Wiederherstellung. Der Herausgeber kann mit 30 Tagen Frist kündigen.

## 9. Änderungen
Wesentliche Änderungen 15 Tage im Voraus per E-Mail.

## 10. Anwendbares Recht
Schweizerisches Recht (OR SR 220) · Gerichtsstand: Kanton Wallis · Kontakt: info@start-mybusiness.com`,

    privacy: `## 1. Verantwortlicher
Patrick Beiner · Monthey, Wallis, Schweiz · info@start-mybusiness.com

## 2. Erhobene Daten

| Kategorie | Daten | Zweck | Aufbewahrung |
|---|---|---|---|
| Konto | E-Mail, Passwort (gehasht) | Authentifizierung | Kontodauer + 3 Jahre |
| Business-Profil | Status, Branche, Logo, Bio | Personalisierung | Kontodauer |
| Business-Daten | BMC, Pipeline, Finanzen, Rechnungen, CV | Dienst | Konto + 5 Jahre |
| KI-Gespräche | Agentennachrichten | KI-Antworten | 12 Monate |
| Technische Daten | IP, Logs | Sicherheit | 30 Tage |
| Rechnungsdaten | Transaktionsreferenz | Buchhaltung | 10 Jahre (OR 958f) |
| Gelöschtes Konto / gekündigtes Abonnement | Alle Kontodaten (Profil, Business, KI-Gespräche) | Reaktivierung auf Wunsch des Benutzers ermöglichen | 30 Tage (Karenzfrist), danach endgültige Löschung |

## 3. Unterauftragsverarbeiter
Hostinger (EU) · Supabase EU Frankfurt · Anthropic USA (AV-Vertrag + SKK) · OpenRouter USA (SKK) · Bunny.net EU (Audio, keine Personendaten)

## 4. Ihre Rechte (nDSG Art. 25–28)
Auskunft · Berichtigung · Löschung (Einstellungen) · Datenübertragbarkeit (JSON) · Widerspruch · Beschwerde EDÖB (edoeb.admin.ch)
Die Löschung des Kontos (oder die Kündigung des Abonnements) löst eine 30-tägige Karenzfrist aus, während der die Daten aufbewahrt werden und der Zugriff durch erneutes Abonnieren oder Reaktivieren des Kontos wiederhergestellt werden kann. Nach Ablauf dieser Frist ist die Löschung endgültig und unwiderruflich: Nach 30 Tagen ist keine Wiederherstellung mehr möglich.
**Kontakt**: info@start-mybusiness.com — Antwort innerhalb 30 Tagen.

## 5. Sicherheit
TLS 1.2+ · AES-256 (Supabase) · Row Level Security · Supabase Auth

## 6. Cookies
Nur funktionale Cookies (Sitzung). Kein Tracking, keine Werbung.

## 7. KI
Nachrichten an KI-Agenten werden über Anthropic und OpenRouter verarbeitet. Keine sensiblen Daten (medizinisch, finanziell) in KI-Gesprächen teilen.

## 8. Anwendbares Recht
nDSG SR 235.1 (Schweiz) + DSGVO wenn anwendbar.`,
  },

  it: {
    mentions: `## Responsabile del sito
Patrick Beiner · Monthey, Canton Vallese, Svizzera
Email: info@start-mybusiness.com · https://start-mybusiness.ch

*Attività svolta a titolo personale in attesa della costituzione della società.*

## Hosting
**Hostinger International Ltd.** · 61 Lordou Vironos Street, 6023 Larnaca, Cipro · hostinger.com
**Supabase Inc.** (database — regione UE Francoforte) · supabase.com

## Responsabilità
Patrick Beiner declina ogni responsabilità per danni derivanti dall'utilizzo della piattaforma. I contenuti IA sono forniti a scopo informativo.

## Proprietà intellettuale
Tutti gli elementi di Nova Solo (codice, testi, immagini, agenti IA) sono di proprietà esclusiva di Patrick Beiner. Qualsiasi riproduzione senza autorizzazione è vietata.

## Diritto applicabile
Diritto svizzero · Foro esclusivo: tribunali del Canton Vallese.`,

    cgu: `## 1. Oggetto
Le presenti CGU disciplinano l'utilizzo di **Nova Solo** (https://start-mybusiness.ch) di Patrick Beiner, Monthey, Svizzera.

## 2. Servizio
Nova Solo è una piattaforma SaaS per solopreneur: strumenti business (BMC, pipeline, finanze, fatturazione), supporto alla creazione d'attività, agenti IA (Claude/Anthropic, OpenRouter), agenda e documenti.

## 3. Account
Account personale (email). L'utente è responsabile delle proprie credenziali.

## 4. Utilizzo consentito
Solo uso legale e professionale. Vietato: condivisione account, scraping, rivendita, contenuti illeciti.

## 5. Dati personali
Vedi Informativa sulla privacy. Conformità nLPD (RS 235.1) + GDPR UE.

## 6. Proprietà intellettuale
Nova Solo e tutti i suoi elementi appartengono a Patrick Beiner. I dati inseriti rimangono di proprietà dell'utente.

## 7. Limitazione di responsabilità
Servizio «così com'è». Le risposte IA sono indicative e non sostituiscono consulenza professionale. Responsabilità limitata all'importo pagato negli ultimi 12 mesi.

## 8. Risoluzione
Eliminazione dell'account in qualsiasi momento in Impostazioni, oppure disdetta dell'abbonamento (interruzione del pagamento ricorrente). In entrambi i casi, i dati non vengono cancellati immediatamente: sono conservati per 30 giorni (periodo di grazia), durante i quali l'utente può riabbonarsi o riattivare il proprio account per recuperare l'accesso completo al proprio account e ai propri dati. Trascorso questo termine di 30 giorni, tutti i dati vengono cancellati in modo definitivo e irreversibile, senza possibilità di ripristino. L'Editore può risolvere con un preavviso di 30 giorni.

## 9. Modifiche
Modifiche sostanziali notificate 15 giorni prima via email.

## 10. Diritto applicabile
Diritto svizzero (CO RS 220) · Foro: Canton Vallese · Contatto: info@start-mybusiness.com`,

    privacy: `## 1. Titolare del trattamento
Patrick Beiner · Monthey, Vallese, Svizzera · info@start-mybusiness.com

## 2. Dati raccolti

| Categoria | Dati | Finalità | Conservazione |
|---|---|---|---|
| Account | Email, password (hashata) | Autenticazione | Durata account + 3 anni |
| Profilo business | Stato, settore, logo, bio | Personalizzazione | Durata account |
| Dati business | BMC, pipeline, finanze, fatture, CV | Servizio | Account + 5 anni |
| Conversazioni IA | Messaggi agenti Nova Solo | Risposte IA | 12 mesi |
| Dati tecnici | IP, log | Sicurezza | 30 giorni |
| Fatturazione | Riferimento transazione | Contabilità | 10 anni (CO 958f) |
| Account eliminato / abbonamento disdetto | Tutti i dati dell'account (profilo, business, conversazioni IA) | Consentire la riattivazione su richiesta dell'utente | 30 giorni (periodo di grazia), poi cancellazione definitiva |

## 3. Sub-responsabili
Hostinger (UE) · Supabase UE Francoforte · Anthropic USA (DPA + CCT) · OpenRouter USA (CCT) · Bunny.net UE (audio, senza dati personali)

## 4. I vostri diritti (nLPD art. 25–28)
Accesso · Rettifica · Cancellazione (Impostazioni) · Portabilità (JSON) · Opposizione · Reclamo IFPDT (edoeb.admin.ch)
L'eliminazione dell'account (o la disdetta dell'abbonamento) attiva un periodo di grazia di 30 giorni durante il quale i dati vengono conservati e l'accesso può essere ripristinato riabbonandosi o riattivando l'account. Trascorso questo termine, la cancellazione è definitiva e irreversibile: non è più possibile alcun recupero oltre i 30 giorni.
**Contatto**: info@start-mybusiness.com — risposta entro 30 giorni.

## 5. Sicurezza
TLS 1.2+ · AES-256 (Supabase) · Row Level Security · Supabase Auth

## 6. Cookie
Solo cookie funzionali (sessione). Nessun tracking né pubblicità.

## 7. IA
I messaggi agli agenti IA vengono elaborati tramite Anthropic e OpenRouter. Non condividete dati sensibili (medici, bancari) nelle conversazioni IA.

## 8. Diritto applicabile
nLPD RS 235.1 (Svizzera) + GDPR UE se applicabile.`,
  },
};

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("## ")) return <h3 key={i} style={{ color: "var(--color-gold)", fontFamily: "var(--font-display)", fontSize: "var(--text-base)", fontWeight: 400, margin: "var(--space-6) 0 var(--space-2) 0" }}>{line.slice(3)}</h3>;
    if (line.startsWith("| ") && line.includes("|")) {
      if (line.replace(/\|/g, "").trim().replace(/-/g, "").trim() === "") return null;
      const cells = line.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      const isHeader = lines[i + 1]?.startsWith("|---");
      return (
        <div key={i} style={{ display: "grid", gridTemplateColumns: `repeat(${cells.length}, 1fr)`, gap: "0 var(--space-2)", borderBottom: "1px solid var(--color-border)", padding: "var(--space-1) 0" }}>
          {cells.map((c, j) => <span key={j} style={{ fontSize: "var(--text-xs)", color: isHeader ? "var(--color-text-secondary)" : "var(--color-text-primary)", fontWeight: isHeader ? 600 : 400 }}>{c.trim()}</span>)}
        </div>
      );
    }
    if (line.startsWith("**") && line.endsWith("**")) return <p key={i} style={{ fontWeight: 600, color: "var(--color-text-primary)", margin: "var(--space-2) 0 0 0", fontSize: "var(--text-sm)" }}>{line.slice(2, -2)}</p>;
    if (line.trim() === "") return <div key={i} style={{ height: "var(--space-2)" }} />;
    // Échapper avant d'appliquer le markdown gras/italique — protège même si CONTENT
    // devient un jour dynamique (ex. texte légal généré/édité) plutôt que codé en dur.
    const escaped = escapeHtml(line).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>");
    return <p key={i} style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: escaped }} />;
  });
}

export function Legal() {
  const [lang, setLang] = useState<Lang>("fr");
  const [tab, setTab] = useState<"mentions" | "cgu" | "privacy">("mentions");

  const TAB_LABELS = {
    fr: { mentions: "Mentions légales", cgu: "CGU", privacy: "Confidentialité" },
    de: { mentions: "Impressum", cgu: "Nutzungsbedingungen", privacy: "Datenschutz" },
    it: { mentions: "Note legali", cgu: "Condizioni d'uso", privacy: "Privacy" },
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "var(--space-2) var(--space-4)",
    border: "none",
    background: active ? "var(--color-gold)" : "transparent",
    color: active ? "var(--color-bg-primary)" : "var(--color-text-secondary)",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    fontSize: "var(--text-sm)",
    fontFamily: "var(--font-display)",
  });

  const langStyle = (active: boolean): React.CSSProperties => ({
    padding: "var(--space-1) var(--space-3)",
    border: `1px solid ${active ? "var(--color-gold)" : "var(--color-border)"}`,
    background: "transparent",
    color: active ? "var(--color-gold)" : "var(--color-text-secondary)",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    fontSize: "var(--text-xs)",
  });

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <PageHeader title="Informations légales" />

      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
        {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
          <button key={l} style={langStyle(lang === l)} onClick={() => setLang(l)}>
            {LANG_LABELS[l]}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-6)" }}>
        {(["mentions", "cgu", "privacy"] as const).map((t) => (
          <button key={t} style={tabStyle(tab === t)} onClick={() => setTab(t)}>
            {TAB_LABELS[lang][t]}
          </button>
        ))}
      </div>

      <Card>
        <div style={{ padding: "var(--space-6)" }}>
          {renderMarkdown(CONTENT[lang][tab])}
        </div>
      </Card>
    </div>
  );
}
