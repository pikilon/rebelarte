// Tipos de filas y RPC. Contrato con supabase/migrations (ver docs/arquitectura.md §4).
// Si cambias el esquema, actualiza este archivo en el mismo cambio.

export type Lang = 'es' | 'en';
/** Texto traducible: { es: '...', en: '...' }. Al menos el idioma de origen. */
export type I18nText = Partial<Record<Lang, string>>;

export type BranchId = 'plasticas' | 'textos' | 'escenicas' | 'sonido' | 'audiovisuales';
export const BRANCHES: readonly BranchId[] = ['plasticas', 'textos', 'escenicas', 'sonido', 'audiovisuales'];

export type Visibility = 'public' | 'registered' | 'private';
export type WorkVisibility = 'public' | 'unlisted' | 'private';
export type WorkStatus = 'draft' | 'review' | 'published' | 'hidden' | 'deleted';
export type ProfileRole = 'user' | 'moderator' | 'admin';
export type AttachmentKind = 'image' | 'pdf' | 'zip' | 'audio';
export type ParticipationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';
export type RoleStatus = 'accepted' | 'rejected';
export type CvEntryKind = 'education' | 'course' | 'degree' | 'experience' | 'skill' | 'material' | 'other';
export type ContactKind = 'commission' | 'purchase' | 'license' | 'collaboration' | 'other';
export type ReportReason = 'copyright' | 'image_rights' | 'minors' | 'offensive' | 'spam' | 'other';
export type ReportTarget = 'work' | 'profile' | 'attachment' | 'message' | 'award';
export type ModerationAction =
  | 'hide' | 'restore' | 'delete' | 'suspend_user' | 'unsuspend_user' | 'verify_award' | 'dismiss_report';

export interface Category { id: number; branch: BranchId; slug: string; name: I18nText; sort: number }
export interface RoleCatalogItem { id: number; branch: BranchId | null; slug: string; name: I18nText; sort: number }
export interface License { id: string; name: I18nText; url: string | null }

/** Vista profiles_public: lo que cualquiera puede leer. */
export interface ProfilePublic {
  id: string;
  alias: string;
  short_id: string;
  display_name: string;
  lang: Lang;
  headline: I18nText;
  avatar_path: string | null;
  accepts_commissions: boolean;
  sells_works: boolean;
  role: ProfileRole;
  created_at: string;
}

/** Fila completa de profiles (solo el propio usuario). */
export interface Profile extends ProfilePublic {
  cover_letter: I18nText;
  location: string | null;
  contact_email: string | null;
  show_email: boolean;
  rate_text: I18nText;
  rate_price: string | null;
  field_visibility: Partial<Record<'location' | 'contact_email' | 'rate' | 'cover_letter', Visibility>>;
  status: 'active' | 'suspended';
  updated_at: string;
}

/** Resultado de rpc('profile_public', { p_alias }): campos con visibilidad ya filtrados (null si ocultos). */
export interface ProfileView extends ProfilePublic {
  cover_letter: I18nText | null;
  location: string | null;
  contact_email: string | null;
  rate_text: I18nText | null;
  rate_price: string | null;
}

export interface CvEntry {
  id: string;
  profile_id: string;
  kind: CvEntryKind;
  title: I18nText;
  organization: string | null;
  start_date: string | null;
  end_date: string | null;
  description: I18nText;
  lang: Lang;
  visibility: Visibility;
  sort: number;
}

export interface Work {
  id: string;
  short_id: string;
  uploader_id: string;
  branch: BranchId;
  category_id: number | null;
  title: I18nText;
  description: I18nText;
  keywords: string[];
  place: string | null;
  created_on: string | null;
  lang: Lang;
  license_id: string;
  visibility: WorkVisibility;
  status: WorkStatus;
  for_sale: boolean;
  accepts_commissions: boolean;
  price_text: string | null;
  cover_attachment_id: string | null;
  video_url: string | null;
  audio_embed_url: string | null;
  technique: string | null;
  pages: number | null;
  duration_seconds: number | null;
  audio_channels: string | null;
  recording_format: string | null;
  aspect_ratio: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Vista works_cards: obra visible + datos para tarjetas. */
export interface WorkCard {
  id: string;
  short_id: string;
  branch: BranchId;
  category_id: number | null;
  title: I18nText;
  lang: Lang;
  uploader_id: string;
  uploader_alias: string;
  uploader_name: string;
  cover_path: string | null; // ruta en bucket images (miniatura si existe)
  video_url: string | null;
  published_at: string | null;
}

export interface Attachment {
  id: string;
  work_id: string;
  kind: AttachmentKind;
  path: string;
  thumb_path: string | null;
  mime: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  title: string | null;
  sort: number;
}

export interface Participation {
  id: string;
  work_id: string;
  profile_id: string | null;
  guest_name: string | null;
  claim_code: string | null; // solo visible para el subidor
  status: ParticipationStatus;
  created_by: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParticipationRole {
  id: string;
  participation_id: string;
  role_id: number | null;
  role_text: string | null;
  status: RoleStatus;
  sort: number;
}

/** Entrada de cargos para RPC: cargo de catálogo o texto libre. */
export type RoleInput = { role_id: number } | { role_text: string };

export interface Award {
  id: string;
  name: I18nText;
  year: number | null;
  organization: string | null;
  description: I18nText;
  image_path: string | null;
  lang: Lang;
  verified: boolean;
  created_by: string;
}

export interface AwardLink { id: string; award_id: string; work_id: string | null; profile_id: string | null }

export interface Conversation {
  id: string;
  recipient_id: string;
  sender_id: string;
  work_id: string | null;
  kind: ContactKind;
  subject: string;
  created_at: string;
  last_message_at: string;
  deleted_by_sender: boolean;
  deleted_by_recipient: boolean;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type:
    | 'participation_new' | 'participation_rejected' | 'participation_withdrawn'
    | 'participation_invited' | 'message_new' | 'moderation';
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string | null;
  target_type: ReportTarget;
  target_id: string;
  reason: ReportReason;
  details: string | null;
  status: 'open' | 'actioned' | 'dismissed';
  created_at: string;
  resolved_by: string | null;
  resolved_at: string | null;
}

/** Límites (decisiones provisionales, especificación §10). */
export const LIMITS = {
  attachmentsPerWork: 6,
  attachmentsPerCv: 6,
  bytes: { image: 10 * 1024 * 1024, pdf: 20 * 1024 * 1024, zip: 10 * 1024 * 1024, audio: 30 * 1024 * 1024 },
  imageMaxSide: 2400,
  thumbMaxSide: 640,
  messageMaxChars: 5000
} as const;

export const DEFAULT_LICENSE = 'cc-by-nc-nd-4.0';
