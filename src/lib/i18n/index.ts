// i18n mínimo sin dependencias. La interfaz usa t('clave'); el contenido jsonb usa tr().
import { page } from '$app/state';
import type { I18nText, Lang } from '$lib/types';
import es from './es';
import en from './en';

export const LANGS = ['es', 'en'] as const;
export const DEFAULT_LANG: Lang = 'es';

// Diccionarios por área: cada archivo de ./dict exporta { es: {...}, en: {...} }.
// Un archivo por área evita conflictos entre quienes trabajan en paralelo.
const areas = import.meta.glob<{ default: Record<Lang, Record<string, string>> }>(['./dict/*.ts', '!./dict/*.test.ts'], { eager: true });
const dicts: Record<Lang, Record<string, string>> = { es: { ...es }, en: { ...en } };
for (const mod of Object.values(areas)) {
  Object.assign(dicts.es, mod.default.es);
  Object.assign(dicts.en, mod.default.en);
}

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as readonly string[]).includes(v);
}

/** Idioma actual a partir de la URL (/es/… o /en/…). */
export function currentLang(): Lang {
  const l = page.params?.lang;
  return isLang(l) ? l : DEFAULT_LANG;
}

/** Traduce una clave de interfaz. Sustituye {nombre} con vars. Cae a español y luego a la clave. */
export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let s = dicts[lang][key] ?? dicts.es[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function t(key: string, vars?: Record<string, string | number>): string {
  return translate(currentLang(), key, vars);
}

/**
 * Texto de contenido en el idioma pedido con fallback al idioma de origen.
 * fallback = true cuando se muestra otro idioma (la interfaz debe avisar).
 */
export function trText(
  text: I18nText | null | undefined,
  lang: Lang,
  origin?: Lang
): { text: string; lang: Lang | null; fallback: boolean } {
  if (!text) return { text: '', lang: null, fallback: false };
  const own = text[lang];
  if (own && own.trim()) return { text: own, lang, fallback: false };
  const order: Lang[] = origin ? [origin, ...LANGS.filter((l) => l !== origin)] : [...LANGS];
  for (const l of order) {
    const v = text[l];
    if (v && v.trim()) return { text: v, lang: l, fallback: true };
  }
  return { text: '', lang: null, fallback: false };
}

/** Atajo: solo la cadena. */
export function tr(text: I18nText | null | undefined, origin?: Lang): string {
  return trText(text, currentLang(), origin).text;
}

/** Idioma preferido del navegador entre los soportados. */
export function browserLang(): Lang {
  if (typeof navigator === 'undefined') return DEFAULT_LANG;
  for (const l of navigator.languages ?? [navigator.language]) {
    const base = l.slice(0, 2).toLowerCase();
    if (isLang(base)) return base;
  }
  return DEFAULT_LANG;
}
