<script lang="ts">
  // Visor de la ficha de obra: imágenes, vídeo y audio embebidos, audio subido, PDF y ZIP.
  import { currentLang, t } from '$lib/i18n';
  import { publicUrl } from '$lib/supabase';
  import { parseAudioEmbed, parseVideo } from '$lib/media/embed';
  import { aspectCss, formatBytes } from '$lib/api/publicUtils';
  import ImageGallery, { type GalleryImage } from './ImageGallery.svelte';
  import type { Attachment, Work } from '$lib/types';

  let { work, attachments, title, coverId }: { work: Work; attachments: Attachment[]; title: string; coverId: string | null } = $props();
  const lang = $derived(currentLang());

  const ordered = $derived([...attachments].sort((a, b) => a.sort - b.sort));
  const images = $derived(ordered.filter((a) => a.kind === 'image'));
  const gallery = $derived<GalleryImage[]>(
    images.flatMap((a, i) => {
      const src = publicUrl('images', a.path);
      if (!src) return [];
      return [{
        src,
        thumb: publicUrl('images', a.thumb_path) ?? src,
        alt: a.title?.trim() || t('public.gallery.alt', { title, n: i + 1 }),
        width: a.width,
        height: a.height
      }];
    })
  );
  const start = $derived(Math.max(0, images.findIndex((a) => a.id === coverId)));
  const audios = $derived(ordered.filter((a) => a.kind === 'audio'));
  const pdfs = $derived(ordered.filter((a) => a.kind === 'pdf'));
  const zips = $derived(ordered.filter((a) => a.kind === 'zip'));
  const video = $derived(parseVideo(work.video_url));
  const audioEmbed = $derived(parseAudioEmbed(work.audio_embed_url));
  const empty = $derived(!gallery.length && !video && !audioEmbed && !audios.length && !pdfs.length && !zips.length);
  const fileLabel = (a: Attachment, fallback: string) => a.title?.trim() || fallback;
</script>

<div class="media">
  {#if gallery.length}
    <ImageGallery images={gallery} {start} />
  {/if}

  {#if video}
    <section aria-labelledby="mb-video">
      <h2 id="mb-video" class="h">{t('public.media.video')}</h2>
      <div class="embed" style:aspect-ratio={aspectCss(work.aspect_ratio)}>
        <iframe src={video.embed} title={t('public.media.videoTitle', { title })} loading="lazy" allowfullscreen
          referrerpolicy="strict-origin-when-cross-origin"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
      </div>
      <p class="small muted"><a href={work.video_url} target="_blank" rel="noopener noreferrer">{t('public.media.openOn', { provider: video.provider })}</a></p>
    </section>
  {/if}

  {#if audioEmbed}
    <section aria-labelledby="mb-aembed">
      <h2 id="mb-aembed" class="h">{t('public.media.audio')}</h2>
      <iframe class="aembed" src={audioEmbed.embed} title={t('public.media.audioTitle', { title })} loading="lazy"
        height={audioEmbed.provider === 'soundcloud' ? 166 : 120}></iframe>
    </section>
  {/if}

  {#if audios.length}
    <section aria-labelledby="mb-audio">
      <h2 id="mb-audio" class="h">{t('public.media.audio')}</h2>
      <ul class="files">
        {#each audios as a, i (a.id)}
          <li>
            <span class="fname">{fileLabel(a, t('public.media.audioN', { n: i + 1 }))}</span>
            <audio controls preload="none" src={publicUrl('audio', a.path) ?? undefined}>
              <a href={publicUrl('audio', a.path) ?? '#'}>{t('public.media.download')}</a>
            </audio>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if pdfs.length}
    <section aria-labelledby="mb-pdf">
      <h2 id="mb-pdf" class="h">{t('public.media.pdf')}</h2>
      <ul class="docs">
        {#each pdfs as a, i (a.id)}
          {@const thumb = publicUrl('images', a.thumb_path)}
          <li>
            <a class="doc" href={publicUrl('docs', a.path) ?? '#'} target="_blank" rel="noopener noreferrer">
              {#if thumb}<img src={thumb} alt="" loading="lazy" />{:else}<span class="ph" aria-hidden="true">PDF</span>{/if}
              <span class="dt">
                <strong>{fileLabel(a, t('public.media.pdfN', { n: i + 1 }))}</strong>
                <small class="muted">{t('public.media.openPdf')} · {formatBytes(a.size_bytes, lang)}</small>
              </span>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if zips.length}
    <section aria-labelledby="mb-zip">
      <h2 id="mb-zip" class="h">{t('public.media.zip')}</h2>
      <ul class="files">
        {#each zips as a, i (a.id)}
          <li class="zip">
            <span class="fname">{fileLabel(a, t('public.media.zipN', { n: i + 1 }))}</span>
            <a class="dl" href={publicUrl('docs', a.path) ?? '#'} download>
              {t('public.media.download')} ({formatBytes(a.size_bytes, lang)})
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if empty}
    <div class="ph-branch" style:--c="var(--rama-{work.branch})">
      <span>{t(`branch.${work.branch}`)}</span>
    </div>
  {/if}
</div>

<style>
  .media { display: grid; gap: var(--space-5); min-width: 0; }
  .h { font-size: 1.05rem; font-family: var(--font-ui); text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); font-weight: 600; margin-bottom: var(--space-2); }
  .embed { position: relative; width: 100%; background: #000; border-radius: var(--radius); overflow: hidden; }
  .embed iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .aembed { width: 100%; border: 0; border-radius: var(--radius-sm); }
  .small { font-size: 0.85rem; margin: var(--space-2) 0 0; }
  .files, .docs { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); }
  .files li { display: grid; gap: 6px; }
  .fname { font-weight: 600; overflow-wrap: anywhere; }
  audio { width: 100%; }
  .zip { display: flex !important; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: var(--space-2) var(--space-4); padding: var(--space-3) var(--space-4); background: var(--surface); border-radius: var(--radius); }
  .dl { font-weight: 600; }
  .doc { display: flex; gap: var(--space-3); align-items: center; text-decoration: none; padding: var(--space-3); background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); }
  .doc:hover { color: inherit; outline: 1px solid var(--accent); }
  .doc img, .doc .ph { width: 64px; height: 84px; object-fit: cover; border-radius: 3px; flex: none; background: var(--surface-2); }
  .doc .ph { display: grid; place-items: center; font-weight: 700; color: var(--accent); font-size: 0.8rem; }
  .dt { display: grid; min-width: 0; overflow-wrap: anywhere; }
  .ph-branch { display: grid; place-items: center; aspect-ratio: 16 / 9; border-radius: var(--radius); background: color-mix(in srgb, var(--c) 10%, var(--surface-2)); border-top: 4px solid var(--c); color: var(--c); font-family: var(--font-display); font-size: 1.6rem; }
</style>
