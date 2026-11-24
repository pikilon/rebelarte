// Procesado de imágenes en el navegador. El reencode con canvas elimina EXIF/GPS.
import { LIMITS } from '$lib/types';

export interface ProcessedImage { blob: Blob; width: number; height: number }

const QUALITY = 0.86;

export class ImageError extends Error {
  constructor(public code: 'not-image' | 'decode' | 'encode') {
    super(code);
  }
}

/** Dimensiones de salida sin ampliar, manteniendo proporción. */
export function fitSize(w: number, h: number, maxSide: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

async function decode(src: Blob): Promise<ImageBitmap> {
  if (!src.type.startsWith('image/')) throw new ImageError('not-image');
  try {
    return await createImageBitmap(src, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageError('decode');
  }
}

function toWebp(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new ImageError('encode'))), 'image/webp', QUALITY);
  });
}

async function render(bmp: ImageBitmap, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageError('encode');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, width, height);
  return toWebp(canvas);
}

/** Redimensiona y reencoda a WebP. Rechaza lo que no sea imagen. */
export async function processImage(file: Blob, maxSide: number = LIMITS.imageMaxSide): Promise<ProcessedImage> {
  const bmp = await decode(file);
  try {
    const { width, height } = fitSize(bmp.width, bmp.height, maxSide);
    return { blob: await render(bmp, width, height), width, height };
  } finally {
    bmp.close();
  }
}

/** Miniatura WebP (lado mayor ≤ maxSide). */
export async function makeThumb(file: Blob, maxSide: number = LIMITS.thumbMaxSide): Promise<ProcessedImage> {
  return processImage(file, maxSide);
}

export interface CropBox {
  /** Zoom ≥ 1 (1 = el lado menor llena el recuadro). */
  zoom: number;
  /** Desplazamiento del centro, de -1 a 1, relativo al margen disponible. */
  offsetX: number;
  offsetY: number;
}

/** Región cuadrada de origen para un recorte con zoom y desplazamiento. */
export function cropRegion(w: number, h: number, box: CropBox): { sx: number; sy: number; side: number } {
  const zoom = Math.max(1, box.zoom);
  const side = Math.min(w, h) / zoom;
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const sx = (w - side) / 2 + clamp(box.offsetX) * ((w - side) / 2);
  const sy = (h - side) / 2 + clamp(box.offsetY) * ((h - side) / 2);
  return { sx, sy, side };
}

/** Recorte cuadrado a WebP de `size` px (avatar). */
export async function cropSquare(file: Blob, box: CropBox, size = 512): Promise<ProcessedImage> {
  const bmp = await decode(file);
  try {
    const { sx, sy, side } = cropRegion(bmp.width, bmp.height, box);
    const out = Math.min(size, Math.round(side));
    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageError('encode');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, sx, sy, side, side, 0, 0, out, out);
    return { blob: await toWebp(canvas), width: out, height: out };
  } finally {
    bmp.close();
  }
}
