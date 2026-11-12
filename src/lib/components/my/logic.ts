// Lógica pura de «Mi Rebelarte» (sin DOM ni red): validaciones, normalización y conversión de formularios.
import { ALIAS_RE, RESERVED_ALIASES } from '$lib/routes';
import type {
  BranchId, I18nText, Lang, RoleCatalogItem, RoleInput, Work, WorkStatus, WorkVisibility
} from '$lib/types';
import { DEFAULT_LICENSE } from '$lib/types';

// ---------- Alias ----------
export type AliasProblem = 'empty' | 'format' | 'reserved';

export function normalizeAlias(raw: string): string {
  return raw.trim().toLowerCase();
}

/** null = válido (falta comprobar disponibilidad en la base de datos). */
export function aliasProblem(raw: string): AliasProblem | null {
  const a = normalizeAlias(raw);
  if (!a) return 'empty';
  if (!ALIAS_RE.test(a)) return 'format';
  if ((RESERVED_ALIASES as readonly string[]).includes(a)) return 'reserved';
  return null;
}

/** Propone un alias a partir de un nombre visible. */
export function suggestAlias(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/g, '');
}

// ---------- Navegación tras entrar ----------
/** Solo rutas internas: evita redirecciones abiertas (`//evil`, `http:`, `\`). */
export function safeNext(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null;
  if (/[\u0000-\u001f]/.test(next)) return null;
  return next;
}

export function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
}

export function isOtpCode(s: string): boolean {
  return /^\d{6}$/.test(s.trim());
}

/** Clave de i18n para un error de autenticación de Supabase. */
export function authErrorKey(e: unknown): 'my.login.err.limit' | 'my.login.err.code' | 'my.login.err.email' | 'my.login.err.generic' {
  const err = e as { status?: number; code?: string; message?: string } | null;
  const code = err?.code ?? '';
  const msg = (err?.message ?? '').toLowerCase();
  if (err?.status === 429 || code.includes('rate_limit') || msg.includes('rate limit') || msg.includes('seconds')) return 'my.login.err.limit';
  if (code === 'otp_expired' || msg.includes('expired') || msg.includes('invalid') || code === 'otp_disabled' || msg.includes('verifier') || code.includes('verifier')) return 'my.login.err.code';
  if (code === 'email_address_invalid' || msg.includes('email address')) return 'my.login.err.email';
  return 'my.login.err.generic';
}

// ---------- Palabras clave ----------
export const MAX_KEYWORDS = 12;
export const MAX_KEYWORD_LEN = 40;

export function normalizeKeyword(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, MAX_KEYWORD_LEN);
}

/** Acepta una lista o texto separado por comas/saltos; deduplica y limita. */
export function normalizeKeywords(input: string | string[]): string[] {
  const parts = Array.isArray(input) ? input : input.split(/[,\n;]/);
  const out: string[] = [];
  for (const p of parts) {
    const k = normalizeKeyword(p);
    if (k && !out.includes(k)) out.push(k);
    if (out.length >= MAX_KEYWORDS) break;
  }
  return out;
}

// ---------- Referencias a obras ----------
/** Extrae el short_id de un enlace (`/es/obra/<id>/…`, `/o/<id>`) o de un id suelto de 8 caracteres base62. */
export function parseWorkRef(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  if (/^[0-9A-Za-z]{8}$/.test(s)) return s;
  let path = s;
  try {
    path = new URL(s, 'https://rebelarte.com').pathname;
  } catch {
    return null;
  }
  const m = /\/(?:obra|o)\/([0-9A-Za-z]{8})(?:\/|$)/.exec(path);
  return m ? m[1] : null;
}

// ---------- Duración ----------
/** "1:30", "01:02:03", "90" (segundos) → segundos. null si no es válido. */
export function parseDuration(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  const m = /^(\d{1,3}):([0-5]?\d)(?::([0-5]?\d))?$/.exec(s);
  if (!m) return null;
  if (m[3] !== undefined) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return Number(m[1]) * 60 + Number(m[2]);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// ---------- Textos traducibles ----------
/** Quita idiomas vacíos. */
export function cleanI18n(text: I18nText): I18nText {
  const out: I18nText = {};
  for (const l of ['es', 'en'] as const) {
    const v = text[l]?.trim();
    if (v) out[l] = v;
  }
  return out;
}

export function hasText(text: I18nText | null | undefined, lang: Lang): boolean {
  return Boolean(text?.[lang]?.trim());
}

// ---------- Orden ----------
export function moveItem<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return [...list];
  const copy = [...list];
  [copy[index], copy[to]] = [copy[to], copy[index]];
  return copy;
}

// ---------- Cargos ----------
export interface RoleSelection { roleIds: number[]; others: string[] }

export const MAX_ROLES = 8;

export function rolesToInput(sel: RoleSelection): RoleInput[] {
  const out: RoleInput[] = sel.roleIds.map((role_id) => ({ role_id }));
  const seen = new Set<string>();
  for (const o of sel.others) {
    const text = o.replace(/\s+/g, ' ').trim().slice(0, 80);
    const key = text.toLowerCase();
    if (text && !seen.has(key)) {
      seen.add(key);
      out.push({ role_text: text });
    }
  }
  return out.slice(0, MAX_ROLES);
}

/** Cargos del catálogo válidos para una rama: los de la rama más los globales (branch null). */
export function rolesForBranch(catalog: readonly RoleCatalogItem[], branch: BranchId | null): RoleCatalogItem[] {
  return catalog
    .filter((r) => r.branch === null || r.branch === branch)
    .sort((a, b) => (a.branch === b.branch ? a.sort - b.sort : a.branch === null ? 1 : -1));
}

// ---------- Obras ----------
export const WORK_VISIBILITIES: readonly WorkVisibility[] = ['public', 'unlisted', 'private'];

export interface BranchFields {
  technique: boolean;
  pages: boolean;
  duration: boolean;
  channels: boolean;
  format: boolean;
  aspect: boolean;
  videoUrl: boolean;
  audioUrl: boolean;
}
const NONE: BranchFields = { technique: false, pages: false, duration: false, channels: false, format: false, aspect: false, videoUrl: false, audioUrl: false };
export const BRANCH_FIELDS: Record<BranchId, BranchFields> = {
  plasticas: { ...NONE, technique: true },
  textos: { ...NONE, pages: true },
  escenicas: { ...NONE },
  sonido: { ...NONE, duration: true, channels: true, format: true, audioUrl: true },
  audiovisuales: { ...NONE, duration: true, channels: true, format: true, aspect: true, videoUrl: true }
};

export interface WorkDraft {
  branch: BranchId | null;
  category_id: number | null;
  title: I18nText;
  description: I18nText;
  keywords: string[];
  place: string;
  created_on: string;
  lang: Lang;
  license_id: string;
  visibility: WorkVisibility;
  for_sale: boolean;
  accepts_commissions: boolean;
  price_text: string;
  technique: string;
  pages: string;
  duration: string;
  audio_channels: string;
  recording_format: string;
  aspect_ratio: string;
  video_url: string;
  audio_embed_url: string;
}

export function emptyWorkDraft(lang: Lang): WorkDraft {
  return {
    branch: null, category_id: null, title: {}, description: {}, keywords: [], place: '', created_on: '', lang,
    license_id: DEFAULT_LICENSE, visibility: 'public', for_sale: false, accepts_commissions: false, price_text: '',
    technique: '', pages: '', duration: '', audio_channels: '', recording_format: '', aspect_ratio: '',
    video_url: '', audio_embed_url: ''
  };
}

export function draftFromWork(w: Work): WorkDraft {
  return {
    branch: w.branch, category_id: w.category_id, title: { ...w.title }, description: { ...w.description },
    keywords: [...(w.keywords ?? [])], place: w.place ?? '', created_on: w.created_on ?? '', lang: w.lang,
    license_id: w.license_id, visibility: w.visibility, for_sale: w.for_sale, accepts_commissions: w.accepts_commissions,
    price_text: w.price_text ?? '', technique: w.technique ?? '', pages: w.pages != null ? String(w.pages) : '',
    duration: formatDuration(w.duration_seconds), audio_channels: w.audio_channels ?? '',
    recording_format: w.recording_format ?? '', aspect_ratio: w.aspect_ratio ?? '',
    video_url: w.video_url ?? '', audio_embed_url: w.audio_embed_url ?? ''
  };
}

export type DraftError =
  | 'branch' | 'title' | 'pages' | 'duration' | 'videoUrl' | 'audioUrl' | 'date';

function nz(s: string): string | null {
  const v = s.trim();
  return v ? v : null;
}

/** Errores que impiden guardar. Mapa campo → código. */
export function validateDraft(d: WorkDraft, urlChecks: { video: (u: string) => boolean; audio: (u: string) => boolean }): Partial<Record<DraftError, true>> {
  const e: Partial<Record<DraftError, true>> = {};
  if (!d.branch) e.branch = true;
  if (!hasText(d.title, d.lang)) e.title = true;
  const f = d.branch ? BRANCH_FIELDS[d.branch] : NONE;
  if (f.pages && d.pages.trim() && !/^\d{1,5}$/.test(d.pages.trim())) e.pages = true;
  if (f.duration && d.duration.trim() && parseDuration(d.duration) === null) e.duration = true;
  if (f.videoUrl && d.video_url.trim() && !urlChecks.video(d.video_url.trim())) e.videoUrl = true;
  if (f.audioUrl && d.audio_embed_url.trim() && !urlChecks.audio(d.audio_embed_url.trim())) e.audioUrl = true;
  if (d.created_on && !/^\d{4}-\d{2}-\d{2}$/.test(d.created_on)) e.date = true;
  return e;
}

/** Campos a guardar en `works`. Los específicos de otras ramas se ponen a null. */
export function draftToRow(d: WorkDraft): Record<string, unknown> {
  const f = d.branch ? BRANCH_FIELDS[d.branch] : NONE;
  return {
    branch: d.branch,
    category_id: d.category_id,
    title: cleanI18n(d.title),
    description: cleanI18n(d.description),
    keywords: normalizeKeywords(d.keywords),
    place: nz(d.place),
    created_on: nz(d.created_on),
    lang: d.lang,
    license_id: d.license_id,
    visibility: d.visibility,
    for_sale: d.for_sale,
    accepts_commissions: d.accepts_commissions,
    price_text: nz(d.price_text),
    technique: f.technique ? nz(d.technique) : null,
    pages: f.pages && d.pages.trim() ? Number(d.pages.trim()) : null,
    duration_seconds: f.duration ? parseDuration(d.duration) : null,
    audio_channels: f.channels ? nz(d.audio_channels) : null,
    recording_format: f.format ? nz(d.recording_format) : null,
    aspect_ratio: f.aspect ? nz(d.aspect_ratio) : null,
    video_url: f.videoUrl ? nz(d.video_url) : null,
    audio_embed_url: f.audioUrl ? nz(d.audio_embed_url) : null
  };
}

export type SaveAction = 'draft' | 'publish' | 'keep';

/** Cambios de estado al guardar. Nunca se toca `hidden` (moderación) ni `deleted`. */
export function statusPatch(current: WorkStatus | null, action: SaveAction, now: string, publishedAt: string | null): Record<string, unknown> {
  if (current === 'hidden' || current === 'deleted') return {};
  if (action === 'publish') return { status: 'published', published_at: publishedAt ?? now };
  if (action === 'draft') return { status: 'draft' };
  return current ? {} : { status: 'draft' };
}

/** Acciones de guardado disponibles según el estado actual. */
export function saveActions(status: WorkStatus | null): SaveAction[] {
  if (status === 'hidden' || status === 'deleted') return ['keep'];
  if (status === 'published') return ['keep', 'draft'];
  return ['draft', 'publish'];
}

export const WORK_STATUS_FILTERS: readonly (WorkStatus | 'all')[] = ['all', 'draft', 'review', 'published', 'hidden'];

// ---------- Errores de base de datos ----------
// Las RPC lanzan códigos en minúsculas como mensaje (`raise exception 'already_participating'`).
export type DbErrorKey =
  | 'my.err.duplicate' | 'my.err.forbidden' | 'my.err.notfound' | 'my.err.generic' | 'my.err.already'
  | 'my.err.noAuthor' | 'my.err.code' | 'my.err.rejectedBefore' | 'my.err.own' | 'my.err.transition' | 'my.err.roles';

const DB_MESSAGES: Record<string, DbErrorKey> = {
  alias_taken: 'my.err.duplicate',
  already_participating: 'my.err.already',
  work_not_found: 'my.err.notfound',
  participation_not_found: 'my.err.notfound',
  role_not_found: 'my.err.notfound',
  profile_not_found: 'my.err.noAuthor',
  invalid_code: 'my.err.code',
  participation_rejected: 'my.err.rejectedBefore',
  own_participation: 'my.err.own',
  invalid_transition: 'my.err.transition',
  roles_required: 'my.err.roles',
  too_many_roles: 'my.err.roles',
  invalid_role: 'my.err.roles',
  forbidden: 'my.err.forbidden',
  account_suspended: 'my.err.forbidden'
};

export function dbErrorKey(e: unknown): DbErrorKey {
  const err = e as { code?: string; message?: string } | null;
  const code = err?.code ?? '';
  const msg = (err?.message ?? '').trim().toLowerCase();
  if (msg in DB_MESSAGES) return DB_MESSAGES[msg];
  if (code === '23505' || msg.includes('duplicate')) return 'my.err.duplicate';
  if (code === '42501' || msg.includes('row-level security') || msg.includes('not allowed') || msg.includes('permission')) return 'my.err.forbidden';
  if (code === 'PGRST116' || msg.includes('not found')) return 'my.err.notfound';
  return 'my.err.generic';
}
