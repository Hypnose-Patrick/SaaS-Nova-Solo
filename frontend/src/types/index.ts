// Types partagés — miroir des tables Supabase (001_init_schema.sql)

export interface Profile {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  statut: "laci" | "reconversion" | "creation" | "existant" | null;
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

export type AgentKey =
  | "nova"
  | "juriste"
  | "strategist"
  | "financier"
  | "communicant"
  | "commercial"
  | "technicien";

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
