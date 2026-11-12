<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/auth.svelte';
  import { currentLang, t } from '$lib/i18n';
  import { url } from '$lib/routes';
  import Button from '$lib/components/ui/Button.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import { countMyWorks, listMyParticipations, unreadMessages } from '$lib/api/my';

  const lang = $derived(currentLang());
  const profile = $derived(auth.profile);
  let works = $state<number | null>(null);
  let parts = $state<number | null>(null);
  let unread = $state<number | null>(null);
  let failed = $state(false);

  onMount(async () => {
    const id = auth.userId;
    if (!id) return;
    const [w, p, u] = await Promise.allSettled([countMyWorks(id), listMyParticipations(id), unreadMessages(id)]);
    if (w.status === 'fulfilled') works = w.value;
    if (p.status === 'fulfilled') parts = p.value.length;
    if (u.status === 'fulfilled') unread = u.value;
    failed = w.status === 'rejected' && p.status === 'rejected';
  });

  const cards = $derived([
    { sub: 'obras', title: t('my.nav.works'), count: works, text: t('my.home.worksText') },
    { sub: 'participaciones', title: t('my.nav.participations'), count: parts, text: t('my.home.partsText') },
    { sub: 'mensajes', title: t('nav.messages'), count: unread, text: t('my.home.messagesText'), badge: true },
    { sub: 'perfil', title: t('my.nav.profile'), count: null, text: t('my.home.profileText') },
    { sub: 'cv', title: t('my.nav.cv'), count: null, text: t('my.home.cvText') },
    { sub: 'reclamar', title: t('my.nav.claim'), count: null, text: t('my.home.claimText') }
  ]);
</script>

<svelte:head><title>{t('app.name')} · {t('nav.my')}</title></svelte:head>

<div class="stack">
  <header>
    <p class="eyebrow">{t('nav.my')}</p>
    <h1>{t('my.home.hello', { name: profile?.display_name ?? '' })}</h1>
    {#if profile}
      <p class="row">
        <Button href={url.cv(lang, profile.alias)} variant="secondary" size="sm">{t('my.home.viewCv')}</Button>
        <Button href={url.my(lang, 'obras/nueva')} size="sm">{t('my.home.newWork')}</Button>
      </p>
    {/if}
  </header>

  {#if failed}<Notice kind="error">{t('common.error')}</Notice>{/if}

  <ul class="cards">
    {#each cards as c (c.sub)}
      <li>
        <a class="card" href={url.my(lang, c.sub)}>
          <span class="top">
            <strong>{c.title}</strong>
            {#if c.count !== null}
              <span class="n" class:badge={c.badge && c.count > 0} aria-label={String(c.count)}>{c.count}</span>
            {/if}
          </span>
          <span class="muted">{c.text}</span>
        </a>
      </li>
    {/each}
  </ul>
</div>

<style>
  h1 { font-size: clamp(1.6rem, 4vw, 2.2rem); }
  .cards { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
  .card { display: grid; gap: var(--space-2); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-4); text-decoration: none; height: 100%; }
  .card:hover { border-color: var(--accent); color: inherit; }
  .top { display: flex; justify-content: space-between; align-items: center; gap: var(--space-2); font-family: var(--font-display); font-size: 1.1rem; }
  .n { font-family: var(--font-ui); font-weight: 700; min-width: 28px; text-align: center; padding: 2px 8px; border-radius: 999px; background: var(--surface-2); font-size: 0.85rem; }
  .n.badge { background: var(--accent); color: var(--accent-fg); }
</style>
