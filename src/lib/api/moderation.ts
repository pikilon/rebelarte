// Acceso a datos de denuncias y moderación (contrato: docs/arquitectura.md §4).
import { supabase, unwrap } from '$lib/supabase';
import type { Award, I18nText, Lang, ModerationAction, ProfilePublic, Report, ReportReason, ReportTarget } from '$lib/types';
import { idsByTarget, moderateArgs, reportKey, type ActionSpec } from '$lib/moderation/logic';
import { excerpt } from '$lib/contact/logic';

export async function createReport(args: {
  reporterId: string; targetType: ReportTarget; targetId: string; reason: ReportReason; details: string;
}): Promise<void> {
  const { error } = await supabase.from('reports').insert({
    reporter_id: args.reporterId,
    target_type: args.targetType,
    target_id: args.targetId,
    reason: args.reason,
    details: args.details.trim() || null
  });
  if (error) throw error;
}

export async function moderate(spec: Pick<ActionSpec, 'action' | 'targetType' | 'targetId'>, note: string, reportId: string | null): Promise<void> {
  const { error } = await supabase.rpc('moderate', moderateArgs(spec, note, reportId));
  if (error) throw error;
}

export const PAGE = 25;

export async function listOpenReports(offset = 0, size = PAGE): Promise<Report[]> {
  return unwrap(
    await supabase.from('reports').select('*').eq('status', 'open').order('created_at', { ascending: true }).range(offset, offset + size - 1)
  ) as Report[];
}

/** Objetivo de una denuncia o acción, resuelto a algo legible. */
export interface ResolvedTarget {
  type: ReportTarget;
  id: string;
  /** false si no se pudo leer (borrado o sin permiso). */
  found: boolean;
  title: I18nText | null;
  titleLang: Lang | null;
  text: string | null;
  workShortId: string | null;
  alias: string | null;
  /** Autor del objetivo (subidor, emisor), para poder suspenderlo. */
  ownerId: string | null;
  ownerAlias: string | null;
  status: string | null;
  extra: string | null;
}

interface WorkRow { id: string; short_id: string; title: I18nText; lang: Lang; status: string; uploader_id: string }

export async function resolveTargets(
  items: readonly { target_type: ReportTarget; target_id: string }[],
  extraProfileIds: string[] = []
): Promise<{ targets: Map<string, ResolvedTarget>; profiles: Map<string, ProfilePublic> }> {
  const ids = idsByTarget(items);
  const [attachments, messages, awards] = await Promise.all([
    ids.attachment.length
      ? supabase.from('attachments').select('id, work_id, kind, title').in('id', ids.attachment)
      : Promise.resolve({ data: [] as { id: string; work_id: string; kind: string; title: string | null }[] }),
    ids.message.length
      ? supabase.from('messages').select('id, sender_id, body').in('id', ids.message)
      : Promise.resolve({ data: [] as { id: string; sender_id: string; body: string }[] }),
    ids.award.length
      ? supabase.from('awards').select('id, name, year, organization, verified, lang').in('id', ids.award)
      : Promise.resolve({ data: [] as Pick<Award, 'id' | 'name' | 'year' | 'organization' | 'verified' | 'lang'>[] })
  ]);
  const attRows = (attachments.data ?? []) as { id: string; work_id: string; kind: string; title: string | null }[];
  const workIds = [...new Set([...ids.work, ...attRows.map((a) => a.work_id)])];
  const works = workIds.length
    ? (((await supabase.from('works').select('id, short_id, title, lang, status, uploader_id').in('id', workIds)).data ?? []) as WorkRow[])
    : [];
  const workById = new Map(works.map((w) => [w.id, w]));
  const msgRows = (messages.data ?? []) as { id: string; sender_id: string; body: string }[];

  const profileIds = [...new Set([
    ...ids.profile, ...works.map((w) => w.uploader_id), ...msgRows.map((m) => m.sender_id), ...extraProfileIds
  ])];
  const profileRows = profileIds.length
    ? (((await supabase.from('profiles_public').select('id, alias, short_id, display_name, lang, headline, avatar_path, accepts_commissions, sells_works, role, created_at').in('id', profileIds)).data ?? []) as ProfilePublic[])
    : [];
  const profiles = new Map(profileRows.map((p) => [p.id, p]));

  const blank = (type: ReportTarget, id: string): ResolvedTarget => ({
    type, id, found: false, title: null, titleLang: null, text: null, workShortId: null, alias: null,
    ownerId: null, ownerAlias: null, status: null, extra: null
  });
  const out = new Map<string, ResolvedTarget>();
  const workTarget = (type: ReportTarget, id: string, w: WorkRow | undefined, extra: string | null = null): ResolvedTarget => ({
    ...blank(type, id),
    found: !!w,
    title: w?.title ?? null,
    titleLang: w?.lang ?? null,
    workShortId: w?.short_id ?? null,
    ownerId: w?.uploader_id ?? null,
    ownerAlias: w ? (profiles.get(w.uploader_id)?.alias ?? null) : null,
    status: w?.status ?? null,
    extra
  });
  for (const id of ids.work) out.set(`work:${id}`, workTarget('work', id, workById.get(id)));
  for (const id of ids.attachment) {
    const a = attRows.find((x) => x.id === id);
    out.set(`attachment:${id}`, { ...workTarget('attachment', id, a ? workById.get(a.work_id) : undefined, a ? (a.title || a.kind) : null), found: !!a });
  }
  for (const id of ids.profile) {
    const p = profiles.get(id);
    out.set(`profile:${id}`, { ...blank('profile', id), found: !!p, alias: p?.alias ?? null, text: p?.display_name ?? null, ownerId: p?.id ?? null, ownerAlias: p?.alias ?? null });
  }
  for (const id of ids.message) {
    const m = msgRows.find((x) => x.id === id);
    out.set(`message:${id}`, { ...blank('message', id), found: !!m, text: m ? excerpt(m.body, 240) : null, ownerId: m?.sender_id ?? null, ownerAlias: m ? (profiles.get(m.sender_id)?.alias ?? null) : null });
  }
  for (const id of ids.award) {
    const a = ((awards.data ?? []) as { id: string; name: I18nText; year: number | null; organization: string | null; verified: boolean; lang: Lang }[]).find((x) => x.id === id);
    out.set(`award:${id}`, {
      ...blank('award', id), found: !!a, title: a?.name ?? null, titleLang: a?.lang ?? null,
      extra: a ? [a.year, a.organization].filter(Boolean).join(' · ') : null, status: a ? (a.verified ? 'verified' : 'unverified') : null
    });
  }
  return { targets: out, profiles };
}

export function targetOf(map: Map<string, ResolvedTarget>, r: { target_type: ReportTarget; target_id: string }): ResolvedTarget | undefined {
  return map.get(reportKey(r));
}

export async function listUnverifiedAwards(offset = 0, size = PAGE): Promise<Award[]> {
  return unwrap(
    await supabase.from('awards').select('*').eq('verified', false).order('year', { ascending: false, nullsFirst: false }).range(offset, offset + size - 1)
  ) as Award[];
}

export interface HiddenWork { id: string; short_id: string; title: I18nText; lang: Lang; uploader_id: string; updated_at: string }

export async function listHiddenWorks(offset = 0, size = PAGE): Promise<HiddenWork[]> {
  return unwrap(
    await supabase.from('works').select('id, short_id, title, lang, uploader_id, updated_at').eq('status', 'hidden').order('updated_at', { ascending: false }).range(offset, offset + size - 1)
  ) as HiddenWork[];
}

export interface ModerationActionRow {
  id: string; moderator_id: string | null; target_type: ReportTarget; target_id: string;
  action: ModerationAction; note: string | null; created_at: string;
}

export async function listActions(offset = 0, size = PAGE): Promise<ModerationActionRow[]> {
  return unwrap(
    await supabase.from('moderation_actions').select('*').order('created_at', { ascending: false }).range(offset, offset + size - 1)
  ) as ModerationActionRow[];
}

export async function fetchAliases(ids: string[]): Promise<Map<string, ProfilePublic>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return new Map();
  const { data } = await supabase.from('profiles_public').select('id, alias, short_id, display_name, lang, headline, avatar_path, accepts_commissions, sells_works, role, created_at').in('id', uniq);
  return new Map(((data ?? []) as ProfilePublic[]).map((p) => [p.id, p]));
}
