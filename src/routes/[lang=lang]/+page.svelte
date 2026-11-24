<script lang="ts">
  // Portada: lema, buscador, ramas, obras recientes, cómo funciona y llamada a registrarse.
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { auth } from '$lib/auth.svelte';
  import { currentLang, t } from '$lib/i18n';
  import { url } from '$lib/routes';
  import { BRANCHES } from '$lib/types';
  import type { WorkCard } from '$lib/types';
  import { listWorks } from '$lib/api/public';
  import { searchHref } from '$lib/api/publicUtils';
  import { logoMarkSvg } from '$lib/brand';
  import WorkCardView from '$lib/components/ui/WorkCard.svelte';
  import BranchIcon from '$lib/components/ui/BranchIcon.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Empty from '$lib/components/ui/Empty.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import Meta from '$lib/components/public/Meta.svelte';

  const lang = $derived(currentLang());
  let q = $state('');
  let works = $state<WorkCard[]>([]);
  let status = $state<'loading' | 'ready' | 'error'>('loading');
  const mark = logoMarkSvg('var(--brand)', 'var(--brand-ink)', 'var(--bg)');

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
  <div class="container hero-grid">
    <div class="copy">
      <p class="eyebrow">{t('public.home.eyebrow')}</p>
      <h1>{t('public.home.title1')} <em>{t('public.home.title2')}</em></h1>
      <p class="lead">{t('public.home.lead')}</p>
      <form class="big-search" role="search" onsubmit={submit}>
        <label class="sr-only" for="home-q">{t('public.home.searchLabel')}</label>
        <input id="home-q" type="search" name="q" bind:value={q} placeholder={t('public.home.searchPlaceholder')} autocomplete="off" />
        <Button type="submit">{t('nav.search')}</Button>
      </form>
    </div>
    <div class="art" aria-hidden="true">
      <div class="halo"></div>
      <svg class="atlas" viewBox="0 0 64 64">{@html mark}</svg>
      {#each BRANCHES as b, i (b)}
        <span class="orbit" style:--i={i}><BranchIcon branch={b} badge size={58} /></span>
      {/each}
    </div>
  </div>
</section>

<section class="container block" aria-labelledby="h-ramas">
  <h2 id="h-ramas">{t('public.home.explore')}</h2>
  <ul class="branches">
    {#each BRANCHES as b (b)}
      <li>
        <a href={url.branch(lang, b)} style:--c="var(--rama-{b})" style:--v="var(--rama-{b}-vivid)">
          <BranchIcon branch={b} badge size={48} />
          <strong>{t(`branch.${b}`)}</strong>
          <span>{t(`public.branch.${b}.desc`)}</span>
          <svg class="arrow" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
      </li>
    {/each}
  </ul>
</section>

<section class="container block" aria-labelledby="h-recent">
  <div class="head">
    <h2 id="h-recent">{t('public.home.recent')}</h2>
    <a href={url.search(lang)}>{t('public.home.seeAll')} →</a>
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

<section class="container block" aria-labelledby="h-steps">
  <h2 id="h-steps">{t('public.home.stepsTitle')}</h2>
  <ol class="steps">
    {#each [1, 2, 3] as n (n)}
      <li>
        <span class="num">{n}</span>
        <h3>{t(`public.home.step${n}.t`)}</h3>
        <p>{t(`public.home.step${n}.p`)}</p>
      </li>
    {/each}
  </ol>
</section>

{#if auth.ready && !auth.session}
  <section class="container block">
    <div class="cta">
      <svg class="cta-mark" viewBox="0 0 64 64" aria-hidden="true">{@html logoMarkSvg('currentColor', 'var(--brand)', 'var(--brand)')}</svg>
      <div>
        <h2>{t('public.home.ctaTitle')}</h2>
        <p>{t('public.home.ctaText')}</p>
      </div>
      <a class="cta-btn" href={url.login(lang)}>{t('public.home.ctaButton')}</a>
    </div>
  </section>
{/if}

<style>
  .hero {
    padding: var(--space-7) 0 var(--space-7); border-bottom: 1px solid var(--line); overflow: hidden;
    background:
      radial-gradient(700px 360px at 92% 20%, color-mix(in srgb, var(--brand) 14%, transparent), transparent 70%),
      radial-gradient(500px 260px at 0% 100%, color-mix(in srgb, var(--rama-plasticas-vivid) 9%, transparent), transparent 70%);
  }
  .hero-grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: var(--space-6); align-items: center; }
  .hero h1 { font-size: clamp(2.5rem, 7.2vw, 5rem); max-width: 13ch; margin-bottom: var(--space-4); line-height: 0.98; }
  .hero h1 em { font-style: normal; color: var(--brand);
    background: linear-gradient(transparent 62%, color-mix(in srgb, var(--rama-plasticas-vivid) 30%, transparent) 62% 92%, transparent 92%); }
  .lead { font-size: clamp(1.05rem, 2.2vw, 1.25rem); max-width: 44ch; color: var(--muted); margin-bottom: var(--space-5); }
  .big-search { display: flex; gap: var(--space-2); max-width: 560px; padding: 6px; background: var(--surface); border: 1px solid var(--line); border-radius: 999px; box-shadow: var(--shadow); }
  .big-search:focus-within { border-color: var(--brand); }
  .big-search input { flex: 1; min-width: 0; padding: 10px 16px; border: 0; background: transparent; min-height: 44px; }
  .big-search input:focus { outline: none; }

  .art { position: relative; aspect-ratio: 1; max-width: 440px; width: 100%; justify-self: center; }
  .halo { position: absolute; inset: 12%; border-radius: 50%; border: 2px dashed color-mix(in srgb, var(--brand) 30%, transparent); }
  .atlas { position: absolute; inset: 24%; width: 52%; height: 52%; filter: drop-shadow(0 18px 30px color-mix(in srgb, var(--brand) 30%, transparent)); }
  .orbit {
    --a: calc(-90deg + var(--i) * 72deg);
    position: absolute; left: 50%; top: 50%;
    translate: calc(-50% + cos(var(--a)) * 38cqi) calc(-50% + sin(var(--a)) * 38cqi);
    border-radius: 30%; box-shadow: var(--shadow-lg);
  }
  .art { container-type: inline-size; }
  @media (prefers-reduced-motion: no-preference) {
    .orbit { animation: bob 5s ease-in-out infinite; animation-delay: calc(var(--i) * -1s); }
    @keyframes bob { 50% { margin-top: -8px; } }
  }

  .block { margin-top: var(--space-8); }
  .head { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-3); flex-wrap: wrap; }
  .head a { font-weight: 600; font-size: 0.95rem; text-decoration: none; color: var(--brand); }

  .branches { list-style: none; margin: var(--space-5) 0 0; padding: 0; display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); }
  .branches a {
    position: relative; display: grid; gap: 6px; align-content: start; height: 100%; padding: var(--space-5) var(--space-4) var(--space-6);
    text-decoration: none; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
    transition: translate 0.2s, box-shadow 0.2s, border-color 0.2s;
  }
  .branches a:hover { color: inherit; translate: 0 -4px; box-shadow: var(--shadow-lg); border-color: color-mix(in srgb, var(--v) 50%, var(--line)); }
  .branches strong { font-family: var(--font-display); font-size: 1.25rem; letter-spacing: -0.02em; color: var(--c); margin-top: var(--space-2); }
  .branches span:not(:global(.badge)) { font-size: 0.9rem; color: var(--muted); }
  .arrow { position: absolute; right: var(--space-4); bottom: var(--space-4); color: var(--c); opacity: 0; translate: -6px 0; transition: opacity 0.2s, translate 0.2s; }
  .branches a:hover .arrow, .branches a:focus-visible .arrow { opacity: 1; translate: 0 0; }

  .plain { list-style: none; padding: 0; margin: var(--space-5) 0 0; }
  .plain > li { display: contents; }

  .steps { list-style: none; margin: var(--space-5) 0 0; padding: 0; display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); }
  .steps li { padding: var(--space-5); border-radius: var(--radius); background: var(--surface-2); }
  .num { display: inline-grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: var(--brand); color: var(--brand-ink); font-weight: 800; font-family: var(--font-display); margin-bottom: var(--space-3); }
  .steps h3 { margin-bottom: var(--space-2); }
  .steps p { margin: 0; color: var(--muted); }

  .cta {
    position: relative; overflow: hidden; display: flex; justify-content: space-between; align-items: center; gap: var(--space-5); flex-wrap: wrap;
    padding: var(--space-7) var(--space-6); border-radius: calc(var(--radius) * 1.5); background: var(--brand); color: var(--brand-ink);
  }
  .cta-mark { position: absolute; right: -40px; bottom: -60px; width: 260px; height: 260px; color: var(--brand-ink); opacity: 0.1; pointer-events: none; }
  .cta > div { position: relative; }
  .cta h2 { color: inherit; margin-bottom: var(--space-2); }
  .cta p { margin: 0; max-width: 52ch; opacity: 0.9; }
  .cta-btn { position: relative; background: var(--brand-ink); color: var(--brand); padding: 14px 24px; border-radius: 999px; font-weight: 700; text-decoration: none; white-space: nowrap; }
  .cta-btn:hover { color: var(--brand); filter: brightness(0.96); }

  @media (max-width: 820px) {
    .hero { padding-top: var(--space-6); }
    .hero-grid { grid-template-columns: 1fr; }
    .art { max-width: 300px; order: -1; }
  }
  @media (max-width: 560px) {
    .branches a { grid-template-columns: auto 1fr; column-gap: var(--space-4); padding: var(--space-4); align-items: center; }
    .branches a > :global(.badge) { grid-row: span 2; }
    .branches strong { margin-top: 0; }
    .arrow { display: none; }
  }
  @media (max-width: 480px) {
    .big-search { flex-direction: column; border-radius: var(--radius); }
    .art { max-width: 230px; }
    .orbit { scale: 0.72; }
    .cta { padding: var(--space-6) var(--space-5); }
  }
</style>
