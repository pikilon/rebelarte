<script lang="ts">
  import { currentLang, t, tr } from '$lib/i18n';
  import { url } from '$lib/routes';
  import { publicUrl } from '$lib/supabase';
  import { videoThumb } from '$lib/media/embed';
  import type { WorkCard } from '$lib/types';
  let { work, showAuthor = true }: { work: WorkCard; showAuthor?: boolean } = $props();
  const lang = $derived(currentLang());
  const title = $derived(tr(work.title, work.lang));
  const img = $derived(publicUrl('images', work.cover_path) ?? videoThumb(work.video_url));
</script>

<article class="card" style:--c="var(--rama-{work.branch})">
  <a class="media" href={url.work(lang, work.short_id, title)} tabindex="-1" aria-hidden="true">
    {#if img}<img src={img} alt="" loading="lazy" />{:else}<span class="ph">{t(`branch.${work.branch}`)}</span>{/if}
  </a>
  <div class="body">
    <span class="branch">{t(`branch.${work.branch}`)}</span>
    <h3><a href={url.work(lang, work.short_id, title)}>{title}</a></h3>
    {#if showAuthor}<a class="author" href={url.cv(lang, work.uploader_alias)}>{work.uploader_name}</a>{/if}
  </div>
</article>

<style>
  .card { background: var(--surface); border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow); border-top: 4px solid var(--c); display: flex; flex-direction: column; }
  .media { display: block; aspect-ratio: 4 / 3; background: var(--surface-2); }
  .media img { width: 100%; height: 100%; object-fit: cover; }
  .ph { display: grid; place-items: center; height: 100%; color: var(--c); font-family: var(--font-display); font-size: 1.3rem; }
  .body { padding: var(--space-3) var(--space-4) var(--space-4); }
  .branch { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.12em; color: var(--c); font-weight: 600; }
  h3 { margin: 4px 0; font-size: 1.1rem; }
  h3 a { text-decoration: none; }
  .author { font-size: 0.9rem; color: var(--muted); text-decoration: none; }
</style>
