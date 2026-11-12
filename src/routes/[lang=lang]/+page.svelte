<script lang="ts">
  // Portada: lema, buscador, ramas, obras recientes y llamada a registrarse.
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { auth } from '$lib/auth.svelte';
  import { currentLang, t } from '$lib/i18n';
  import { url } from '$lib/routes';
  import { BRANCHES } from '$lib/types';
  import type { WorkCard } from '$lib/types';
  import { listWorks } from '$lib/api/public';
  import { searchHref } from '$lib/api/publicUtils';
  import WorkCardView from '$lib/components/ui/WorkCard.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Empty from '$lib/components/ui/Empty.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import Meta from '$lib/components/public/Meta.svelte';

  const lang = $derived(currentLang());
  let q = $state('');
  let works = $state<WorkCard[]>([]);
  let status = $state<'loading' | 'ready' | 'error'>('loading');

  onMount(async () => {
    try {
      works = await listWorks({}, 12, 0);
      status = 'ready';
    } catch {
      status = 'error';
    }
  });

  function submit(e: SubmitEvent) {
    e.preventDefault();
    void goto(searchHref(lang, { q }));
  }
</script>

<Meta title={t('public.home.metaTitle')} description={t('app.tagline')} />

<section class="hero">
  <div class="container">
    <p class="eyebrow">{t('public.home.eyebrow')}</p>
    <h1>{t('public.home.title1')} <em>{t('public.home.title2')}</em></h1>
    <p class="lead">{t('public.home.lead')}</p>
    <form class="big-search" role="search" onsubmit={submit}>
      <label class="sr-only" for="home-q">{t('public.home.searchLabel')}</label>
      <input id="home-q" type="search" name="q" bind:value={q} placeholder={t('public.home.searchPlaceholder')} autocomplete="off" />
      <Button type="submit">{t('nav.search')}</Button>
    </form>
  </div>
</section>

<section class="container block" aria-labelledby="h-ramas">
  <h2 id="h-ramas" class="sr-only">{t('public.home.branches')}</h2>
  <ul class="branches">
    {#each BRANCHES as b (b)}
      <li>
        <a href={url.branch(lang, b)} style:--c="var(--rama-{b})">
          <strong>{t(`branch.${b}`)}</strong>
          <span>{t(`public.branch.${b}.desc`)}</span>
        </a>
      </li>
    {/each}
  </ul>
</section>

<section class="container block" aria-labelledby="h-recent">
  <div class="head">
    <h2 id="h-recent">{t('public.home.recent')}</h2>
    <a href={url.search(lang)}>{t('public.home.seeAll')}</a>
  </div>
  {#if status === 'loading'}
    <Spinner />
  {:else if status === 'error'}
    <Notice kind="error">{t('public.error.load')}</Notice>
  {:else if works.length === 0}
    <Empty>{t('public.home.noWorks')}</Empty>
  {:else}
    <ul class="grid-cards plain">
      {#each works as w (w.id)}
        <li><WorkCardView work={w} /></li>
      {/each}
    </ul>
  {/if}
</section>

{#if auth.ready && !auth.session}
  <section class="container block">
    <div class="cta">
      <div>
        <h2>{t('public.home.ctaTitle')}</h2>
        <p>{t('public.home.ctaText')}</p>
      </div>
      <Button href={url.login(lang)}>{t('public.home.ctaButton')}</Button>
    </div>
  </section>
{/if}

<style>
  .hero { padding: var(--space-7) 0 var(--space-6); border-bottom: 1px solid var(--line);
    background: radial-gradient(900px 300px at 85% -10%, var(--accent-soft), transparent 70%); }
  .hero h1 { font-size: clamp(2.4rem, 8vw, 4.6rem); max-width: 16ch; margin-bottom: var(--space-4); }
  .hero h1 em { font-style: italic; color: var(--accent); font-weight: 600; }
  .lead { font-size: clamp(1.05rem, 2.4vw, 1.3rem); max-width: 46ch; color: var(--muted); margin-bottom: var(--space-5); }
  .big-search { display: flex; gap: var(--space-2); max-width: 560px; }
  .big-search input { flex: 1; min-width: 0; padding: 12px 18px; border-radius: 999px; border: 1px solid var(--fg); background: var(--surface); min-height: 48px; }

  .block { margin-top: var(--space-7); }
  .head { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-3); flex-wrap: wrap; }
  .head a { font-weight: 600; font-size: 0.95rem; }

  .branches { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); }
  .branches a { display: grid; gap: 4px; height: 100%; padding: var(--space-4); text-decoration: none; background: var(--surface);
    border-radius: var(--radius); border-left: 6px solid var(--c); box-shadow: var(--shadow); }
  .branches a:hover { color: inherit; background: color-mix(in srgb, var(--c) 9%, var(--surface)); }
  .branches strong { font-family: var(--font-display); font-size: 1.15rem; color: var(--c); }
  .branches span { font-size: 0.88rem; color: var(--muted); }

  .plain { list-style: none; padding: 0; margin: 0; }
  .plain > li { display: contents; }

  .cta { display: flex; justify-content: space-between; align-items: center; gap: var(--space-5); flex-wrap: wrap;
    padding: var(--space-6); border-radius: var(--radius); background: var(--fg); color: var(--bg); }
  .cta h2 { color: inherit; margin-bottom: var(--space-2); }
  .cta p { margin: 0; max-width: 52ch; opacity: 0.85; }
  @media (max-width: 480px) {
    .big-search { flex-direction: column; }
    .cta { padding: var(--space-5); }
  }
</style>
