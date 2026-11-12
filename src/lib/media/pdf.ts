// Miniatura de la primera página de un PDF con pdf.js (carga diferida: pesa mucho).
import { LIMITS } from '$lib/types';
import type { ProcessedImage } from './image';

export async function pdfThumb(file: Blob, maxSide: number = LIMITS.thumbMaxSide): Promise<ProcessedImage | null> {
  try {
    const pdfjs = await import('pdfjs-dist');
    const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    try {
      const page = await doc.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const scale = maxSide / Math.max(base.width, base.height);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', 0.86));
      return blob ? { blob, width: canvas.width, height: canvas.height } : null;
    } finally {
      await doc.destroy();
    }
  } catch {
    // Un PDF sin miniatura sigue siendo válido.
    return null;
  }
}
