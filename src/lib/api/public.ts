// Consultas de las páginas públicas. Contrato: docs/arquitectura.md §4. La RLS ya filtra lo no visible.
import { supabase, unwrap } from '$lib/supabase';
import { firstRow } from './publicUtils';
import type {
  Attachment, Award, BranchId, Category, CvEntry, I18nText, License, ProfilePublic, ProfileView,
  RoleCatalogItem, Work, WorkCard
} from '$lib/types';

export const PAGE_SIZE = 12;

/* ───────── Catálogos (se piden una vez por sesión) ───────── */

export interface Catalogs { categories: Category[]; roles: RoleCatalogItem[]; licenses: License[] }

let catalogsPromise: Promise<Catalogs> | null = null;

export function loadCatalogs(): Promise<Catalogs> {
  catalogsPromise ??= (async () => {
    const [c, r, l] = await Promise.all([
      supabase.from('categories').select('*').order('sort'),
      supabase.from('role_catalog').select('*').order('sort'),
      supabase.from('licenses').select('*')
    ]);
    return {
      categories: unwrap(c) as Category[],
      roles: unwrap(r) as RoleCatalogItem[],
      licenses: unwrap(l) as License[]
    };
  })().catch((e) => {
    catalogsPromise = null; // permite reintentar
    throw e;
  });
  return catalogsPromise;
}

/** Catálogos sin lanzar: ante un fallo devuelve listas vacías (la página sigue siendo útil). */
export async function loadCatalogsSafe(): Promise<Catalogs> {
  try {
    return await loadCatalogs();
  } catch {
    return { categories: [], roles: [], licenses: [] };
  }
}

/* ───────── Listados ───────── */

export interface WorkFilter { branch?: BranchId | null; categoryId?: number | null }

export async function listWorks(f: WorkFilter, limit: number, offset: number): Promise<WorkCard[]> {
  let q = supabase.from('works_cards').select('*');
  if (f.branch) q = q.eq('branch', f.branch);
  if (f.categoryId != null) q = q.eq('category_id', f.categoryId);
  const res = await q.order('published_at', { ascending: false, nullsFirst: false }).range(offset, offset + limit - 1);
  return unwrap(res) as WorkCard[];
}

export async function searchWorks(q: string, f: WorkFilter, limit: number, offset: number): Promise<WorkCard[]> {
  const res = await supabase.rpc('search_works', {
    p_q: q,
    p_branch: f.branch ?? null,
    p_category: f.categoryId ?? null,
    p_limit: limit,
    p_offset: offset
  });
  return (unwrap(res) ?? []) as WorkCard[];
}

export async function searchProfiles(q: string, limit: number): Promise<ProfilePublic[]> {
  const res = await supabase.rpc('search_profiles', { p_q: q, p_limit: limit });
  return (unwrap(res) ?? []) as ProfilePublic[];
}

/* ───────── Obra ───────── */

const WORK_COLS =
  'id, short_id, uploader_id, branch, category_id, title, description, keywords, place, created_on, lang, license_id, ' +
  'visibility, status, for_sale, accepts_commissions, price_text, cover_attachment_id, video_url, audio_embed_url, ' +
  'technique, pages, duration_seconds, audio_channels, recording_format, aspect_ratio, published_at, created_at, updated_at';

export async function getWorkByShortId(shortId: string): Promise<Work | null> {
  if (!/^[0-9A-Za-z]{4,16}$/.test(shortId)) return null;
  const res = await supabase.from('works').select(WORK_COLS).eq('short_id', shortId).maybeSingle();
  return (unwrap(res) as unknown as Work | null) ?? null;
}

export async function getAttachments(workId: string): Promise<Attachment[]> {
  const res = await supabase.from('attachments').select('*').eq('work_id', workId).order('sort');
  return (unwrap(res) ?? []) as Attachment[];
}

export async function getProfileById(id: string): Promise<ProfilePublic | null> {
  const res = await supabase.from('profiles_public').select('*').eq('id', id).maybeSingle();
  return (unwrap(res) as ProfilePublic | null) ?? null;
}

export interface ParticipantRole { id: string; name: I18nText | null; text: string | null }
export interface ParticipantView {
  id: string;
  profile: ProfilePublic | null;
  guestName: string | null;
  isUploader: boolean;
  roles: ParticipantRole[];
}

/** Participantes aceptados con sus cargos aceptados. El subidor va primero. */
export async function getParticipants(workId: string, uploaderId: string, roleCatalog: RoleCatalogItem[]): Promise<ParticipantView[]> {
  const pRes = await supabase
    .from('participations')
    .select('id, profile_id, guest_name, status, created_at')
    .eq('work_id', workId)
    .eq('status', 'accepted')
    .order('created_at');
  const parts = (unwrap(pRes) ?? []) as { id: string; profile_id: string | null; guest_name: string | null; created_at: string }[];
  if (!parts.length) return [];

  const profileIds = [...new Set(parts.map((p) => p.profile_id).filter((x): x is string => !!x))];
  const [rRes, prRes] = await Promise.all([
    supabase.from('participation_roles').select('id, participation_id, role_id, role_text, status, sort')
      .in('participation_id', parts.map((p) => p.id)).eq('status', 'accepted').order('sort'),
    profileIds.length ? supabase.from('profiles_public').select('*').in('id', profileIds) : Promise.resolve({ data: [], error: null })
  ]);
  const roles = (unwrap(rRes) ?? []) as { id: string; participation_id: string; role_id: number | null; role_text: string | null }[];
  const profiles = new Map(((unwrap(prRes) ?? []) as ProfilePublic[]).map((p) => [p.id, p]));
  const catalog = new Map(roleCatalog.map((r) => [r.id, r]));

  const views = parts.map<ParticipantView>((p) => ({
    id: p.id,
    profile: p.profile_id ? profiles.get(p.profile_id) ?? null : null,
    guestName: p.guest_name,
    isUploader: p.profile_id === uploaderId,
    roles: roles
      .filter((r) => r.participation_id === p.id)
      .map((r) => ({ id: r.id, name: r.role_id != null ? catalog.get(r.role_id)?.name ?? null : null, text: r.role_text }))
      .filter((r) => r.name || r.text)
  }));
  // Participante con cuenta pero perfil no legible (suspendido): se omite.
  return views
    .filter((v) => v.profile || v.guestName)
    .sort((a, b) => Number(b.isUploader) - Number(a.isUploader));
}

export async function getWorkAwards(workId: string): Promise<Award[]> {
  const lRes = await supabase.from('award_links').select('award_id').eq('work_id', workId);
  const ids = ((unwrap(lRes) ?? []) as { award_id: string }[]).map((l) => l.award_id);
  if (!ids.length) return [];
  const aRes = await supabase.from('awards').select('*').in('id', ids);
  return ((unwrap(aRes) ?? []) as Award[]).sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
}

export interface WorkPageData {
  work: Work;
  attachments: Attachment[];
  uploader: ProfilePublic | null;
  participants: ParticipantView[];
  awards: Award[];
  catalogs: Catalogs;
}

/** Todo lo que necesita la ficha de obra. null si no existe o no es visible. */
export async function getWorkPage(shortId: string): Promise<WorkPageData | null> {
  const work = await getWorkByShortId(shortId);
  if (!work) return null;
  const catalogs = await loadCatalogsSafe();
  const [attachments, uploader, participants, awards] = await Promise.all([
    getAttachments(work.id),
    getProfileById(work.uploader_id).catch(() => null),
    getParticipants(work.id, work.uploader_id, catalogs.roles).catch(() => []),
    getWorkAwards(work.id).catch(() => [])
  ]);
  return { work, attachments, uploader, participants, awards, catalogs };
}

/* ───────── CV ───────── */

export type CvWorkRole = { role_id: number | null; role_text: string | null };
export type CvWork = WorkCard & { roles: CvWorkRole[] };
export type CvAward = Award & { via_work_id: string | null };

export interface CvPageData {
  profile: ProfileView;
  works: CvWork[];
  awards: CvAward[];
  entries: CvEntry[];
  catalogs: Catalogs;
}

export async function getProfileView(alias: string): Promise<ProfileView | null> {
  const res = await supabase.rpc('profile_public', { p_alias: alias });
  return firstRow(unwrap(res) as ProfileView | ProfileView[] | null);
}

/** Todo lo que necesita el CV público. null si el alias no existe. */
export async function getCvPage(alias: string): Promise<CvPageData | null> {
  const profile = await getProfileView(alias);
  if (!profile) return null;
  const [wRes, aRes, eRes, catalogs] = await Promise.all([
    supabase.rpc('cv_works', { p_profile_id: profile.id }),
    supabase.rpc('cv_awards', { p_profile_id: profile.id }),
    supabase.from('cv_entries').select('*').eq('profile_id', profile.id).order('sort'),
    loadCatalogsSafe()
  ]);
  const works = ((unwrap(wRes) ?? []) as (WorkCard & { roles: CvWorkRole[] | null })[]).map((w) => ({ ...w, roles: w.roles ?? [] }));
  return {
    profile,
    works,
    awards: (unwrap(aRes) ?? []) as CvAward[],
    entries: (unwrap(eRes) ?? []) as CvEntry[],
    catalogs
  };
}

