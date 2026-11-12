<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { auth } from '$lib/auth.svelte';
  import { currentLang, t } from '$lib/i18n';
  import { url } from '$lib/routes';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';

  let { children } = $props();
  const lang = $derived(currentLang());
  const path = $derived(page.url.pathname);
  const isWelcome = $derived(/\/mi\/bienvenida$/.test(path));
  let checking = false;

  async function ensureProfile() {
    if (checking) return;
    checking = true;
    try {
      // La sesión puede llegar antes que el perfil (cambio de estado de auth): se confirma antes de redirigir.
      await auth.loadProfile();
      if (!auth.profile && !isWelcome) {
        await goto(`${url.my(lang, 'bienvenida')}?next=${encodeURIComponent(path + page.url.search)}`, { replaceState: true });
      }
    } finally {
      checking = false;
    }
  }

  $effect(() => {
    if (!auth.ready) return;
    if (!auth.session) {
      void goto(url.login(lang, path + page.url.search), { replaceState: true });
      return;
    }
    if (auth.profile === null && !isWelcome) void ensureProfile();
  });

  const ready = $derived(auth.ready && !!auth.session && (!!auth.profile || isWelcome));

  const items = $derived([
    { sub: '', label: t('my.nav.summary') },
    { sub: 'perfil', label: t('my.nav.profile') },
    { sub: 'cv', label: t('my.nav.cv') },
    { sub: 'obras', label: t('my.nav.works') },
    { sub: 'participaciones', label: t('my.nav.participations') },
    { sub: 'mensajes', label: t('nav.messages') },
    { sub: 'notificaciones', label: t('nav.notifications') },
    { sub: 'reclamar', label: t('my.nav.claim') }
  ]);

  function active(sub: string): boolean {
    const base = url.my(lang, sub);
    return sub === '' ? path === base : path === base || path.startsWith(`${base}/`);
  }

  async function logout() {
    await auth.signOut();
    await goto(url.home(lang));
  }
</script>

{#if !ready}
  <div class="container"><Spinner /></div>
{:else if isWelcome}
  {@render children()}
{:else}
  <div class="container shell">
    <aside class="side">
      <div class="who">
        <Avatar path={auth.profile?.avatar_path} name={auth.profile?.display_name ?? '?'} size={44} />
        <div class="names">
          <strong>{auth.profile?.display_name}</strong>
          <small class="muted">@{auth.profile?.alias}</small>
        </div>
      </div>
      <nav aria-label={t('my.nav.label')}>
        <ul>
          {#each items as it (it.sub)}
            <li><a href={url.my(lang, it.sub)} aria-current={active(it.sub) ? 'page' : undefined} class:on={active(it.sub)}>{it.label}</a></li>
          {/each}
          <li><button type="button" onclick={logout}>{t('nav.logout')}</button></li>
        </ul>
      </nav>
    </aside>
    <div class="content">{@render children()}</div>
  </div>
{/if}

<style>
  .shell { display: grid; gap: var(--space-4); padding-top: var(--space-4); }
  .who { display: none; }
  nav ul { list-style: none; margin: 0; padding: 0 0 var(--space-2); display: flex; gap: var(--space-1); overflow-x: auto; scrollbar-width: thin; }
  nav a, nav button { display: block; white-space: nowrap; padding: 10px 14px; border-radius: 999px; text-decoration: none; font-weight: 500; font-size: 0.92rem; border: 0; background: transparent; cursor: pointer; min-height: 44px; }
  nav a:hover, nav button:hover { background: var(--surface-2); color: var(--fg); }
  nav a.on { background: var(--fg); color: var(--bg); }
  nav button { color: var(--muted); }
  .content { min-width: 0; }
  @media (min-width: 880px) {
    .shell { grid-template-columns: 220px minmax(0, 1fr); gap: var(--space-6); padding-top: var(--space-6); align-items: start; }
    .side { position: sticky; top: 80px; }
    .who { display: flex; gap: var(--space-3); align-items: center; margin-bottom: var(--space-4); }
    .names { display: grid; min-width: 0; }
    .names strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    nav ul { flex-direction: column; overflow: visible; }
    nav a, nav button { border-radius: var(--radius-sm); text-align: left; width: 100%; }
  }
</style>
