// Constructores de URL. Úsalos siempre en vez de componer rutas a mano.
import type { BranchId, Lang } from '$lib/types';

export const RESERVED_ALIASES = [
  'buscar', 'rama', 'obra', 'entrar', 'mi', 'moderacion', 'legal', 'admin', 'api',
  'c', 'o', 'es', 'en', 'static', '_app', 'share'
] as const;

export const ALIAS_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export const url = {
  home: (l: Lang) => `/${l}`,
  search: (l: Lang, q = '', branch?: BranchId) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (branch) p.set('rama', branch);
    const qs = p.toString();
    return `/${l}/buscar${qs ? `?${qs}` : ''}`;
  },
  branch: (l: Lang, b: BranchId) => `/${l}/rama/${b}`,
  work: (l: Lang, shortId: string, title?: string) => {
    const slug = title ? slugify(title) : '';
    // «participantes» es una ruta fija (/obra/<id>/participantes): no puede usarse como slug.
    return `/${l}/obra/${shortId}${slug && slug !== 'participantes' ? `/${slug}` : ''}`;
  },
  workParticipants: (l: Lang, shortId: string) => `/${l}/obra/${shortId}/participantes`,
  cv: (l: Lang, alias: string) => `/${l}/${alias}`,
  gallery: (l: Lang, alias: string) => `/${l}/${alias}?vista=galeria`,
  login: (l: Lang, next?: string) => `/${l}/entrar${next ? `?next=${encodeURIComponent(next)}` : ''}`,
  my: (l: Lang, sub = '') => `/${l}/mi${sub ? `/${sub}` : ''}`,
  moderation: (l: Lang) => `/${l}/moderacion`,
  legal: (l: Lang, page: 'aviso' | 'condiciones' | 'privacidad') => `/${l}/legal/${page}`,
  /** URL estable para QR (siempre absoluta). */
  qrCv: (origin: string, shortId: string) => `${origin}/c/${shortId}`,
  qrWork: (origin: string, shortId: string) => `${origin}/o/${shortId}`
};

/** Cambia el prefijo de idioma de una ruta. */
export function switchLang(pathname: string, to: Lang): string {
  return pathname.replace(/^\/(es|en)(?=\/|$)/, `/${to}`) || `/${to}`;
}
