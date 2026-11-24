<script lang="ts">
  import { page } from '$app/state';
  import { auth } from '$lib/auth.svelte';
  import { currentLang, t, LANGS } from '$lib/i18n';
  import { switchLang, url } from '$lib/routes';
  import { BRANCHES } from '$lib/types';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Logo from '$lib/components/ui/Logo.svelte';
  import BranchIcon from '$lib/components/ui/BranchIcon.svelte';
  import UnreadBadge from '$lib/components/contact/UnreadBadge.svelte';

  let { children } = $props();
  const lang = $derived(currentLang());
  const path = $derived(page.url.pathname + page.url.search);
  const activeBranch = $derived(page.params.rama ?? null);
  // La franja de ramas acompaña a las páginas públicas; en Mi Rebelarte y moderación estorba.
  const showBranches = $derived(!/^\/(es|en)\/(mi|moderacion|entrar)(\/|$)/.test(page.url.pathname));
  let q = $state('');

  $effect(() => { document.documentElement.lang = lang; });
</script>

<svelte:head>
  {#each LANGS as l}
    <link rel="alternate" hreflang={l} href="{page.url.origin}{switchLang(page.url.pathname, l)}" />
  {/each}
</svelte:head>

<a class="skip" href="#main">{t('nav.skip')}</a>
<header class="top">
  <div class="container bar">
    <a class="home" href={url.home(lang)} aria-label="Rebelarte · {t('nav.home')}">
      <Logo size={38} />
    </a>
    <form class="search" role="search" action="/{lang}/buscar" method="get">
      <label class="sr-only" for="q">{t('nav.search')}</label>
      <svg class="lens" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
      <input id="q" name="q" type="search" placeholder={t('nav.search')} bind:value={q} />
    </form>
    <nav class="nav" aria-label="Principal">
      {#if auth.session}
        {#if auth.isModerator}<a class="txt" href={url.moderation(lang)}>{t('nav.moderation')}</a>{/if}
        <a class="txt" href={url.my(lang, 'mensajes')}>{t('nav.messages')} <UnreadBadge /></a>
        <a class="me" href={url.my(lang)} title={t('nav.my')}>
          <Avatar path={auth.profile?.avatar_path} name={auth.profile?.display_name ?? '?'} size={34} />
          <span class="sr-only">{t('nav.my')}</span>
        </a>
      {:else if auth.ready}
        <a class="login" href={url.login(lang, path)}>{t('nav.login')}</a>
      {/if}
      <a class="lang" href={switchLang(path, lang === 'es' ? 'en' : 'es')} hreflang={lang === 'es' ? 'en' : 'es'}
        aria-label={t('nav.lang')}>{lang === 'es' ? 'EN' : 'ES'}</a>
    </nav>
  </div>
  {#if showBranches}
    <nav class="branches" aria-label={t('nav.branches')}>
      <ul class="container">
        {#each BRANCHES as b (b)}
          <li>
            <a href={url.branch(lang, b)} style:--c="var(--rama-{b})" aria-current={activeBranch === b ? 'page' : undefined}>
              <BranchIcon branch={b} size={20} />
              <span>{t(`branch.${b}`)}</span>
            </a>
          </li>
        {/each}
      </ul>
    </nav>
  {/if}
</header>

<main id="main">
  {@render children()}
</main>

<footer class="foot">
  <div class="container cols">
    <div class="about">
      <Logo size={44} tagline={t('app.short')} />
      <p class="muted">{t('app.tagline')}. {t('footer.since')}</p>
    </div>
    <nav aria-label={t('footer.explore')}>
      <h2>{t('footer.explore')}</h2>
      <ul>
        {#each BRANCHES as b (b)}
          <li><a href={url.branch(lang, b)} style:--c="var(--rama-{b})"><BranchIcon branch={b} size={18} /> {t(`branch.${b}`)}</a></li>
        {/each}
      </ul>
    </nav>
    <nav aria-label="Legal">
      <h2>{t('footer.about')}</h2>
      <ul>
        <li><a href={url.search(lang)}>{t('nav.search')}</a></li>
        <li><a href={url.legal(lang, 'aviso')}>{t('footer.legal')}</a></li>
        <li><a href={url.legal(lang, 'condiciones')}>{t('footer.terms')}</a></li>
        <li><a href={url.legal(lang, 'privacidad')}>{t('footer.privacy')}</a></li>
      </ul>
    </nav>
  </div>
  <div class="stripe" aria-hidden="true">
    {#each BRANCHES as b (b)}<span style:background="var(--rama-{b}-vivid)"></span>{/each}
  </div>
</footer>

<style>
  .skip { position: absolute; left: -9999px; }
  .skip:focus { left: 16px; top: 16px; z-index: 10; background: var(--surface); padding: 8px 12px; border-radius: var(--radius-sm); }
  .top {
    position: sticky; top: 0; z-index: 5;
    background: color-mix(in srgb, var(--bg) 86%, transparent);
    backdrop-filter: saturate(1.4) blur(12px);
    border-bottom: 1px solid var(--line);
  }
  .bar { display: flex; align-items: center; gap: var(--space-4); min-height: var(--header-h); }
  .home { text-decoration: none; display: inline-flex; border-radius: var(--radius-sm); }
  .home:hover { color: inherit; }
  .search { flex: 1; max-width: 440px; position: relative; margin-left: var(--space-3); }
  .lens { position: absolute; left: 14px; top: 50%; translate: 0 -50%; color: var(--muted); pointer-events: none; }
  .search input {
    width: 100%; padding: 10px 16px 10px 40px; border-radius: 999px; border: 1px solid var(--line);
    background: var(--surface); min-height: 42px; transition: border-color 0.15s, box-shadow 0.15s;
  }
  .search input:focus { outline: none; border-color: var(--brand); box-shadow: 0 0 0 4px color-mix(in srgb, var(--brand) 18%, transparent); }
  .nav { display: flex; align-items: center; gap: var(--space-4); margin-left: auto; font-weight: 600; font-size: 0.93rem; }
  .nav a { text-decoration: none; }
  .me { display: inline-flex; border-radius: 50%; box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--brand); }
  .login { background: var(--brand); color: var(--brand-ink); padding: 9px 18px; border-radius: 999px; }
  .login:hover { color: var(--brand-ink); background: var(--brand-strong); }
  .lang { font-size: 0.78rem; font-weight: 700; border: 1px solid var(--line); border-radius: 999px; padding: 4px 10px; color: var(--muted); }

  .branches { border-top: 1px solid var(--line); }
  .branches ul {
    list-style: none; margin: 0 auto; display: flex; gap: var(--space-1);
    overflow-x: auto; scrollbar-width: none; overscroll-behavior-x: contain;
  }
  .branches a {
    display: inline-flex; align-items: center; gap: 8px; padding: 10px 12px; white-space: nowrap;
    text-decoration: none; font-weight: 600; font-size: 0.92rem; color: var(--muted);
    border-bottom: 3px solid transparent; transition: color 0.15s, border-color 0.15s;
  }
  .branches a :global(svg) { color: var(--c); }
  .branches a:hover { color: var(--fg); border-bottom-color: color-mix(in srgb, var(--c) 45%, transparent); }
  .branches a[aria-current='page'] { color: var(--c); border-bottom-color: var(--c); }

  main { min-height: 70vh; }

  .foot { margin-top: var(--space-8); background: var(--surface); border-top: 1px solid var(--line); font-size: 0.93rem; }
  .cols { display: grid; gap: var(--space-6); grid-template-columns: 2fr 1fr 1fr; padding-top: var(--space-7); padding-bottom: var(--space-6); }
  .about p { margin-top: var(--space-4); max-width: 42ch; }
  .foot h2 { font-family: var(--font-ui); font-size: 0.76rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); margin-bottom: var(--space-3); }
  .foot ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .foot ul a { text-decoration: none; display: inline-flex; align-items: center; gap: 8px; }
  .foot ul a :global(svg) { color: var(--c); }
  .stripe { display: grid; grid-template-columns: repeat(5, 1fr); height: 6px; }

  @media (max-width: 760px) {
    .bar { flex-wrap: wrap; padding-top: 10px; padding-bottom: 10px; gap: var(--space-3); }
    .search { order: 3; flex-basis: 100%; max-width: none; margin-left: 0; }
    .nav { gap: var(--space-3); }
    .nav .txt { display: none; }
    .cols { grid-template-columns: 1fr 1fr; }
    .about { grid-column: 1 / -1; }
  }
</style>
