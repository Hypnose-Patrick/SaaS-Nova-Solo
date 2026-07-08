// Types partagés — miroir des tables Supabase (001_init_schema.sql)

// Depuis la migration 013 (multi-projets) : Profile = UN PROJET (rattaché à un
// Account). L'abonnement/plan/quota a été déplacé sur Account — ne plus lire
// subscription_status / stripe_customer_id / plan / is_admin sur un Profile,
// ces colonnes existent encore en base (transition) mais sont figées/obsolètes.
export interface Profile {
  id: string;
  account_id: string;
  project_name: string;
  user_id: string;
  name: string | null;
  email: string | null;
  statut: "laci" | "reconversion" | "creation" | "existant" | null;
  activite_type: "prestation" | "artisanat" | "commerce" | null;
  domaine: string | null;
  situation: string | null;
  ville: string | null;
  canton: string | null;
  is_laci: boolean;
  capital: number;
  charges_fixes: number;
  runway_months: number | null;
  brand_name: string | null;
  slogan: string | null;
  logo_url: string | null;
  accent_color: string | null;
  contact_email: string | null;
  contact_tel: string | null;
  contact_adresse: string | null;
  website: string | null;
  bio: string | null;
  profil: string | null;
  pricing_tarif: number | null;
  pricing_clients: number | null;
  created_at: string;
  updated_at: string;
}

// 1 par utilisateur — porte l'abonnement Stripe et le quota de projets.
export interface Account {
  id: string;
  user_id: string;
  plan: "solo" | "pro" | "trio" | null;
  max_projects: number;
  stripe_customer_id: string | null;
  subscription_status: "active" | "trialing" | "inactive" | "canceled" | null;
  subscription_id: string | null;
  subscription_end: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export type AgentKey =
  | "nova"
  | "juriste"
  | "strategist"
  | "financier"
  | "communicant"
  | "commercial"
  | "technicien"
  | "oracle"
  | "victor";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  agent: AgentKey;
  created_at: string;
}

export type SonCas =
  | "sympathie"
  | "orgueil"
  | "nouveaute"
  | "confort"
  | "argent"
  | "securite";

export type ProspectColumn =
  | "nouveau"
  | "contacte"
  | "rdv"
  | "proposition"
  | "gagne"
  | "perdu";

export interface Prospect {
  id: string;
  profile_id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  column_key: ProspectColumn;
  soncas: SonCas | null;
  est_value: number;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  profile_id: string;
  title: string;
  date: string;
  time_start: string | null;
  time_end: string | null;
  type: "rdv" | "tache" | "formation" | "autre" | null;
  location: string | null;
  all_day: boolean;
  gcal_id: string | null;
  created_at: string;
}

export interface ComptaEntry {
  id: string;
  profile_id: string;
  date: string;
  description: string | null;
  amount: number;
  type: "revenu" | "depense";
  tva: number | null;
  fournisseur: string | null;
  category: string | null;
  receipt_url: string | null;
  invoice_id: string | null;
  created_at: string;
}

export interface BmcBlock {
  id: string;
  profile_id: string;
  block_key: string;
  content: string | null;
  challenge: string | null;
}

export interface Invoice {
  id: string;
  profile_id: string;
  number: string;
  client_name: string | null;
  client_email: string | null;
  date: string;
  amount_ht: number | null;
  tva_rate: number;
  amount_ttc: number | null;
  items: Array<{ description: string; qty: number; unit_price: number }> | null;
  status: "draft" | "sent" | "paid";
  created_at: string;
}

// Compagnon terrain (migration 016) — entité générique de rattachement.
// Le libellé UI vient du preset activite_type (« chantier » / « mandat » / « commande »).
export interface Mandat {
  id: string;
  profile_id: string;
  title: string;
  client_name: string | null;
  prospect_id: string | null;
  hourly_rate: number | null;
  status: "open" | "done" | "invoiced";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type CaptureKind = "photo" | "voice" | "note"; // 'devis' réservé V2

// mandat_id NULL = capture orpheline ; triaged_at NULL = dans l'inbox « à trier ».
export interface CaptureItem {
  id: string;
  profile_id: string;
  mandat_id: string | null;
  kind: CaptureKind;
  storage_path: string | null;
  transcript: string | null;
  note: string | null;
  meta: Record<string, unknown>;
  compta_entry_id: string | null;
  triaged_at: string | null;
  captured_at: string;
  created_at: string;
}

// ended_at NULL = chrono en cours (un seul par profil, index unique en base).
// duration_min (éditable au stop) est la source de vérité pour la facturation.
export interface TimeEntry {
  id: string;
  profile_id: string;
  mandat_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_min: number | null;
  hourly_rate: number | null;
  note: string | null;
  billed: boolean;
  created_at: string;
}

export interface AiProxyRequest {
  agent?: AgentKey;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  context?: unknown;
  provider?: "openrouter" | "anthropic";
  model?: string;
  stream?: boolean;
}

export interface AiProxyResponse {
  content: string;
  provider: string;
  model: string;
  agent: AgentKey;
}
