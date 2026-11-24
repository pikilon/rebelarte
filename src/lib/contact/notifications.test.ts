import { describe, expect, it } from 'vitest';
import { countUnreadNotifications, describeNotification } from './notifications';

describe('describeNotification', () => {
  it('participación nueva con todos los datos', () => {
    const v = describeNotification(
      {
        type: 'participation_new',
        payload: { actor_name: 'Ana Ficticia', actor_alias: 'ana', work_short_id: 'Ab3dE5gH', work_title: { es: 'Mi obra', en: 'My work' } }
      },
      'en'
    );
    expect(v.key).toBe('contact.notif.participation_new');
    expect(v.actor).toBe('Ana Ficticia');
    expect(v.work).toBe('My work');
    expect(v.href).toBe('/en/obra/Ab3dE5gH/my-work');
  });
  it('usa alias si no hay nombre y tolera payload vacío', () => {
    expect(describeNotification({ type: 'participation_rejected', payload: { actor_alias: 'ana' } }, 'es').actor).toBe('ana');
    const v = describeNotification({ type: 'participation_withdrawn', payload: {} }, 'es');
    expect(v.actor).toBeNull();
    expect(v.work).toBeNull();
    expect(v.href).toBe('/es/mi/participaciones');
  });
  it('mensaje nuevo enlaza a la conversación', () => {
    expect(describeNotification({ type: 'message_new', payload: { conversation_id: 'c-1' } }, 'es').href).toBe('/es/mi/mensajes/c-1');
    expect(describeNotification({ type: 'message_new', payload: {} }, 'es').href).toBe('/es/mi/mensajes');
  });
  it('moderación enlaza a la obra si hay', () => {
    expect(describeNotification({ type: 'moderation', payload: { work_short_id: 'zzzzzzzz' } }, 'es').href).toBe('/es/obra/zzzzzzzz');
    expect(describeNotification({ type: 'moderation', payload: {} }, 'es').href).toBeNull();
  });
  it('tipo desconocido y payload raro', () => {
    // @ts-expect-error tipo no previsto
    const v = describeNotification({ type: 'otra', payload: null }, 'es');
    expect(v.key).toBe('contact.notif.unknown');
    expect(v.href).toBeNull();
  });
  it('título como cadena suelta', () => {
    expect(describeNotification({ type: 'participation_invited', payload: { work_title: 'Solo texto' } }, 'es').work).toBe('Solo texto');
  });
  it('cuenta no leídas', () => {
    expect(countUnreadNotifications([{ read_at: null }, { read_at: 'x' }, { read_at: null }])).toBe(2);
  });
});
