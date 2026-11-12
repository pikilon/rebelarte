import { describe, expect, it } from 'vitest';
import dict from './dict/public';

describe('dict/public', () => {
  it('es y en tienen las mismas claves, todas con prefijo public. y sin textos vacíos', () => {
    expect(Object.keys(dict.en).sort()).toEqual(Object.keys(dict.es).sort());
    for (const lang of ['es', 'en'] as const) {
      for (const [k, v] of Object.entries(dict[lang])) {
        expect(k.startsWith('public.')).toBe(true);
        expect(v.trim().length, k).toBeGreaterThan(0);
      }
    }
  });
  it('las variables {x} coinciden entre idiomas', () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
    for (const k of Object.keys(dict.es)) expect(vars(dict.en[k]), k).toBe(vars(dict.es[k]));
  });
  it('legal: cada página tiene todas sus secciones', () => {
    const counts = { aviso: 6, condiciones: 8, privacidad: 7 };
    for (const [p, n] of Object.entries(counts)) {
      expect(dict.es[`public.legal.${p}.title`]).toBeTruthy();
      expect(dict.en[`public.legal.${p}.title`]).toBeTruthy();
      for (let i = 1; i <= n; i++) {
        expect(dict.es[`public.legal.${p}.${i}.t`], `es.${p}.${i}`).toBeTruthy();
        expect(dict.es[`public.legal.${p}.${i}.p`], `es.${p}.${i}`).toBeTruthy();
        expect(dict.en[`public.legal.${p}.${i}.t`], `en.${p}.${i}`).toBeTruthy();
        expect(dict.en[`public.legal.${p}.${i}.p`], `en.${p}.${i}`).toBeTruthy();
      }
    }
  });
});
