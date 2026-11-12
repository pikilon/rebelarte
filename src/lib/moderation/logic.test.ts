import { describe, expect, it } from 'vitest';
import { actionsFor, idsByTarget, isDestructive, moderateArgs, reportKey, validateNote, validateReport } from './logic';

describe('validateReport', () => {
  it('motivo obligatorio', () => expect(validateReport('', '')).toBe('reason'));
  it('otros exige detalles', () => {
    expect(validateReport('other', ' ')).toBe('details');
    expect(validateReport('other', 'Explicación')).toBe(null);
  });
  it('resto sin detalles vale', () => expect(validateReport('spam', '')).toBe(null));
  it('detalles demasiado largos', () => expect(validateReport('spam', 'x'.repeat(2001))).toBe('tooLong'));
});

describe('validateNote', () => {
  it('obligatoria', () => {
    expect(validateNote('  ')).toBe('empty');
    expect(validateNote('ok!')).toBe(null);
    expect(validateNote('x'.repeat(1001))).toBe('tooLong');
  });
});

describe('actionsFor', () => {
  it('obra: ocultar, restaurar, eliminar, suspender subidor y descartar', () => {
    const a = actionsFor('work', 'w1', 'u1');
    expect(a.map((x) => x.action)).toEqual(['hide', 'restore', 'delete', 'suspend_user', 'dismiss_report']);
    expect(a[3].targetType).toBe('profile');
    expect(a[3].targetId).toBe('u1');
    expect(a[4].targetType).toBe('work');
  });
  it('perfil: suspender y reactivar sin duplicar', () => {
    expect(actionsFor('profile', 'p1', 'p1').map((x) => x.action)).toEqual(['suspend_user', 'unsuspend_user', 'dismiss_report']);
  });
  it('mensaje sin propietario conocido', () => {
    expect(actionsFor('message', 'm1').map((x) => x.action)).toEqual(['hide', 'restore', 'dismiss_report']);
  });
  it('destructivas', () => {
    expect(isDestructive('delete')).toBe(true);
    expect(isDestructive('hide')).toBe(false);
  });
});

describe('moderateArgs e ids', () => {
  it('args de RPC', () => {
    expect(moderateArgs({ action: 'hide', targetType: 'work', targetId: 'w' }, ' nota ', 'r1')).toEqual({
      p_target_type: 'work', p_target_id: 'w', p_action: 'hide', p_note: 'nota', p_report_id: 'r1'
    });
  });
  it('agrupa ids únicos', () => {
    const g = idsByTarget([
      { target_type: 'work', target_id: 'a' }, { target_type: 'work', target_id: 'a' }, { target_type: 'profile', target_id: 'p' }
    ]);
    expect(g.work).toEqual(['a']);
    expect(g.profile).toEqual(['p']);
    expect(g.award).toEqual([]);
    expect(reportKey({ target_type: 'work', target_id: 'a' })).toBe('work:a');
  });
});
