<script lang="ts">
  import { page } from '$app/state';
  import { auth } from '$lib/auth.svelte';
  import { currentLang, t, LANGS } from '$lib/i18n';
  import { switchLang, url } from '$lib/routes';
  import Avatar from '$lib/components/ui/Avatar.svelte';

  let { children } = $props();
  const lang = $derived(currentLang());
  const path = $derived(page.url.pathname + page.url.search);
  let q = $state('');

  $effect(() => { document.documentElement.lang = lang; });
</script>

<svelte:head>
  {#each LANGS as l}
    <link rel="alternate" hreflang={l} href="{page.url.origin}{switchLang(page.url.pathname, l)}" />
  {/each}
</svelte:head>

<a class="skip" href="#main">Saltar al contenido</a>
<header class="top">
  <div class="container bar">
    <a class="logo" href={url.home(lang)} aria-label={t('nav.home')}>rebel<span>arte</span></a>
    <form class="search" role="search" action="/{lang}/buscar" method="get">
      <label class="sr-only" for="q">{t('nav.search')}</label>
      <input id="q" name="q" type="search" placeholder={t('nav.search')} bind:value={q} />
    </form>
    <nav class="nav" aria-label="Principal">
      {#if auth.session}
        {#if auth.isModerator}<a href={url.moderation(lang)}>{t('nav.moderation')}</a>{/if}
        <a href={url.my(lang, 'mensajes')}>{t('nav.messages')}</a>
        <a class="me" href={url.my(lang)}>
          <Avatar path={auth.profile?.avatar_path} name={auth.profile?.display_name ?? '?'} size={30} />
          <span class="sr-only">{t('nav.my')}</span>
        </a>
      {:else if auth.ready}
        <a class="login" href={url.login(lang, path)}>{t('nav.login')}</a>
      {/if}
      <a class="lang" href={switchLang(path, lang === 'es' ? 'en' : 'es')} hreflang={lang === 'es' ? 'en' : 'es'}
        aria-label={t('nav.lang')}>{lang === 'es' ? 'EN' : 'ES'}</a>
    </nav>
  </div>
</header>

<main id="main">
  {@render children()}
</main>

<footer class="foot">
  <div class="container row">
    <span class="logo small">rebel<span>arte</span></span>
    <span class="muted">{t('app.tagline')}</span>
    <nav class="row legal" aria-label="Legal">
      <a href={url.legal(lang, 'aviso')}>{t('footer.legal')}</a>
      <a href={url.legal(lang, 'condiciones')}>{t('footer.terms')}</a>
      <a href={url.legal(lang, 'privacidad')}>{t('footer.privacy')}</a>
    </nav>
  </div>
</footer>

<style>
  .skip { position: absolute; left: -9999px; }
  .skip:focus { left: 16px; top: 16px; z-index: 10; background: var(--surface); padding: 8px 12px; }
  .top { border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(8px); position: sticky; top: 0; z-index: 5; }
  .bar { display: flex; align-items: center; gap: var(--space-4); min-height: 64px; }
  .logo { font-family: var(--font-display); font-weight: 800; font-size: 1.5rem; letter-spacing: -0.02em; text-decoration: none; color: var(--fg); }
  .logo span { color: var(--accent); }
  .logo.small { font-size: 1.1rem; }
  .search { flex: 1; max-width: 420px; }
  .search input { width: 100%; padding: 9px 14px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); }
  .nav { display: flex; align-items: center; gap: var(--space-4); margin-left: auto; font-weight: 500; font-size: 0.95rem; }
  .nav a { text-decoration: none; }
  .me { display: inline-flex; }
  .lang { font-size: 0.8rem; font-weight: 700; border: 1px solid var(--line); border-radius: 999px; padding: 3px 9px; }
  main { min-height: 70vh; }
  .foot { border-top: 1px solid var(--line); padding: var(--space-6) 0; margin-top: var(--space-8); font-size: 0.9rem; }
  .legal { margin-left: auto; }
  @media (max-width: 640px) {
    .bar { flex-wrap: wrap; padding-top: 8px; padding-bottom: 8px; }
    .search { order: 3; flex-basis: 100%; max-width: none; }
    .nav a:not(.me):not(.lang):not(.login) { display: none; }
    .legal { margin-left: 0; }
  }
</style>
