import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import dict from '$lib/i18n/dict/my';

const ROOTS = [
  'src/routes/[lang=lang]/entrar',
  'src/routes/[lang=lang]/mi',
  'src/lib/components/my',
  'src/lib/api/my.ts'
];
const SKIP = ['mensajes', 'notificaciones'];

function files(p: string): string[] {
  if (statSync(p).isFile()) return [p];
  return readdirSync(p).flatMap((n) => (SKIP.includes(n) ? [] : files(join(p, n))));
}

describe('diccionario my.*', () => {
  it('es y en tienen las mismas claves', () => {
    expect(Object.keys(dict.en).sort()).toEqual(Object.keys(dict.es).sort());
  });
  it('todas las claves son my.*', () => {
    for (const k of Object.keys(dict.es)) expect(k.startsWith('my.')).toBe(true);
  });
  it('no hay valores vacíos y los marcadores {x} coinciden', () => {
    for (const [k, v] of Object.entries(dict.es)) {
      expect(v.trim(), k).not.toBe('');
      const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(vars(dict.en[k]), k).toEqual(vars(v));
    }
  });
  it('las claves literales usadas en el código existen', () => {
    const used = new Set<string>();
    for (const root of ROOTS) {
      for (const f of files(root)) {
        if (!/\.(svelte|ts)$/.test(f) || f.endsWith('.test.ts')) continue;
        for (const m of readFileSync(f, 'utf8').matchAll(/'(my\.[A-Za-z0-9_.]+)'/g)) used.add(m[1]);
      }
    }
    const missing = [...used].filter((k) => !(k in dict.es));
    expect(missing).toEqual([]);
  });
  it('las claves dinámicas cubren todos los valores', () => {
    const want: Record<string, string[]> = {
      'my.att.kind.': ['image', 'pdf', 'zip', 'audio'],
      'my.att.stage.': ['processing', 'uploading', 'saving', 'done'],
      'my.cv.kind.': ['education', 'course', 'degree', 'experience', 'skill', 'material', 'other'],
      'my.part.status.': ['pending', 'accepted', 'rejected', 'withdrawn'],
      'my.welcome.alias.': ['empty', 'format', 'reserved'],
      'my.work.act.': ['draft', 'publish', 'keep'],
      'my.work.errField.': ['branch', 'title', 'pages', 'duration', 'videoUrl', 'audioUrl', 'date'],
      'my.work.status.': ['draft', 'review', 'published', 'hidden', 'deleted'],
      'my.work.vis.': ['public', 'unlisted', 'private', 'publicHint', 'unlistedHint', 'privateHint']
    };
    for (const [prefix, vals] of Object.entries(want)) for (const v of vals) expect(dict.es[prefix + v], prefix + v).toBeTruthy();
  });
});
