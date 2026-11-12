import { describe, expect, it } from 'vitest';
import type { Attachment, CvEntry } from '$lib/types';
import {
  aspectCss, firstRow, formatBytes, formatDate, formatDateRange, formatDuration, groupByBranch,
  groupCvEntries, isBranch, pickCover, searchHref, snippet
} from './publicUtils';

const att = (o: Partial<Attachment>): Attachment => ({
  id: 'a', work_id: 'w', kind: 'image', path: 'p', thumb_path: null, mime: 'image/webp',
  size_bytes: 1, width: null, height: null, title: null, sort: 0, ...o
});

describe('formatDuration', () => {
  it('formatea mm:ss y h:mm:ss', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(3599)).toBe('59:59');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(36000)).toBe('10:00:00');
  });
  it('ignora valores inválidos', () => {
    expect(formatDuration(null)).toBe('');
    expect(formatDuration(-1)).toBe('');
    expect(formatDuration(NaN)).toBe('');
  });
});

describe('formatBytes', () => {
  it('escala unidades', () => {
    expect(formatBytes(512, 'en')).toBe('512 B');
    expect(formatBytes(1536, 'en')).toBe('1.5 KB');
    expect(formatBytes(10 * 1024 * 1024, 'en')).toBe('10 MB');
    expect(formatBytes(null)).toBe('');
  });
});

describe('formatDate', () => {
  it('no desplaza el día por zona horaria', () => {
    expect(formatDate('2020-01-01', 'en')).toBe('January 1, 2020');
    expect(formatDate('2020-03-15', 'es', 'year')).toBe('2020');
    expect(formatDate('basura', 'es')).toBe('');
    expect(formatDate(null, 'es')).toBe('');
  });
  it('compone rangos', () => {
    const since = (d: string) => `desde ${d}`;
    expect(formatDateRange('2018-09-01', '2020-06-30', 'en', since)).toBe('Sep 2018 – Jun 2020');
    expect(formatDateRange('2018-09-01', null, 'en', since)).toBe('desde Sep 2018');
    expect(formatDateRange(null, '2020-06-30', 'en', since)).toBe('Jun 2020');
    expect(formatDateRange(null, null, 'en', since)).toBe('');
    expect(formatDateRange('2018-09-01', '2018-09-20', 'en', since)).toBe('Sep 2018');
  });
});

describe('pickCover', () => {
  it('prefiere la portada elegida', () => {
    const list = [att({ id: 'a', sort: 0 }), att({ id: 'b', sort: 1 })];
    const c = pickCover({ cover_attachment_id: 'b', video_url: null }, list);
    expect(c).toMatchObject({ kind: 'image', attachment: { id: 'b' } });
  });
  it('si no hay elegida, primera imagen por sort', () => {
    const list = [att({ id: 'z', sort: 3 }), att({ id: 'pdf', kind: 'pdf', sort: 0 }), att({ id: 'y', sort: 1 })];
    const c = pickCover({ cover_attachment_id: null, video_url: null }, list);
    expect(c).toMatchObject({ kind: 'image', attachment: { id: 'y' } });
  });
  it('ignora una portada que no es imagen o ya no existe', () => {
    const list = [att({ id: 'pdf', kind: 'pdf' }), att({ id: 'i', sort: 2 })];
    expect(pickCover({ cover_attachment_id: 'pdf', video_url: null }, list)).toMatchObject({ attachment: { id: 'i' } });
    expect(pickCover({ cover_attachment_id: 'borrada', video_url: null }, list)).toMatchObject({ attachment: { id: 'i' } });
  });
  it('cae a la miniatura de vídeo y luego a nada', () => {
    const w = { cover_attachment_id: null, video_url: 'https://youtu.be/dQw4w9WgXcQ' };
    expect(pickCover(w, [att({ kind: 'audio' })])).toEqual({ kind: 'video', thumb: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' });
    expect(pickCover({ cover_attachment_id: null, video_url: null }, [])).toBeNull();
    expect(pickCover({ cover_attachment_id: null, video_url: 'https://example.com/x' }, [])).toBeNull();
  });
});

describe('aspectCss', () => {
  it('interpreta proporciones', () => {
    expect(aspectCss('4:3')).toBe('4 / 3');
    expect(aspectCss('16/9')).toBe('16 / 9');
    expect(aspectCss('2,39:1')).toBe('2.39 / 1');
    expect(aspectCss('panorámico')).toBe('16 / 9');
    expect(aspectCss(null)).toBe('16 / 9');
    expect(aspectCss('0:5')).toBe('16 / 9');
  });
});

describe('searchHref e isBranch', () => {
  it('construye la URL con filtros', () => {
    expect(searchHref('es')).toBe('/es/buscar');
    expect(searchHref('en', { q: ' mar ' })).toBe('/en/buscar?q=mar');
    expect(searchHref('es', { q: 'a b', rama: 'sonido', categoria: 'jazz' })).toBe('/es/buscar?q=a+b&rama=sonido&categoria=jazz');
    expect(searchHref('es', { categoria: 'jazz' })).toBe('/es/buscar');
  });
  it('valida ramas', () => {
    expect(isBranch('textos')).toBe(true);
    expect(isBranch('otra')).toBe(false);
    expect(isBranch(null)).toBe(false);
  });
});

describe('agrupaciones', () => {
  const e = (kind: CvEntry['kind'], sort: number, start: string | null): CvEntry => ({
    id: `${kind}${sort}`, profile_id: 'p', kind, title: { es: 'x' }, organization: null, start_date: start,
    end_date: null, description: {}, lang: 'es', visibility: 'public', sort
  });
  it('ordena grupos y entradas', () => {
    const g = groupCvEntries([e('other', 0, null), e('experience', 1, '2010-01-01'), e('experience', 1, '2015-01-01'), e('education', 0, null)]);
    expect(g.map((x) => x.kind)).toEqual(['education', 'experience', 'other']);
    expect(g[1].entries.map((x) => x.start_date)).toEqual(['2015-01-01', '2010-01-01']);
  });
  it('agrupa por rama canónica', () => {
    const g = groupByBranch([{ branch: 'sonido' as const, n: 1 }, { branch: 'plasticas' as const, n: 2 }, { branch: 'sonido' as const, n: 3 }]);
    expect(g.map((x) => [x.branch, x.items.length])).toEqual([['plasticas', 1], ['sonido', 2]]);
  });
});

describe('snippet y firstRow', () => {
  it('recorta en límite de palabra', () => {
    expect(snippet('  hola   mundo ', 50)).toBe('hola mundo');
    const s = snippet('palabra '.repeat(40), 30);
    expect(s.length).toBeLessThanOrEqual(30);
    expect(s.endsWith('…')).toBe(true);
    expect(snippet(null)).toBe('');
  });
  it('normaliza filas de RPC', () => {
    expect(firstRow([{ a: 1 }])).toEqual({ a: 1 });
    expect(firstRow({ a: 2 })).toEqual({ a: 2 });
    expect(firstRow([])).toBeNull();
    expect(firstRow(null)).toBeNull();
  });
});
