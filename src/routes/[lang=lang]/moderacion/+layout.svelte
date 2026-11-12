<script lang="ts">
  import { page } from '$app/state';
  import { auth } from '$lib/auth.svelte';
  import { currentLang, t } from '$lib/i18n';
  import { url } from '$lib/routes';
  import Button from '$lib/components/ui/Button.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';

  let { children } = $props();
  const lang = $derived(currentLang());
  const base = $derived(url.moderation(lang));
  const tabs = $derived([
    { href: base, label: t('mod.tab.reports') },
    { href: `${base}/premios`, label: t('mod.tab.awards') },
    { href: `${base}/ocultas`, label: t('mod.tab.hidden') },
    { href: `${base}/historial`, label: t('mod.tab.history') }
  ]);
  const path = $derived(page.url.pathname.replace(/\/$/, ''));
</script>

<svelte:head><title>{t('mod.title')} · Rebelarte</title></svelte:head>

<div class="container wrap">
  {#if !auth.ready}
    <Spinner />
  {:else if !auth.session}
    <h1>{t('mod.title')}</h1>
    <Notice kind="warn">{t('mod.needLogin')}</Notice>
    <p><Button href={url.login(lang, page.url.pathname)}>{t('contact.login')}</Button></p>
  {:else if !auth.isModerator}
    <h1>{t('mod.forbidden.title')}</h1>
    <Notice kind="warn">{t('mod.forbidden.body')}</Notice>
    <p><Button variant="secondary" href={url.home(lang)}>{t('mod.forbidden.home')}</Button></p>
  {:else}
    <h1>{t('mod.title')}</h1>
    <nav class="tabs" aria-label={t('mod.title')}>
      {#each tabs as tab}
        <a href={tab.href} aria-current={path === tab.href ? 'page' : undefined} class:on={path === tab.href}>{tab.label}</a>
      {/each}
    </nav>
    {@render children()}
  {/if}
</div>

<style>
  .wrap { padding-top: var(--space-5); }
  h1 { font-size: clamp(1.6rem, 4vw, 2.2rem); }
  .tabs { display: flex; gap: var(--space-1); overflow-x: auto; border-bottom: 1px solid var(--line); margin-bottom: var(--space-5); }
  .tabs a { padding: 10px 14px; text-decoration: none; white-space: nowrap; border-bottom: 3px solid transparent; font-weight: 500; min-height: 44px; display: inline-flex; align-items: center; }
  .tabs a.on { border-color: var(--accent); font-weight: 700; }
</style>
