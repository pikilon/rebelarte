import { describe, expect, it } from 'vitest';
import {
  dbErrorKey, aliasProblem, authErrorKey, BRANCH_FIELDS, draftToRow, emptyWorkDraft, formatDuration, isOtpCode, moveItem,
  normalizeKeywords, parseDuration, parseWorkRef, rolesForBranch, rolesToInput, safeNext, saveActions, statusPatch,
  suggestAlias, validateDraft
} from './logic';
import type { RoleCatalogItem } from '$lib/types';

describe('alias', () => {
  it('valida formato y reservados', () => {
    expect(aliasProblem('')).toBe('empty');
    expect(aliasProblem('a')).toBe('format');
    expect(aliasProblem('Ana-Perez')).toBeNull();
    expect(aliasProblem('-ana')).toBe('format');
    expect(aliasProblem('mi')).toBe('format'); // demasiado corto; reservado por regex
    expect(aliasProblem('buscar')).toBe('reserved');
    expect(aliasProblem('moderacion')).toBe('reserved');
  });
  it('sugiere alias sin acentos', () => {
    expect(suggestAlias('María  Pérez Ñu!')).toBe('maria-perez-nu');
    expect(suggestAlias('!!')).toBe('');
  });
});

describe('safeNext y códigos', () => {
  it('solo rutas internas', () => {
    expect(safeNext('/es/mi/obras')).toBe('/es/mi/obras');
    expect(safeNext('//evil.com')).toBeNull();
    expect(safeNext('https://evil.com')).toBeNull();
    expect(safeNext('/\\evil')).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
  it('código de 6 dígitos', () => {
    expect(isOtpCode(' 123456 ')).toBe(true);
    expect(isOtpCode('12345')).toBe(false);
    expect(isOtpCode('12a456')).toBe(false);
  });
  it('clasifica errores de auth', () => {
    expect(authErrorKey({ status: 429 })).toBe('my.login.err.limit');
    expect(authErrorKey({ code: 'over_email_send_rate_limit' })).toBe('my.login.err.limit');
    expect(authErrorKey({ message: 'For security purposes, you can only request this once every 60 seconds.' })).toBe('my.login.err.limit');
    expect(authErrorKey({ code: 'otp_expired', message: 'Token has expired or is invalid' })).toBe('my.login.err.code');
    expect(authErrorKey({ message: 'Email link is invalid or has expired' })).toBe('my.login.err.code');
    expect(authErrorKey({ message: 'No code verifier detected' })).toBe('my.login.err.code');
    expect(authErrorKey({ code: 'email_address_invalid' })).toBe('my.login.err.email');
    expect(authErrorKey(new Error('boom'))).toBe('my.login.err.generic');
  });
});

describe('palabras clave', () => {
  it('normaliza, deduplica y limita', () => {
    expect(normalizeKeywords('Óleo,  oleo ,  ÓLEO; retrato\nretrato')).toEqual(['óleo', 'oleo', 'retrato']);
    expect(normalizeKeywords(Array.from({ length: 30 }, (_, i) => `k${i}`))).toHaveLength(12);
    expect(normalizeKeywords([' ', ''])).toEqual([]);
  });
});

describe('referencias de obra', () => {
  it('extrae short_id', () => {
    expect(parseWorkRef('aB3dE5gH')).toBe('aB3dE5gH');
    expect(parseWorkRef('https://rebelarte.com/es/obra/aB3dE5gH/mi-obra')).toBe('aB3dE5gH');
    expect(parseWorkRef('/en/obra/aB3dE5gH/participantes')).toBe('aB3dE5gH');
    expect(parseWorkRef('https://rebelarte.com/o/aB3dE5gH')).toBe('aB3dE5gH');
    expect(parseWorkRef('https://rebelarte.com/es/ana')).toBeNull();
    expect(parseWorkRef('')).toBeNull();
  });
});

describe('duración', () => {
  it('parsea y formatea', () => {
    expect(parseDuration('1:30')).toBe(90);
    expect(parseDuration('1:02:03')).toBe(3723);
    expect(parseDuration('90')).toBe(90);
    expect(parseDuration('1:75')).toBeNull();
    expect(parseDuration('abc')).toBeNull();
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(3723)).toBe('1:02:03');
    expect(formatDuration(null)).toBe('');
  });
});

describe('cargos', () => {
  const cat: RoleCatalogItem[] = [
    { id: 1, branch: null, slug: 'autor', name: { es: 'Autor' }, sort: 1 },
    { id: 2, branch: 'sonido', slug: 'mezcla', name: { es: 'Mezcla' }, sort: 1 },
    { id: 3, branch: 'textos', slug: 'editor', name: { es: 'Editor' }, sort: 1 }
  ];
  it('filtra por rama con globales al final', () => {
    expect(rolesForBranch(cat, 'sonido').map((r) => r.id)).toEqual([2, 1]);
    expect(rolesForBranch(cat, null).map((r) => r.id)).toEqual([1]);
  });
  it('construye la entrada de RPC', () => {
    expect(rolesToInput({ roleIds: [2], others: ['  Foley  artist ', 'foley artist', ''] })).toEqual([
      { role_id: 2 }, { role_text: 'Foley artist' }
    ]);
  });
});

describe('orden', () => {
  it('mueve elementos sin salirse', () => {
    expect(moveItem([1, 2, 3], 1, -1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 2, 1)).toEqual([1, 2, 3]);
  });
});

describe('borrador de obra', () => {
  const ok = { video: (u: string) => u.includes('youtu'), audio: () => true };
  it('exige rama y título en el idioma de origen', () => {
    const d = emptyWorkDraft('es');
    expect(validateDraft(d, ok)).toEqual({ branch: true, title: true });
    d.branch = 'plasticas';
    d.title = { en: 'Only English' };
    expect(validateDraft(d, ok).title).toBe(true);
    d.title = { es: 'Título' };
    expect(validateDraft(d, ok)).toEqual({});
  });
  it('valida campos de rama solo si aplican', () => {
    const d = emptyWorkDraft('es');
    d.branch = 'audiovisuales';
    d.title = { es: 'x' };
    d.duration = '99:99';
    d.video_url = 'https://example.com';
    expect(validateDraft(d, ok)).toEqual({ duration: true, videoUrl: true });
    d.branch = 'plasticas';
    expect(validateDraft(d, ok)).toEqual({});
  });
  it('anula campos de otras ramas al guardar', () => {
    const d = emptyWorkDraft('es');
    d.branch = 'textos';
    d.title = { es: ' Hola ', en: '  ' };
    d.pages = '120';
    d.technique = 'óleo';
    d.duration = '1:00';
    const row = draftToRow(d);
    expect(row.pages).toBe(120);
    expect(row.technique).toBeNull();
    expect(row.duration_seconds).toBeNull();
    expect(row.title).toEqual({ es: 'Hola' });
    expect(row.license_id).toBe('cc-by-nc-nd-4.0');
  });
  it('cada rama declara sus campos', () => {
    expect(BRANCH_FIELDS.sonido.audioUrl).toBe(true);
    expect(BRANCH_FIELDS.audiovisuales.videoUrl).toBe(true);
    expect(BRANCH_FIELDS.escenicas.technique).toBe(false);
  });
});

describe('estado al guardar', () => {
  const now = '2026-11-12T10:00:00Z';
  it('publica con fecha y conserva la primera', () => {
    expect(statusPatch(null, 'publish', now, null)).toEqual({ status: 'published', published_at: now });
    expect(statusPatch('draft', 'publish', now, '2026-01-01T00:00:00Z')).toEqual({ status: 'published', published_at: '2026-01-01T00:00:00Z' });
  });
  it('no toca obras ocultas ni eliminadas', () => {
    expect(statusPatch('hidden', 'publish', now, null)).toEqual({});
    expect(statusPatch('hidden', 'keep', now, null)).toEqual({});
    expect(statusPatch('deleted', 'draft', now, null)).toEqual({});
  });
  it('acciones disponibles', () => {
    expect(saveActions(null)).toEqual(['draft', 'publish']);
    expect(saveActions('published')).toEqual(['keep', 'draft']);
    expect(saveActions('hidden')).toEqual(['keep']);
  });
});

describe('errores de base de datos', () => {
  it('traduce los códigos de las RPC', () => {
    expect(dbErrorKey({ message: 'already_participating', code: 'P0001' })).toBe('my.err.already');
    expect(dbErrorKey({ message: 'invalid_code', code: 'P0002' })).toBe('my.err.code');
    expect(dbErrorKey({ message: 'alias_taken', code: '23505' })).toBe('my.err.duplicate');
    expect(dbErrorKey({ message: 'forbidden', code: '42501' })).toBe('my.err.forbidden');
    expect(dbErrorKey({ message: 'new row violates row-level security policy' })).toBe('my.err.forbidden');
    expect(dbErrorKey({ message: 'algo raro' })).toBe('my.err.generic');
    expect(dbErrorKey(null)).toBe('my.err.generic');
  });
});
