// Lógica pura de mensajería (sin red ni DOM): bandeja, no leídos, validación y errores amables.
import type { Conversation, ContactKind, I18nText, Lang, Message, ProfilePublic } from '$lib/types';
import { LIMITS } from '$lib/types';

export const CONTACT_KINDS: readonly ContactKind[] = ['commission', 'purchase', 'license', 'collaboration', 'other'];
export const SUBJECT_MAX = 120;

/** Tipo de consulta por defecto: compra si el contacto parte de una obra. */
export function defaultKind(workId: string | null | undefined): ContactKind {
  return workId ? 'purchase' : 'commission';
}

export type MessageProblem = 'empty' | 'tooLong' | null;

export function validateBody(body: string): MessageProblem {
  const n = body.trim().length;
  if (n === 0) return 'empty';
  if (body.length > LIMITS.messageMaxChars) return 'tooLong';
  return null;
}

export function validateSubject(subject: string): 'empty' | 'tooLong' | null {
  const n = subject.trim().length;
  if (n === 0) return 'empty';
  if (n > SUBJECT_MAX) return 'tooLong';
  return null;
}

/** Texto corto de una sola línea para la bandeja. */
export function excerpt(text: string, max = 90): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

export function otherPartyId(conv: Pick<Conversation, 'sender_id' | 'recipient_id'>, me: string): string {
  return conv.sender_id === me ? conv.recipient_id : conv.sender_id;
}

/** ¿La conversación aparece en mi bandeja? (participo y no la he borrado) */
export function isInMyInbox(conv: Conversation, me: string): boolean {
  if (conv.sender_id === me) return !conv.deleted_by_sender;
  if (conv.recipient_id === me) return !conv.deleted_by_recipient;
  return false;
}

/** Columna que hay que poner a true para borrar la conversación solo para mí. */
export function deletedColumn(conv: Pick<Conversation, 'sender_id'>, me: string): 'deleted_by_sender' | 'deleted_by_recipient' {
  return conv.sender_id === me ? 'deleted_by_sender' : 'deleted_by_recipient';
}

/** Mensajes recibidos (no míos) sin leer. */
export function unreadMessages(messages: readonly Message[], me: string): Message[] {
  return messages.filter((m) => m.sender_id !== me && !m.read_at);
}

export function countUnread(messages: readonly Message[], me: string): number {
  return unreadMessages(messages, me).length;
}

/** Número de no leídos por conversación. */
export function unreadByConversation(messages: readonly Message[], me: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of unreadMessages(messages, me)) out.set(m.conversation_id, (out.get(m.conversation_id) ?? 0) + 1);
  return out;
}

/** Último mensaje de cada conversación. */
export function lastMessages(messages: readonly Message[]): Map<string, Message> {
  const out = new Map<string, Message>();
  for (const m of messages) {
    const cur = out.get(m.conversation_id);
    if (!cur || cur.created_at < m.created_at) out.set(m.conversation_id, m);
  }
  return out;
}

export interface InboxItem {
  conversation: Conversation;
  other: ProfilePublic | null;
  work: { id: string; short_id: string; title: I18nText; lang: Lang } | null;
  preview: string;
  lastFromMe: boolean;
  unread: number;
}

export interface InboxWork { id: string; short_id: string; title: I18nText; lang: Lang }

/** Agrupa conversaciones, perfiles, obras y mensajes en filas de bandeja, ordenadas por última actividad. */
export function buildInbox(input: {
  me: string;
  conversations: readonly Conversation[];
  messages: readonly Message[];
  unread?: ReadonlyMap<string, number>;
  profiles: readonly ProfilePublic[];
  works: readonly InboxWork[];
}): InboxItem[] {
  const { me, conversations, messages, profiles, works } = input;
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const workById = new Map(works.map((w) => [w.id, w]));
  const last = lastMessages(messages);
  const unread = input.unread ?? unreadByConversation(messages, me);
  return conversations
    .filter((c) => isInMyInbox(c, me))
    .map((c): InboxItem => {
      const lm = last.get(c.id);
      return {
        conversation: c,
        other: profileById.get(otherPartyId(c, me)) ?? null,
        work: c.work_id ? (workById.get(c.work_id) ?? null) : null,
        preview: lm ? excerpt(lm.body) : '',
        lastFromMe: lm ? lm.sender_id === me : false,
        unread: unread.get(c.id) ?? 0
      };
    })
    .sort((a, b) => (a.conversation.last_message_at < b.conversation.last_message_at ? 1 : -1));
}

/** Añade o sustituye un mensaje en una lista ordenada por fecha (para eventos en tiempo real). */
export function mergeMessage(list: readonly Message[], msg: Message): Message[] {
  const without = list.filter((m) => m.id !== msg.id);
  without.push(msg);
  return without.sort((a, b) => (a.created_at === b.created_at ? 0 : a.created_at < b.created_at ? -1 : 1));
}

export type ContactErrorKey =
  | 'contact.err.limit' | 'contact.err.notAccepting' | 'contact.err.self'
  | 'contact.err.suspended' | 'contact.err.noProfile' | 'contact.err.auth' | 'contact.err.generic';

/** Traduce el mensaje de error de una RPC a una clave de interfaz amable. */
export function friendlyContactError(message: string | null | undefined): ContactErrorKey {
  const m = (message ?? '').toLowerCase();
  if (/rate.?limit|too many|per hour|por hora|l[ií]mite|limit exceeded|demasiad/.test(m)) return 'contact.err.limit';
  if (/does not accept|not accept|no acepta|not available for|no admite/.test(m)) return 'contact.err.notAccepting';
  if (/yourself|oneself|a ti mism|s[ií] mism/.test(m)) return 'contact.err.self';
  if (/suspend/.test(m)) return 'contact.err.suspended';
  if (/profile|perfil/.test(m)) return 'contact.err.noProfile';
  if (/jwt|not authenticated|unauthori|autentic|permission denied/.test(m)) return 'contact.err.auth';
  return 'contact.err.generic';
}

export function formatDateTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

/** Fecha relativa corta: hora si es hoy, fecha si no. */
export function formatShort(iso: string, lang: Lang, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameDay = d.toDateString() === now.toDateString();
  return new Intl.DateTimeFormat(lang, sameDay ? { timeStyle: 'short' } : { dateStyle: 'medium' }).format(d);
}

/** Elige un texto traducible con fallback al otro idioma (versión pura, sin depender de la ruta). */
export function pickText(text: I18nText | null | undefined, lang: Lang): string {
  if (!text) return '';
  const order: Lang[] = lang === 'es' ? ['es', 'en'] : ['en', 'es'];
  for (const l of order) {
    const v = text[l];
    if (v && v.trim()) return v;
  }
  return '';
}
