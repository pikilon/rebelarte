// Texto y destino de una notificación a partir de su payload (tolerante a campos ausentes).
import type { I18nText, Lang, Notification } from '$lib/types';
import { url } from '$lib/routes';
import { pickText } from './logic';

export type NotificationType = Notification['type'];

export interface NotificationView {
  /** Clave i18n del texto; el componente sustituye {actor} y {work} (con valores por defecto si faltan). */
  key: string;
  actor: string | null;
  work: string | null;
  href: string | null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function i18nText(v: unknown): I18nText | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const out: I18nText = {};
  if (str(o.es)) out.es = o.es as string;
  if (str(o.en)) out.en = o.en as string;
  return out.es || out.en ? out : null;
}

const KNOWN: readonly NotificationType[] = [
  'participation_new', 'participation_rejected', 'participation_withdrawn',
  'participation_invited', 'message_new', 'moderation'
];

export function describeNotification(n: Pick<Notification, 'type' | 'payload'>, lang: Lang): NotificationView {
  const p = (n.payload && typeof n.payload === 'object' ? n.payload : {}) as Record<string, unknown>;
  const actor = str(p.actor_name) ?? str(p.actor_alias);
  const work = pickText(i18nText(p.work_title), lang) || (typeof p.work_title === 'string' ? str(p.work_title) : null);
  const shortId = str(p.work_short_id);
  const conv = str(p.conversation_id);
  const type = (KNOWN as readonly string[]).includes(n.type) ? n.type : null;

  const workHref = shortId ? url.work(lang, shortId, work ?? undefined) : null;
  let href: string | null = null;
  if (type === 'message_new') href = conv ? url.my(lang, `mensajes/${conv}`) : url.my(lang, 'mensajes');
  else if (type === 'moderation') href = workHref;
  else if (type) href = workHref ?? url.my(lang, 'participaciones');

  return {
    key: type ? `contact.notif.${type}` : 'contact.notif.unknown',
    actor,
    work,
    href
  };
}

export function countUnreadNotifications(list: readonly Pick<Notification, 'read_at'>[]): number {
  return list.filter((n) => !n.read_at).length;
}
