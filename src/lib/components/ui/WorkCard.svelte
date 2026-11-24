<script lang="ts">
  import { currentLang, t, tr } from '$lib/i18n';
  import { url } from '$lib/routes';
  import { publicUrl } from '$lib/supabase';
  import { videoThumb } from '$lib/media/embed';
  import type { WorkCard } from '$lib/types';
  import BranchIcon from './BranchIcon.svelte';
  let { work, showAuthor = true }: { work: WorkCard; showAuthor?: boolean } = $props();
  const lang = $derived(currentLang());
  const title = $derived(tr(work.title, work.lang));
  const img = $derived(publicUrl('images', work.cover_path) ?? videoThumb(work.video_url));
</script>

<article class="card" style:--c="var(--rama-{work.branch})">
  <a class="media" href={url.work(lang, work.short_id, title)} tabindex="-1" aria-hidden="true">
    {#if img}<img src={img} alt="" loading="lazy" />{:else}<span class="ph"><BranchIcon branch={work.branch} size={56} /></span>{/if}
  </a>
  <div class="body">
    <span class="branch"><BranchIcon branch={work.branch} size={16} /> {t(`branch.${work.branch}`)}</span>
    <h3><a href={url.work(lang, work.short_id, title)}>{title}</a></h3>
    {#if showAuthor}<a class="author" href={url.cv(lang, work.uploader_alias)}>{work.uploader_name}</a>{/if}
  </div>
</article>

<style>
  .card {
    position: relative; background: var(--surface); border-radius: var(--radius); overflow: hidden;
    border: 1px solid var(--line); display: flex; flex-direction: column; height: 100%;
    transition: translate 0.2s, box-shadow 0.2s;
  }
  .card:hover { translate: 0 -3px; box-shadow: var(--shadow-lg); }
  .media { display: block; aspect-ratio: 4 / 3; background: color-mix(in srgb, var(--c) 10%, var(--surface-2)); overflow: hidden; }
  .media img { width: 100%; height: 100%; object-fit: cover; transition: scale 0.4s; }
  .card:hover .media img { scale: 1.04; }
  .ph { display: grid; place-items: center; height: 100%; color: var(--c); opacity: 0.75; }
  .body { padding: var(--space-3) var(--space-4) var(--space-4); }
  .branch { display: inline-flex; align-items: center; gap: 6px; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--c); font-weight: 700; }
  h3 { margin: 6px 0 4px; font-size: 1.12rem; }
  h3 a { text-decoration: none; }
  h3 a::after { content: ''; position: absolute; inset: 0; }
  .author { position: relative; z-index: 1; font-size: 0.9rem; color: var(--muted); text-decoration: none; }
  .author:hover { color: var(--accent); }
</style>
