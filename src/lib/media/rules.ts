// Reglas puras de archivos adjuntos (sin dependencias del navegador): tipo, bucket y límites.
import { LIMITS, type AttachmentKind } from '$lib/types';

export type Bucket = 'images' | 'docs' | 'audio';

/** Extensiones de imagen aceptadas cuando el navegador no informa del MIME. SVG queda fuera a propósito (scripts). */
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/bmp'];
const ZIP_MIMES = ['application/zip', 'application/x-zip-compressed', 'application/x-zip'];

function ext(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : '';
}

/** Decide el tipo de adjunto por MIME (y extensión como apoyo). null = no admitido. */
export function kindFromFile(file: { type: string; name: string }): AttachmentKind | null {
  const type = (file.type || '').toLowerCase();
  const e = ext(file.name);
  if (IMAGE_MIMES.includes(type)) return 'image';
  if (!type && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp'].includes(e)) return 'image';
  if (type === 'application/pdf' || (!type && e === 'pdf')) return 'pdf';
  if (ZIP_MIMES.includes(type) || ((!type || type === 'application/octet-stream') && e === 'zip')) return 'zip';
  if (audioMime(file)) return 'audio';
  return null;
}

/** MIME de audio que acepta el bucket `audio`, normalizando alias habituales. null = no admitido. */
const AUDIO_MIMES: Record<string, string> = {
  'audio/mpeg': 'audio/mpeg', 'audio/mp3': 'audio/mpeg', 'audio/mp4': 'audio/mp4', 'audio/x-m4a': 'audio/x-m4a',
  'audio/m4a': 'audio/x-m4a', 'audio/aac': 'audio/aac', 'audio/ogg': 'audio/ogg', 'audio/wav': 'audio/wav',
  'audio/x-wav': 'audio/x-wav', 'audio/wave': 'audio/wav', 'audio/webm': 'audio/webm', 'audio/flac': 'audio/flac',
  'audio/x-flac': 'audio/flac'
};
const AUDIO_EXT: Record<string, string> = {
  mp3: 'audio/mpeg', m4a: 'audio/x-m4a', aac: 'audio/aac', ogg: 'audio/ogg', wav: 'audio/wav', flac: 'audio/flac', webm: 'audio/webm'
};
export function audioMime(file: { type: string; name: string }): string | null {
  const type = (file.type || '').toLowerCase();
  if (type) return AUDIO_MIMES[type] ?? null;
  return AUDIO_EXT[ext(file.name)] ?? null;
}

export function bucketFor(kind: AttachmentKind): Bucket {
  if (kind === 'image') return 'images';
  if (kind === 'audio') return 'audio';
  return 'docs';
}

/** Extensión del archivo final almacenado. Las imágenes y miniaturas salen siempre como WebP. */
export function storedExt(kind: AttachmentKind, file: { name: string }): string {
  if (kind === 'image') return 'webp';
  if (kind === 'pdf') return 'pdf';
  if (kind === 'zip') return 'zip';
  const e = ext(file.name);
  return /^[a-z0-9]{2,5}$/.test(e) ? e : 'mp3';
}

/** Las imágenes se reducen antes de subir, así que se acepta un original mayor que el límite final. */
export const IMAGE_INPUT_FACTOR = 3;

export function maxInputBytes(kind: AttachmentKind): number {
  return kind === 'image' ? LIMITS.bytes.image * IMAGE_INPUT_FACTOR : LIMITS.bytes[kind];
}

export type FileProblem = 'type' | 'size' | 'empty';

/** Valida un archivo antes de procesarlo. */
export function validateFile(file: { type: string; name: string; size: number }): { ok: true; kind: AttachmentKind } | { ok: false; problem: FileProblem } {
  const kind = kindFromFile(file);
  if (!kind) return { ok: false, problem: 'type' };
  if (file.size <= 0) return { ok: false, problem: 'empty' };
  if (file.size > maxInputBytes(kind)) return { ok: false, problem: 'size' };
  return { ok: true, kind };
}

/** Tamaño del archivo final almacenado frente al límite del tipo. */
export function withinStoredLimit(kind: AttachmentKind, bytes: number): boolean {
  return bytes <= LIMITS.bytes[kind];
}

/** Ruta en el bucket: `<user_id>/<work_id>/<uuid>.<ext>`; la miniatura añade `-thumb.webp`. */
export function attachmentPath(userId: string, workId: string, id: string, extension: string): string {
  return `${userId}/${workId}/${id}.${extension}`;
}
export function thumbPath(userId: string, workId: string, id: string): string {
  return `${userId}/${workId}/${id}-thumb.webp`;
}
export function avatarPath(userId: string, id: string): string {
  return `${userId}/avatar-${id}.webp`;
}

/** Cuántos archivos más caben en la obra. */
export function slotsLeft(current: number): number {
  return Math.max(0, LIMITS.attachmentsPerWork - current);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Ruta de bucket a partir de una ruta almacenada, para borrar. */
export function isOwnPath(userId: string, path: string): boolean {
  return path.startsWith(`${userId}/`) && !path.includes('..');
}
