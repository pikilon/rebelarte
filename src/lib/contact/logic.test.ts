import { describe, expect, it } from 'vitest';
import type { Conversation, Message, ProfilePublic } from '$lib/types';
import { LIMITS } from '$lib/types';
import {
  buildInbox, countUnread, defaultKind, deletedColumn, excerpt, friendlyContactError, isInMyInbox,
  lastMessages, mergeMessage, otherPartyId, pickText, unreadByConversation, validateBody, validateSubject
} from './logic';

const ME = 'u-me';
const conv = (o: Partial<Conversation>): Conversation => ({
  id: 'c1', recipient_id: 'u-b', sender_id: ME, work_id: null, kind: 'commission', subject: 's',
  created_at: '2026-01-01T10:00:00Z', last_message_at: '2026-01-01T10:00:00Z',
  deleted_by_sender: false, deleted_by_recipient: false, ...o
});
const msg = (o: Partial<Message>): Message => ({
  id: 'm1', conversation_id: 'c1', sender_id: 'u-b', body: 'hola', created_at: '2026-01-01T10:00:00Z', read_at: null, ...o
});
const profile = (id: string): ProfilePublic => ({
  id, alias: `a-${id}`, short_id: 'abcdefgh', display_name: `N ${id}`, lang: 'es', headline: {}, avatar_path: null,
  accepts_commissions: true, sells_works: false, role: 'user', created_at: '2026-01-01T00:00:00Z'
});

describe('validación', () => {
  it('mensaje vacío, correcto y demasiado largo', () => {
    expect(validateBody('   ')).toBe('empty');
    expect(validateBody('hola')).toBe(null);
    expect(validateBody('x'.repeat(LIMITS.messageMaxChars + 1))).toBe('tooLong');
    expect(validateBody('x'.repeat(LIMITS.messageMaxChars))).toBe(null);
  });
  it('asunto', () => {
    expect(validateSubject('')).toBe('empty');
    expect(validateSubject('a'.repeat(121))).toBe('tooLong');
    expect(validateSubject('Cartel')).toBe(null);
  });
  it('tipo por defecto', () => {
    expect(defaultKind('w1')).toBe('purchase');
    expect(defaultKind(null)).toBe('commission');
  });
  it('extracto', () => {
    expect(excerpt('a  b\n c')).toBe('a b c');
    expect(excerpt('x'.repeat(200), 10)).toHaveLength(10);
  });
});

describe('bandeja', () => {
  it('otra parte y borrado para mí', () => {
    expect(otherPartyId(conv({}), ME)).toBe('u-b');
    expect(otherPartyId(conv({ sender_id: 'u-b', recipient_id: ME }), ME)).toBe('u-b');
    expect(deletedColumn(conv({}), ME)).toBe('deleted_by_sender');
    expect(deletedColumn(conv({ sender_id: 'u-b', recipient_id: ME }), ME)).toBe('deleted_by_recipient');
  });
  it('visibilidad en bandeja', () => {
    expect(isInMyInbox(conv({}), ME)).toBe(true);
    expect(isInMyInbox(conv({ deleted_by_sender: true }), ME)).toBe(false);
    expect(isInMyInbox(conv({ sender_id: 'u-b', recipient_id: ME, deleted_by_sender: true }), ME)).toBe(true);
    expect(isInMyInbox(conv({ sender_id: 'x', recipient_id: 'y' }), ME)).toBe(false);
  });
  it('no leídos: solo recibidos sin read_at', () => {
    const ms = [
      msg({ id: 'a' }), msg({ id: 'b', read_at: '2026-01-02T00:00:00Z' }),
      msg({ id: 'c', sender_id: ME }), msg({ id: 'd', conversation_id: 'c2' })
    ];
    expect(countUnread(ms, ME)).toBe(2);
    expect(unreadByConversation(ms, ME).get('c1')).toBe(1);
    expect(unreadByConversation(ms, ME).get('c2')).toBe(1);
  });
  it('último mensaje por conversación', () => {
    const ms = [msg({ id: 'a', created_at: '2026-01-01T10:00:00Z' }), msg({ id: 'b', created_at: '2026-01-01T11:00:00Z' })];
    expect(lastMessages(ms).get('c1')?.id).toBe('b');
  });
  it('buildInbox ordena, filtra borradas y compone', () => {
    const cs = [
      conv({ id: 'old', last_message_at: '2026-01-01T00:00:00Z' }),
      conv({ id: 'new', recipient_id: 'u-c', work_id: 'w1', last_message_at: '2026-02-01T00:00:00Z' }),
      conv({ id: 'del', deleted_by_sender: true, last_message_at: '2026-03-01T00:00:00Z' })
    ];
    const ms = [
      msg({ id: '1', conversation_id: 'old', sender_id: ME, body: 'yo' }),
      msg({ id: '2', conversation_id: 'new', sender_id: 'u-c', body: 'respuesta' })
    ];
    const inbox = buildInbox({
      me: ME, conversations: cs, messages: ms, profiles: [profile('u-b'), profile('u-c')],
      works: [{ id: 'w1', short_id: 'sssssss1', title: { es: 'Obra' }, lang: 'es' }]
    });
    expect(inbox.map((i) => i.conversation.id)).toEqual(['new', 'old']);
    expect(inbox[0].unread).toBe(1);
    expect(inbox[0].work?.short_id).toBe('sssssss1');
    expect(inbox[0].other?.id).toBe('u-c');
    expect(inbox[1].lastFromMe).toBe(true);
    expect(inbox[1].unread).toBe(0);
  });
  it('mergeMessage evita duplicados y ordena', () => {
    const a = msg({ id: 'a', created_at: '2026-01-01T10:00:00Z' });
    const b = msg({ id: 'b', created_at: '2026-01-01T09:00:00Z' });
    expect(mergeMessage([a], b).map((m) => m.id)).toEqual(['b', 'a']);
    expect(mergeMessage([a], { ...a, read_at: 'x' })).toHaveLength(1);
  });
});

describe('errores amables', () => {
  it('detecta límite por hora', () => {
    expect(friendlyContactError('rate limit exceeded: max 5 conversations per hour')).toBe('contact.err.limit');
    expect(friendlyContactError('Límite de mensajes por hora alcanzado')).toBe('contact.err.limit');
  });
  it('otros casos', () => {
    expect(friendlyContactError('recipient does not accept commissions')).toBe('contact.err.notAccepting');
    expect(friendlyContactError('cannot message yourself')).toBe('contact.err.self');
    expect(friendlyContactError('JWT expired')).toBe('contact.err.auth');
    expect(friendlyContactError('boom')).toBe('contact.err.generic');
    expect(friendlyContactError(undefined)).toBe('contact.err.generic');
  });
});

describe('pickText', () => {
  it('cae al otro idioma', () => {
    expect(pickText({ es: 'Hola' }, 'en')).toBe('Hola');
    expect(pickText({ es: 'Hola', en: 'Hi' }, 'en')).toBe('Hi');
    expect(pickText(null, 'es')).toBe('');
  });
});
