<script lang="ts">
  // Lista completa de participantes de una obra, con cargos y enlace a cada CV.
  import { page } from '$app/state';
  import { untrack } from 'svelte';
  import { currentLang, t, tr } from '$lib/i18n';
  import { url } from '$lib/routes';
  import { getParticipants, getWorkByShortId, loadCatalogsSafe, type ParticipantView } from '$lib/api/public';
  import type { Work } from '$lib/types';
  import Empty from '$lib/components/ui/Empty.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import Meta from '$lib/components/public/Meta.svelte';
  import NotFound from '$lib/components/public/NotFound.svelte';
  import ParticipantList from '$lib/components/public/ParticipantList.svelte';

  type LoadState =
    | { kind: 'loading' } | { kind: 'missing' } | { kind: 'error' }
    | { kind: 'ready'; work: Work; participants: ParticipantView[] };
  let view = $state<LoadState>({ kind: 'loading' });
  const lang = $derived(currentLang());

  $effect(() => {
    const id = page.params.id ?? '';
    let live = true;
    untrack(() => { view = { kind: 'loading' }; });
    (async () => {
      const work = await getWorkByShortId(id);
      if (!work) return { kind: 'missing' } as const;
      const { roles } = await loadCatalogsSafe();
      const participants = await getParticipants(work.id, work.uploader_id, roles);
      return { kind: 'ready', work, participants } as const;
    })()
      .then((s) => { if (live) view = s; })
      .catch(() => { if (live) view = { kind: 'error' }; });
    return () => { live = false; };
  });

  const title = $derived(view.kind === 'ready' ? tr(view.work.title, view.work.lang) || t('public.work.untitled') : '');
</script>

{#if view.kind === 'loading'}
  <Meta title={t('common.loading')} />
  <div class="container pad"><Spinner /></div>
{:else if view.kind === 'error'}
  <Meta title={t('public.error.title')} />
  <div class="container pad"><Notice kind="error">{t('public.error.load')}</Notice></div>
{:else if view.kind === 'missing'}
  <NotFound title={t('public.work.notFoundTitle')} text={t('public.work.notFoundText')} />
{:else}
  <Meta title={t('public.participants.metaTitle', { title })} description={t('public.participants.description', { title })} />
  <div class="container pad wrap">
    <nav aria-label={t('public.participants.breadcrumb')}>
      <a href={url.work(lang, view.work.short_id, title)}>← {title}</a>
    </nav>
    <h1>{t('public.participants.title')}</h1>
    {#if view.participants.length}
      <ParticipantList participants={view.participants} origin={view.work.lang} detailed />
    {:else}
      <Empty>{t('public.participants.none')}</Empty>
    {/if}
  </div>
{/if}

<style>
  .pad { padding-top: var(--space-6); }
  .wrap { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-4); max-width: 760px; }
  .wrap h1 { margin: 0; }
  nav a { text-decoration: none; font-weight: 600; overflow-wrap: anywhere; }
  nav a:hover { text-decoration: underline; }
</style>
