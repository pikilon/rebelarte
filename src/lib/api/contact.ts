// Acceso a datos de mensajería y notificaciones (contrato: docs/arquitectura.md §4).
import { supabase, unwrap } from '$lib/supabase';
import type {
  ContactKind, Conversation, Message, Notification as Notif, ProfilePublic, Lang, I18nText
} from '$lib/types';
import { buildInbox, deletedColumn, unreadByConversation, type InboxItem, type InboxWork } from '$lib/contact/logic';

const UNREAD_EVENT = 'rebelarte:unread';

/** Avisa a los indicadores de no leídos de que deben recontar. */
export function notifyUnreadChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(UNREAD_EVENT));
}
export function onUnreadChanged(fn: () => void): () => void {
  window.addEventListener(UNREAD_EVENT, fn);
  return () => window.removeEventListener(UNREAD_EVENT, fn);
}

export async function startConversation(args: {
  recipientId: string; kind: ContactKind; subject: string; body: string; workId: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc('start_conversation', {
    p_recipient_id: args.recipientId,
    p_kind: args.kind,
    p_subject: args.subject.trim(),
    p_body: args.body.trim(),
    p_work_id: args.workId
  });
  if (error) throw error;
  return data as string;
}

export async function sendMessage(conversationId: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('send_message', { p_conversation_id: conversationId, p_body: body.trim() });
  if (error) throw error;
}

const PROFILE_COLS = 'id, alias, short_id, display_name, lang, headline, avatar_path, accepts_commissions, sells_works, role, created_at';

export async function fetchProfiles(ids: string[]): Promise<ProfilePublic[]> {
  const uniq = [...new Set(ids)];
  if (!uniq.length) return [];
  return unwrap(await supabase.from('profiles_public').select(PROFILE_COLS).in('id', uniq)) as ProfilePublic[];
}

export async function fetchWorkBasics(ids: string[]): Promise<InboxWork[]> {
  const uniq = [...new Set(ids)];
  if (!uniq.length) return [];
  // Si la obra ya no es visible, RLS la omite y la bandeja muestra la conversación sin obra.
  const { data } = await supabase.from('works').select('id, short_id, title, lang').in('id', uniq);
  return (data ?? []) as { id: string; short_id: string; title: I18nText; lang: Lang }[];
}

/** Bandeja: conversaciones propias no borradas, con la otra parte, obra, extracto y no leídos. */
export async function loadInbox(me: string): Promise<InboxItem[]> {
  const convs = unwrap(
    await supabase
      .from('conversations')
      .select('*')
      .or(`and(sender_id.eq.${me},deleted_by_sender.eq.false),and(recipient_id.eq.${me},deleted_by_recipient.eq.false)`)
      .order('last_message_at', { ascending: false })
      .limit(200)
  ) as Conversation[];
  if (!convs.length) return [];
  const ids = convs.map((c) => c.id);

  const [recent, unreadRows, profiles, works] = await Promise.all([
    supabase.from('messages').select('*').in('conversation_id', ids).order('created_at', { ascending: false }).limit(400),
    supabase.from('messages').select('id, conversation_id, sender_id, read_at').in('conversation_id', ids).neq('sender_id', me).is('read_at', null),
    fetchProfiles(convs.flatMap((c) => [c.sender_id, c.recipient_id]).filter((id) => id !== me)),
    fetchWorkBasics(convs.map((c) => c.work_id).filter((id): id is string => !!id))
  ]);
  if (recent.error) throw recent.error;
  const messages = (recent.data ?? []) as Message[];
  const unread = unreadByConversation((unreadRows.data ?? []) as Message[], me);
  return buildInbox({ me, conversations: convs, messages, unread, profiles, works });
}

export async function loadConversation(id: string): Promise<Conversation | null> {
  const { data, error } = await supabase.from('conversations').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Conversation | null) ?? null;
}

export async function loadMessages(conversationId: string): Promise<Message[]> {
  return unwrap(
    await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true }).limit(500)
  ) as Message[];
}

/** Marca como leídos los mensajes recibidos de la conversación. */
export async function markConversationRead(conversationId: string, me: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', me)
    .is('read_at', null);
  if (error) throw error;
  notifyUnreadChanged();
}

/** Oculta la conversación solo para mí (el otro participante la conserva). */
export async function deleteConversationForMe(conv: Conversation, me: string): Promise<void> {
  const col = deletedColumn(conv, me);
  const { error } = await supabase.from('conversations').update({ [col]: true }).eq('id', conv.id);
  if (error) throw error;
  notifyUnreadChanged();
}

/** Suscripción a mensajes nuevos de una conversación. Devuelve la función de limpieza. */
export function subscribeMessages(conversationId: string, onInsert: (m: Message) => void): () => void {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => onInsert(payload.new as Message)
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Mensajes recibidos sin leer (RLS limita a mis conversaciones). */
export async function countUnreadMessages(me: string): Promise<number> {
  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .neq('sender_id', me)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

// ---- Notificaciones ----

export const NOTIFICATIONS_PAGE = 20;

export async function loadNotifications(me: string, offset = 0, size = NOTIFICATIONS_PAGE): Promise<Notif[]> {
  return unwrap(
    await supabase.from('notifications').select('*').eq('user_id', me).order('created_at', { ascending: false }).range(offset, offset + size - 1)
  ) as Notif[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null);
  if (error) throw error;
  notifyUnreadChanged();
}

export async function markAllNotificationsRead(me: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', me).is('read_at', null);
  if (error) throw error;
  notifyUnreadChanged();
}

export async function countUnreadNotifications(me: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', me)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}
