import { describe, expect, it } from 'vitest';
import { LIMITS } from '$lib/types';
import {
  attachmentPath, avatarPath, bucketFor, kindFromFile, maxInputBytes, slotsLeft, storedExt, thumbPath, validateFile,
  withinStoredLimit, isOwnPath, formatBytes, audioMime
} from './rules';
import { cropRegion, fitSize } from './image';

const f = (name: string, type: string, size = 1000) => ({ name, type, size });

describe('tipo y bucket', () => {
  it('decide el tipo por MIME', () => {
    expect(kindFromFile(f('a.jpg', 'image/jpeg'))).toBe('image');
    expect(kindFromFile(f('a.pdf', 'application/pdf'))).toBe('pdf');
    expect(kindFromFile(f('a.zip', 'application/x-zip-compressed'))).toBe('zip');
    expect(kindFromFile(f('a.zip', 'application/octet-stream'))).toBe('zip');
    expect(kindFromFile(f('a.mp3', 'audio/mpeg'))).toBe('audio');
    expect(kindFromFile(f('a.flac', ''))).toBe('audio');
  });
  it('rechaza SVG, ejecutables y vídeo', () => {
    expect(kindFromFile(f('a.svg', 'image/svg+xml'))).toBeNull();
    expect(kindFromFile(f('a.exe', 'application/x-msdownload'))).toBeNull();
    expect(kindFromFile(f('a.mp4', 'video/mp4'))).toBeNull();
    expect(kindFromFile(f('a.opus', 'audio/opus'))).toBeNull(); // el bucket no lo admite
  });
  it('normaliza el MIME de audio', () => {
    expect(audioMime(f('a.mp3', 'audio/mp3'))).toBe('audio/mpeg');
    expect(audioMime(f('a.wav', ''))).toBe('audio/wav');
    expect(audioMime(f('a.xyz', ''))).toBeNull();
  });
  it('elige bucket', () => {
    expect(bucketFor('image')).toBe('images');
    expect(bucketFor('pdf')).toBe('docs');
    expect(bucketFor('zip')).toBe('docs');
    expect(bucketFor('audio')).toBe('audio');
  });
  it('extensión almacenada', () => {
    expect(storedExt('image', f('a.png', 'image/png'))).toBe('webp');
    expect(storedExt('audio', f('Pista.WAV', 'audio/wav'))).toBe('wav');
    expect(storedExt('audio', f('sin', 'audio/x-raro'))).toBe('mp3');
  });
});

describe('límites', () => {
  it('valida tamaño por tipo', () => {
    expect(validateFile(f('a.pdf', 'application/pdf', LIMITS.bytes.pdf))).toEqual({ ok: true, kind: 'pdf' });
    expect(validateFile(f('a.pdf', 'application/pdf', LIMITS.bytes.pdf + 1))).toEqual({ ok: false, problem: 'size' });
    expect(validateFile(f('a.zip', 'application/zip', LIMITS.bytes.zip + 1))).toEqual({ ok: false, problem: 'size' });
    expect(validateFile(f('a.mp3', 'audio/mpeg', 0))).toEqual({ ok: false, problem: 'empty' });
    expect(validateFile(f('a.txt', 'text/plain'))).toEqual({ ok: false, problem: 'type' });
  });
  it('acepta imágenes grandes porque se reducen', () => {
    expect(validateFile(f('a.jpg', 'image/jpeg', LIMITS.bytes.image * 2)).ok).toBe(true);
    expect(maxInputBytes('image')).toBeGreaterThan(LIMITS.bytes.image);
    expect(withinStoredLimit('image', LIMITS.bytes.image + 1)).toBe(false);
  });
  it('huecos de adjuntos', () => {
    expect(slotsLeft(0)).toBe(LIMITS.attachmentsPerWork);
    expect(slotsLeft(LIMITS.attachmentsPerWork + 2)).toBe(0);
  });
  it('formatea bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('rutas de Storage', () => {
  it('sigue el contrato', () => {
    expect(attachmentPath('u1', 'w1', 'x', 'webp')).toBe('u1/w1/x.webp');
    expect(thumbPath('u1', 'w1', 'x')).toBe('u1/w1/x-thumb.webp');
    expect(avatarPath('u1', 'x')).toBe('u1/avatar-x.webp');
    expect(isOwnPath('u1', 'u1/w1/x.webp')).toBe(true);
    expect(isOwnPath('u1', 'u2/w1/x.webp')).toBe(false);
    expect(isOwnPath('u1', 'u1/../u2/x')).toBe(false);
  });
});

describe('geometría de imagen', () => {
  it('no amplía y mantiene proporción', () => {
    expect(fitSize(4000, 2000, 2000)).toEqual({ width: 2000, height: 1000 });
    expect(fitSize(800, 600, 2400)).toEqual({ width: 800, height: 600 });
  });
  it('recorte cuadrado centrado y con desplazamiento', () => {
    expect(cropRegion(400, 200, { zoom: 1, offsetX: 0, offsetY: 0 })).toEqual({ sx: 100, sy: 0, side: 200 });
    expect(cropRegion(400, 200, { zoom: 1, offsetX: -1, offsetY: 0 })).toEqual({ sx: 0, sy: 0, side: 200 });
    expect(cropRegion(400, 200, { zoom: 2, offsetX: 5, offsetY: 0 })).toEqual({ sx: 300, sy: 50, side: 100 });
  });
});
