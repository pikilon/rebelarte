// Vídeo y audio solo por URL de plataforma (especificación §2 y §6).

export type VideoInfo = { provider: 'youtube' | 'vimeo' | 'peertube'; id: string; embed: string; thumb: string | null };

export function parseVideo(raw: string | null | undefined): VideoInfo | null {
  if (!raw) return null;
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtu.be' || host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id = host === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v') ?? u.pathname.match(/\/(?:embed|shorts)\/([\w-]{11})/)?.[1] ?? '';
    if (!/^[\w-]{11}$/.test(id)) return null;
    return { provider: 'youtube', id, embed: `https://www.youtube-nocookie.com/embed/${id}`, thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = u.pathname.match(/(\d{6,})/)?.[1];
    if (!id) return null;
    return { provider: 'vimeo', id, embed: `https://player.vimeo.com/video/${id}`, thumb: `https://vumbnail.com/${id}.jpg` };
  }
  const pt = u.pathname.match(/^\/(?:w|videos\/watch)\/([\w-]+)/);
  if (pt) {
    return { provider: 'peertube', id: pt[1], embed: `${u.origin}/videos/embed/${pt[1]}`, thumb: null };
  }
  return null;
}

export function videoThumb(raw: string | null | undefined): string | null {
  return parseVideo(raw)?.thumb ?? null;
}

export type AudioEmbed = { provider: 'soundcloud' | 'bandcamp'; embed: string };

/** SoundCloud: widget por URL. Bandcamp: se acepta la URL del reproductor embebido (EmbeddedPlayer). */
export function parseAudioEmbed(raw: string | null | undefined): AudioEmbed | null {
  if (!raw) return null;
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  if (host === 'soundcloud.com') {
    return { provider: 'soundcloud', embed: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u.origin + u.pathname)}&visual=false` };
  }
  if (host === 'bandcamp.com' && u.pathname.startsWith('/EmbeddedPlayer/')) {
    return { provider: 'bandcamp', embed: u.toString() };
  }
  return null;
}
