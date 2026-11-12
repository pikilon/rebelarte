// Subida de adjuntos de una obra: valida, procesa en el navegador, sube a Storage e inserta la fila.
import { env } from '$env/dynamic/public';
import { supabase } from '$lib/supabase';
import type { Attachment, AttachmentKind } from '$lib/types';
import { LIMITS } from '$lib/types';
import { makeThumb, processImage, ImageError } from './image';
import { pdfThumb } from './pdf';
import {
  attachmentPath, avatarPath, bucketFor, storedExt, thumbPath, validateFile, withinStoredLimit,
  type Bucket, type FileProblem
} from './rules';

export type UploadStage = 'processing' | 'uploading' | 'saving' | 'done';
export interface UploadProgress { stage: UploadStage; /** 0..1 */ fraction: number }

export class UploadError extends Error {
  constructor(public code: FileProblem | 'too-big' | 'image' | 'auth' | 'storage' | 'db', detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

function uuid(): string {
  return crypto.randomUUID();
}

/** PUT con progreso real (XHR). Replica lo que hace supabase-js: multipart con la parte sin nombre. */
async function putObject(bucket: Bucket | 'avatars', path: string, blob: Blob, onFraction?: (f: number) => void): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new UploadError('auth');
  const base = env.PUBLIC_SUPABASE_URL || 'http://localhost:54321';
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${base}/storage/v1/object/${bucket}/${encoded}`);
    xhr.setRequestHeader('authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', env.PUBLIC_SUPABASE_ANON_KEY || '');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onFraction?.(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new UploadError('storage', `${xhr.status} ${xhr.responseText.slice(0, 200)}`)));
    xhr.onerror = () => reject(new UploadError('storage', 'network'));
    xhr.onabort = () => reject(new UploadError('storage', 'aborted'));
    const form = new FormData();
    form.append('cacheControl', '31536000');
    form.append('', blob);
    xhr.send(form);
  });
}

async function removeObjects(bucket: Bucket | 'avatars', paths: string[]): Promise<void> {
  if (!paths.length) return;
  try {
    await supabase.storage.from(bucket).remove(paths);
  } catch {
    // limpieza best-effort
  }
}

/** Sube un adjunto a la obra y devuelve la fila insertada. */
export async function uploadAttachment(
  workId: string,
  file: File,
  opts: { sort: number; onProgress?: (p: UploadProgress) => void }
): Promise<Attachment> {
  const report = (stage: UploadStage, fraction: number) => opts.onProgress?.({ stage, fraction });
  const { data: sess } = await supabase.auth.getSession();
  const userId = sess.session?.user.id;
  if (!userId) throw new UploadError('auth');

  const check = validateFile(file);
  if (!check.ok) throw new UploadError(check.problem);
  const kind: AttachmentKind = check.kind;

  report('processing', 0.02);
  let main: Blob = file;
  let thumb: Blob | null = null;
  let width: number | null = null;
  let height: number | null = null;
  try {
    if (kind === 'image') {
      const img = await processImage(file, LIMITS.imageMaxSide);
      main = img.blob;
      width = img.width;
      height = img.height;
      thumb = (await makeThumb(img.blob, LIMITS.thumbMaxSide)).blob;
    } else if (kind === 'pdf') {
      thumb = (await pdfThumb(file))?.blob ?? null;
    }
  } catch (e) {
    if (e instanceof ImageError) throw new UploadError('image', e.code);
    throw e;
  }
  if (!withinStoredLimit(kind, main.size)) throw new UploadError('too-big');

  const id = uuid();
  const bucket = bucketFor(kind);
  const path = attachmentPath(userId, workId, id, storedExt(kind, file));
  const tPath = thumb ? thumbPath(userId, workId, id) : null;
  const mime = kind === 'image' ? 'image/webp' : kind === 'pdf' ? 'application/pdf' : kind === 'zip' ? 'application/zip' : file.type || 'audio/mpeg';
  const uploaded: Array<{ bucket: Bucket; path: string }> = [];

  try {
    report('uploading', 0.1);
    // Miniatura primero (pequeña): el progreso lo marca el archivo principal.
    if (thumb && tPath) {
      await putObject('images', tPath, thumb);
      uploaded.push({ bucket: 'images', path: tPath });
    }
    await putObject(bucket, path, new Blob([main], { type: mime }), (f) => report('uploading', 0.1 + f * 0.8));
    uploaded.push({ bucket, path });

    report('saving', 0.95);
    const { data, error } = await supabase
      .from('attachments')
      .insert({
        work_id: workId, kind, path, thumb_path: tPath, mime, size_bytes: main.size,
        width, height, title: file.name.replace(/\.[^.]+$/, '').slice(0, 120), sort: opts.sort
      })
      .select('*')
      .single();
    if (error) throw new UploadError('db', error.message);
    report('done', 1);
    return data as Attachment;
  } catch (e) {
    for (const u of uploaded) await removeObjects(u.bucket, [u.path]);
    throw e;
  }
}

/** Sube el avatar (ya recortado y en WebP) y devuelve la ruta nueva. */
export async function uploadAvatar(blob: Blob, userId: string): Promise<string> {
  const path = avatarPath(userId, uuid());
  await putObject('avatars', path, blob);
  return path;
}

export async function removeAvatar(path: string | null | undefined): Promise<void> {
  if (path) await removeObjects('avatars', [path]);
}

/** Borra los archivos de un adjunto (principal y miniatura). */
export async function removeAttachmentFiles(att: Pick<Attachment, 'kind' | 'path' | 'thumb_path'>): Promise<void> {
  await removeObjects(bucketFor(att.kind), [att.path]);
  if (att.thumb_path) await removeObjects('images', [att.thumb_path]);
}
