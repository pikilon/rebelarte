// Consultas y acciones de «Mi Rebelarte». Usa los nombres del contrato (docs/arquitectura.md §4).
import { supabase, unwrap } from '$lib/supabase';
import type {
  Attachment, Award, Category, CvEntry, CvEntryKind, I18nText, Lang, License, Participation, ParticipationRole,
  Profile, ProfilePublic, RoleCatalogItem, RoleInput, Work, WorkCard
} from '$lib/types';
import { removeAttachmentFiles, removeAvatar, uploadAvatar } from '$lib/media/upload';

// ---------- Catálogos (se cargan una vez) ----------
let catalogCache: Promise<{ categories: Category[]; roles: RoleCatalogItem[]; licenses: License[] }> | null = null;

export function loadCatalogs() {
  catalogCache ??= (async () => {
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
    catalogCache = null;
    throw e;
  });
  return catalogCache;
}

// ---------- Perfil ----------
export async function aliasAvailable(alias: string): Promise<boolean> {
  const { count, error } = await supabase.from('profiles_public').select('id', { count: 'exact', head: true }).eq('alias', alias);
  if (error) throw new Error(error.message);
  return (count ?? 0) === 0;
}

export type ProfilePatch = Partial<Pick<Profile,
  'display_name' | 'lang' | 'headline' | 'cover_letter' | 'location' | 'avatar_path' | 'contact_email' | 'show_email' |
  'accepts_commissions' | 'sells_works' | 'rate_text' | 'rate_price' | 'field_visibility'>>;

export async function updateProfile(userId: string, patch: ProfilePatch): Promise<Profile> {
  return unwrap(await supabase.from('profiles').update(patch).eq('id', userId).select('*').single()) as Profile;
}

/** Sube el avatar nuevo, lo guarda en el perfil y borra el anterior. */
export async function replaceAvatar(userId: string, blob: Blob, previous: string | null): Promise<Profile> {
  const path = await uploadAvatar(blob, userId);
  try {
    const p = await updateProfile(userId, { avatar_path: path });
    await removeAvatar(previous);
    return p;
  } catch (e) {
    await removeAvatar(path);
    throw e;
  }
}

export async function clearAvatar(userId: string, previous: string | null): Promise<Profile> {
  const p = await updateProfile(userId, { avatar_path: null });
  await removeAvatar(previous);
  return p;
}

export async function requestEmailChange(email: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ email });
  if (error) throw error;
}

// ---------- CV ----------
export async function listCvEntries(userId: string): Promise<CvEntry[]> {
  return unwrap(await supabase.from('cv_entries').select('*').eq('profile_id', userId).order('kind').order('sort')) as CvEntry[];
}

export type CvEntryInput = Pick<CvEntry, 'kind' | 'title' | 'organization' | 'start_date' | 'end_date' | 'description' | 'lang' | 'visibility'>;

export async function createCvEntry(userId: string, input: CvEntryInput, sort: number): Promise<CvEntry> {
  return unwrap(await supabase.from('cv_entries').insert({ ...input, profile_id: userId, sort }).select('*').single()) as CvEntry;
}

export async function updateCvEntry(id: string, input: Partial<CvEntryInput>): Promise<CvEntry> {
  return unwrap(await supabase.from('cv_entries').update(input).eq('id', id).select('*').single()) as CvEntry;
}

export async function deleteCvEntry(id: string): Promise<void> {
  unwrap(await supabase.from('cv_entries').delete().eq('id', id));
}

/** Guarda el nuevo orden de las entradas de un tipo (sort = posición). */
export async function saveCvOrder(ids: string[]): Promise<void> {
  const results = await Promise.all(ids.map((id, i) => supabase.from('cv_entries').update({ sort: i }).eq('id', id)));
  const bad = results.find((r) => r.error);
  if (bad?.error) throw new Error(bad.error.message);
}

export type { CvEntryKind };

// ---------- Premios propios ----------
export interface MyAward { link_id: string; award: Award }

export async function listMyAwards(userId: string): Promise<MyAward[]> {
  const rows = unwrap(
    await supabase.from('award_links').select('id, award:awards(*)').eq('profile_id', userId)
  ) as unknown as Array<{ id: string; award: Award | null }>;
  return rows.filter((r): r is { id: string; award: Award } => r.award !== null).map((r) => ({ link_id: r.id, award: r.award }));
}

export interface AwardInput { name: I18nText; year: number | null; organization: string | null; description: I18nText; lang: Lang }

export async function createMyAward(userId: string, input: AwardInput): Promise<MyAward> {
  const award = unwrap(await supabase.from('awards').insert({ ...input, created_by: userId }).select('*').single()) as Award;
  const { data, error } = await supabase.from('award_links').insert({ award_id: award.id, profile_id: userId, created_by: userId }).select('id').single();
  if (error) {
    await supabase.from('awards').delete().eq('id', award.id);
    throw new Error(error.message);
  }
  return { link_id: (data as { id: string }).id, award };
}

export async function updateMyAward(id: string, input: AwardInput): Promise<Award> {
  return unwrap(await supabase.from('awards').update(input).eq('id', id).select('*').single()) as Award;
}

export async function deleteMyAward(a: MyAward): Promise<void> {
  unwrap(await supabase.from('award_links').delete().eq('id', a.link_id));
  // El premio puede estar reutilizado por otras personas u obras: si no se puede borrar, se deja.
  await supabase.from('awards').delete().eq('id', a.award.id);
}

// ---------- Obras ----------
export async function listMyWorks(userId: string): Promise<Work[]> {
  return unwrap(
    await supabase.from('works').select('*').eq('uploader_id', userId).neq('status', 'deleted').order('updated_at', { ascending: false })
  ) as Work[];
}

export async function countMyWorks(userId: string): Promise<number> {
  const { count } = await supabase.from('works').select('id', { count: 'exact', head: true }).eq('uploader_id', userId).neq('status', 'deleted');
  return count ?? 0;
}

export async function getMyWork(id: string): Promise<Work | null> {
  const { data, error } = await supabase.from('works').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Work | null) ?? null;
}

export async function createWork(userId: string, row: Record<string, unknown>): Promise<Work> {
  return unwrap(await supabase.from('works').insert({ ...row, uploader_id: userId }).select('*').single()) as Work;
}

export async function updateWork(id: string, row: Record<string, unknown>): Promise<Work> {
  return unwrap(await supabase.from('works').update(row).eq('id', id).select('*').single()) as Work;
}

/** Borrado lógico. */
export async function deleteWork(id: string): Promise<void> {
  unwrap(await supabase.from('works').update({ status: 'deleted' }).eq('id', id));
}

// ---------- Adjuntos ----------
export async function listAttachments(workId: string): Promise<Attachment[]> {
  return unwrap(await supabase.from('attachments').select('*').eq('work_id', workId).order('sort')) as Attachment[];
}

export async function renameAttachment(id: string, title: string): Promise<void> {
  unwrap(await supabase.from('attachments').update({ title: title.trim() || null }).eq('id', id));
}

export async function saveAttachmentOrder(ids: string[]): Promise<void> {
  const results = await Promise.all(ids.map((id, i) => supabase.from('attachments').update({ sort: i }).eq('id', id)));
  const bad = results.find((r) => r.error);
  if (bad?.error) throw new Error(bad.error.message);
}

export async function setCover(workId: string, attachmentId: string | null): Promise<void> {
  unwrap(await supabase.from('works').update({ cover_attachment_id: attachmentId }).eq('id', workId));
}

/** Borra la fila y los archivos del bucket. Si era la portada, la libera antes. */
export async function deleteAttachment(att: Attachment, isCover: boolean): Promise<void> {
  if (isCover) await setCover(att.work_id, null);
  unwrap(await supabase.from('attachments').delete().eq('id', att.id));
  await removeAttachmentFiles(att);
}

// ---------- Participaciones ----------
export interface ParticipationView extends Participation {
  roles: ParticipationRole[];
  person: Pick<ProfilePublic, 'alias' | 'display_name'> | null;
}

async function withPeople(rows: Array<Participation & { participation_roles: ParticipationRole[] }>): Promise<ParticipationView[]> {
  const ids = [...new Set(rows.map((r) => r.profile_id).filter((x): x is string => !!x))];
  const people = new Map<string, Pick<ProfilePublic, 'alias' | 'display_name'>>();
  if (ids.length) {
    const profs = unwrap(await supabase.from('profiles_public').select('id, alias, display_name').in('id', ids)) as Array<Pick<ProfilePublic, 'id' | 'alias' | 'display_name'>>;
    for (const p of profs) people.set(p.id, { alias: p.alias, display_name: p.display_name });
  }
  return rows.map(({ participation_roles, ...p }) => ({
    ...p,
    roles: [...(participation_roles ?? [])].sort((a, b) => a.sort - b.sort),
    person: p.profile_id ? people.get(p.profile_id) ?? null : null
  }));
}

export async function listWorkParticipations(workId: string): Promise<ParticipationView[]> {
  const rows = unwrap(
    await supabase.from('participations').select('*, participation_roles(*)').eq('work_id', workId).order('created_at')
  ) as unknown as Array<Participation & { participation_roles: ParticipationRole[] }>;
  const views = await withPeople(rows);
  // El código de reclamación solo lo ve el subidor, a través de la vista participations_manage.
  const { data: codes } = await supabase.from('participations_manage').select('id, claim_code').eq('work_id', workId);
  const byId = new Map(((codes ?? []) as Array<{ id: string; claim_code: string | null }>).map((c) => [c.id, c.claim_code]));
  return views.map((v) => ({ ...v, claim_code: byId.get(v.id) ?? null }));
}

export type WorkRef = Pick<Work, 'id' | 'short_id' | 'title' | 'lang' | 'branch' | 'uploader_id' | 'status'>;

async function workRefs(ids: string[]): Promise<Map<string, WorkRef>> {
  const map = new Map<string, WorkRef>();
  if (!ids.length) return map;
  const rows = unwrap(
    await supabase.from('works').select('id, short_id, title, lang, branch, uploader_id, status').in('id', ids)
  ) as WorkRef[];
  for (const w of rows) map.set(w.id, w);
  return map;
}

export interface MyParticipation extends ParticipationView { work: WorkRef | null }

/** Mis participaciones en obras de otras personas. */
export async function listMyParticipations(userId: string): Promise<MyParticipation[]> {
  const rows = unwrap(
    await supabase.from('participations').select('*, participation_roles(*)').eq('profile_id', userId).order('created_at', { ascending: false })
  ) as unknown as Array<Participation & { participation_roles: ParticipationRole[] }>;
  const views = await withPeople(rows);
  const works = await workRefs([...new Set(views.map((v) => v.work_id))]);
  return views
    .map((v) => ({ ...v, work: works.get(v.work_id) ?? null }))
    .filter((v) => v.work?.uploader_id !== userId);
}

export interface ReceivedParticipation extends ParticipationView { work: WorkRef }

/** Participaciones de otras personas en mis obras más recientes. */
export async function listReceivedParticipations(userId: string, workLimit = 30): Promise<ReceivedParticipation[]> {
  const works = unwrap(
    await supabase.from('works').select('id, short_id, title, lang, branch, uploader_id, status').eq('uploader_id', userId)
      .neq('status', 'deleted').order('created_at', { ascending: false }).limit(workLimit)
  ) as WorkRef[];
  if (!works.length) return [];
  const byId = new Map(works.map((w) => [w.id, w]));
  const rows = unwrap(
    await supabase.from('participations').select('*, participation_roles(*)').in('work_id', [...byId.keys()])
      .order('created_at', { ascending: false }).limit(80)
  ) as unknown as Array<Participation & { participation_roles: ParticipationRole[] }>;
  const views = await withPeople(rows.filter((r) => r.profile_id !== userId));
  return views.flatMap((v) => {
    const work = byId.get(v.work_id);
    return work ? [{ ...v, work }] : [];
  });
}

export async function findWorkByShortId(shortId: string): Promise<Pick<WorkCard, 'id' | 'short_id' | 'title' | 'lang' | 'branch' | 'uploader_name'> | null> {
  const { data, error } = await supabase.from('works_cards').select('id, short_id, title, lang, branch, uploader_name').eq('short_id', shortId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Pick<WorkCard, 'id' | 'short_id' | 'title' | 'lang' | 'branch' | 'uploader_name'> | null;
}

export async function requestParticipation(workId: string, roles: RoleInput[]): Promise<void> {
  const { error } = await supabase.rpc('request_participation', { p_work_id: workId, p_roles: roles });
  if (error) throw error;
}

export async function addGuestParticipant(workId: string, guestName: string, roles: RoleInput[]): Promise<string> {
  const { data, error } = await supabase.rpc('add_guest_participant', { p_work_id: workId, p_guest_name: guestName, p_roles: roles });
  if (error) throw error;
  return data as string;
}

export async function inviteParticipant(workId: string, alias: string, roles: RoleInput[]): Promise<void> {
  const { error } = await supabase.rpc('invite_participant', { p_work_id: workId, p_alias: alias, p_roles: roles });
  if (error) throw error;
}

export async function setParticipationStatus(id: string, status: 'rejected' | 'withdrawn'): Promise<void> {
  const { error } = await supabase.rpc('set_participation_status', { p_id: id, p_status: status });
  if (error) throw error;
}

export async function setRoleStatus(roleId: string, status: 'accepted' | 'rejected'): Promise<void> {
  const { error } = await supabase.rpc('set_participation_role_status', { p_role_id: roleId, p_status: status });
  if (error) throw error;
}

/** Devuelve el id de la participación reclamada. */
export async function claimParticipation(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('claim_participation', { p_code: code.trim() });
  if (error) throw error;
  return data as string;
}

/** Obra de una participación propia (para enlazarla tras reclamar). */
export async function getParticipationWork(participationId: string): Promise<WorkRef | null> {
  const { data } = await supabase.from('participations').select('work_id').eq('id', participationId).maybeSingle();
  const wid = (data as { work_id: string } | null)?.work_id;
  if (!wid) return null;
  return (await workRefs([wid])).get(wid) ?? null;
}

export async function unreadMessages(userId: string): Promise<number | null> {
  const { count, error } = await supabase.from('messages').select('id', { count: 'exact', head: true }).is('read_at', null).neq('sender_id', userId);
  return error ? null : count ?? 0;
}
