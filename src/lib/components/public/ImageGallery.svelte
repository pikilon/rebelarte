<script lang="ts" module>
  export interface GalleryImage { src: string; thumb: string; alt: string; width: number | null; height: number | null }
</script>

<script lang="ts">
  // Galería de imágenes de una obra: imagen principal, miniaturas y visor ampliado accesible (<dialog>).
  // Teclado en el visor: ← → cambian de imagen, Esc cierra (nativo), foco al cerrar vuelve al disparador.
  import { t } from '$lib/i18n';

  let { images, start = 0 }: { images: GalleryImage[]; start?: number } = $props();

  let current = $state(0);
  let dlg = $state<HTMLDialogElement>();
  let opened = $state(false);

  // `start` (portada elegida) fija la imagen inicial cuando cambia la obra.
  $effect(() => {
    current = Math.min(Math.max(start, 0), Math.max(images.length - 1, 0));
  });

  const total = $derived(images.length);
  const img = $derived(images[current]);

  function go(delta: number) {
    if (total < 2) return;
    current = (current + delta + total) % total;
  }
  function open() {
    opened = true;
    dlg?.showModal();
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
  }
  function onBackdrop(e: MouseEvent) {
    if (e.target === dlg) dlg?.close();
  }
</script>

{#if img}
  <div class="gal">
    <button class="main" type="button" onclick={open} aria-haspopup="dialog" aria-label={t('public.gallery.enlarge', { alt: img.alt })}>
      <img src={img.src} alt={img.alt} width={img.width ?? undefined} height={img.height ?? undefined} />
      <span class="zoom" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M11 8v6M8 11h6" /></svg>
      </span>
    </button>

    {#if total > 1}
      <ul class="thumbs" aria-label={t('public.gallery.thumbs')}>
        {#each images as im, i (im.src)}
          <li>
            <button type="button" class="th" class:on={i === current} onclick={() => (current = i)}
              aria-label={t('public.gallery.show', { n: i + 1, total })} aria-current={i === current ? 'true' : undefined}>
              <img src={im.thumb} alt="" loading="lazy" />
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <!-- Esc cierra de forma nativa; el clic en el fondo es un atajo de ratón. -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <dialog bind:this={dlg} class="lb" aria-label={t('public.gallery.viewer')} onkeydown={onKey} onclick={onBackdrop}
    onclose={() => (opened = false)}>
    {#if opened}
      <div class="stage">
        <img src={img.src} alt={img.alt} />
      </div>
      <p class="cap" aria-live="polite">{img.alt} · {current + 1} / {total}</p>
      <button class="x" type="button" onclick={() => dlg?.close()} aria-label={t('common.close')}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
      {#if total > 1}
        <button class="nav prev" type="button" onclick={() => go(-1)} aria-label={t('public.gallery.prev')}>
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7" /></svg>
        </button>
        <button class="nav next" type="button" onclick={() => go(1)} aria-label={t('public.gallery.next')}>
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7" /></svg>
        </button>
      {/if}
    {/if}
  </dialog>
{/if}

<style>
  .gal { display: grid; gap: var(--space-3); min-width: 0; }
  .main { position: relative; display: grid; place-items: center; padding: 0; border: 0; cursor: zoom-in; background: var(--surface-2);
    border-radius: var(--radius); overflow: hidden; width: 100%; }
  .main img { width: 100%; height: auto; max-height: min(78vh, 720px); object-fit: contain; }
  .zoom { position: absolute; right: 10px; bottom: 10px; background: rgb(20 18 15 / 0.65); color: #fff; border-radius: 999px; padding: 6px; display: grid; }
  .thumbs { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: var(--space-2); }
  .th { display: block; width: 100%; padding: 0; border: 2px solid transparent; border-radius: var(--radius-sm); overflow: hidden; cursor: pointer; background: var(--surface-2); aspect-ratio: 1; }
  .th img { width: 100%; height: 100%; object-fit: cover; }
  .th.on { border-color: var(--accent); }

  .lb { border: 0; padding: 0; background: transparent; width: 100vw; height: 100dvh; max-width: none; max-height: none; color: #fff; overflow: hidden; }
  .lb::backdrop { background: rgb(10 9 8 / 0.94); }
  .stage { position: absolute; inset: 56px 12px 56px; display: grid; place-items: center; }
  .stage img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .cap { position: absolute; left: 0; right: 0; bottom: 14px; margin: 0; text-align: center; font-size: 0.9rem; padding: 0 64px; color: #ddd; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .x, .nav { position: absolute; width: 44px; height: 44px; display: grid; place-items: center; border: 0; border-radius: 50%; background: rgb(255 255 255 / 0.14); color: #fff; cursor: pointer; }
  .x:hover, .nav:hover { background: rgb(255 255 255 / 0.28); }
  .x { top: 8px; right: 8px; }
  .nav { top: 50%; transform: translateY(-50%); }
  .prev { left: 6px; }
  .next { right: 6px; }
  .lb :focus-visible { outline-color: #fff; }
  @media (max-width: 640px) {
    .stage { inset: 56px 0 56px; }
  }
</style>
