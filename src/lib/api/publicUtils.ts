// Funciones puras de las páginas públicas (sin acceso a red ni al DOM): fáciles de probar.
import { BRANCHES } from '$lib/types';
import type { Attachment, BranchId, CvEntry, CvEntryKind, Lang, Work } from '$lib/types';
import { videoThumb } from '$lib/media/embed';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Duración en segundos → «mm:ss» o «h:mm:ss». Cadena vacía si no hay valor válido. */
export function formatDuration(total: number | null | undefined): string {
  if (total == null || !Number.isFinite(total) || total < 0) return '';
  const s = Math.floor(total);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(sec)}` : `${pad2(m)}:${pad2(sec)}`;
}

/** Tamaño de archivo legible («1,4 MB»). */
export function formatBytes(bytes: number | null | undefined, lang: Lang = 'es'): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const n = v.toLocaleString(lang, { maximumFractionDigits: i === 0 ? 0 : 1 });
  return `${n} ${units[i]}`;
}

/** Fecha ISO (YYYY-MM-DD o YYYY-MM-DDTHH…) → texto. Se interpreta en UTC para no desplazar el día. */
export function formatDate(value: string | null | undefined, lang: Lang, precision: 'day' | 'month' | 'year' = 'day'): string {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return '';
  const opts: Intl.DateTimeFormatOptions =
    precision === 'year' ? { year: 'numeric' }
    : precision === 'month' ? { year: 'numeric', month: 'short' }
    : { year: 'numeric', month: 'long', day: 'numeric' };
  return new Intl.DateTimeFormat(lang, { ...opts, timeZone: 'UTC' }).format(d);
}

/** Rango de fechas de una entrada de CV. `since` compone «desde …» cuando solo hay inicio. */
export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
  lang: Lang,
  since: (date: string) => string
): string {
  const a = formatDate(start, lang, 'month');
  const b = formatDate(end, lang, 'month');
  if (a && b) return a === b ? a : `${a} – ${b}`;
  if (a) return since(a);
  return b;
}

export type Cover =
  | { kind: 'image'; attachment: Attachment }
  | { kind: 'video'; thumb: string }
  | null;

/**
 * Imagen representativa (docs/arquitectura.md §4): la elegida (si es una imagen),
 * si no la primera imagen por `sort`, si no la miniatura del vídeo, si no nada (placeholder de rama).
 */
export function pickCover(
  work: Pick<Work, 'cover_attachment_id' | 'video_url'>,
  attachments: Attachment[]
): Cover {
  const images = attachments
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.kind === 'image')
    .sort((x, y) => x.a.sort - y.a.sort || x.i - y.i)
    .map(({ a }) => a);
  const chosen = work.cover_attachment_id ? images.find((a) => a.id === work.cover_attachment_id) : undefined;
  const first = chosen ?? images[0];
  if (first) return { kind: 'image', attachment: first };
  const thumb = videoThumb(work.video_url);
  return thumb ? { kind: 'video', thumb } : null;
}

/** «16:9», «16/9», «4 : 3» → valor para CSS `aspect-ratio`. Por defecto 16 / 9. */
export function aspectCss(raw: string | null | undefined): string {
  const m = raw ? /^\s*(\d{1,3}(?:[.,]\d+)?)\s*[:/x]\s*(\d{1,3}(?:[.,]\d+)?)\s*$/i.exec(raw) : null;
  if (!m) return '16 / 9';
  const a = Number(m[1].replace(',', '.'));
  const b = Number(m[2].replace(',', '.'));
  return a > 0 && b > 0 ? `${a} / ${b}` : '16 / 9';
}

export function isBranch(v: unknown): v is BranchId {
  return typeof v === 'string' && (BRANCHES as readonly string[]).includes(v);
}

/** URL de búsqueda con filtros (`categoria` = slug de la categoría; solo tiene sentido con rama). */
export function searchHref(lang: Lang, f: { q?: string; rama?: BranchId | null; categoria?: string | null } = {}): string {
  const p = new URLSearchParams();
  if (f.q?.trim()) p.set('q', f.q.trim());
  if (f.rama) {
    p.set('rama', f.rama);
    if (f.categoria) p.set('categoria', f.categoria);
  }
  const qs = p.toString();
  return `/${lang}/buscar${qs ? `?${qs}` : ''}`;
}

export const CV_KIND_ORDER: readonly CvEntryKind[] = ['education', 'course', 'degree', 'experience', 'skill', 'material', 'other'];

/** Agrupa las entradas del CV por tipo, en el orden de presentación; dentro de cada grupo, por `sort` y fecha reciente. */
export function groupCvEntries(entries: CvEntry[]): { kind: CvEntryKind; entries: CvEntry[] }[] {
  return CV_KIND_ORDER.map((kind) => ({
    kind,
    entries: entries
      .filter((e) => e.kind === kind)
      .sort((a, b) => a.sort - b.sort || (b.start_date ?? '').localeCompare(a.start_date ?? ''))
  })).filter((g) => g.entries.length > 0);
}

/** Agrupa por rama en el orden canónico de BRANCHES, sin ramas vacías. */
export function groupByBranch<T extends { branch: BranchId }>(items: T[]): { branch: BranchId; items: T[] }[] {
  return BRANCHES.map((branch) => ({ branch, items: items.filter((i) => i.branch === branch) })).filter((g) => g.items.length > 0);
}

/** Texto plano corto para meta description. */
export function snippet(text: string | null | undefined, max = 160): string {
  const s = (text ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
}

/** Normaliza una respuesta de RPC que puede venir como objeto, como array o vacía. */
export function firstRow<T>(data: T | T[] | null | undefined): T | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}
