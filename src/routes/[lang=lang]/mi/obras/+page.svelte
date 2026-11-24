<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/auth.svelte';
  import { currentLang, t, tr } from '$lib/i18n';
  import { url } from '$lib/routes';
  import type { Work } from '$lib/types';
  import Button from '$lib/components/ui/Button.svelte';
  import Empty from '$lib/components/ui/Empty.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import Tag from '$lib/components/ui/Tag.svelte';
  import { listMyWorks } from '$lib/api/my';
  import { WORK_STATUS_FILTERS } from '$lib/components/my/logic';

  const lang = $derived(currentLang());
  let works = $state<Work[]>([]);
  let loading = $state(true);
  let failed = $state(false);
  let filter = $state<(typeof WORK_STATUS_FILTERS)[number]>('all');

  const shown = $derived(filter === 'all' ? works : works.filter((w) => w.status === filter));

  onMount(load);
  async function load() {
    loading = true;
    failed = false;
    try {
      works = await listMyWorks(auth.userId ?? '');
    } catch {
      failed = true;
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>{t('my.nav.works')} · {t('app.name')}</title></svelte:head>

<div class="stack">
  <div class="head">
    <h1>{t('my.nav.works')}</h1>
    <Button href={url.my(lang, 'obras/nueva')}>{t('my.works.new')}</Button>
  </div>

  {#if loading}
    <Spinner />
  {:else if failed}
    <Notice kind="error">{t('common.error')} <Button size="sm" variant="secondary" onclick={load}>{t('my.retry')}</Button></Notice>
  {:else if !works.length}
    <Empty>
      <p>{t('my.works.empty')}</p>
      <Button href={url.my(lang, 'obras/nueva')}>{t('my.works.new')}</Button>
    </Empty>
  {:else}
    <div class="filter">
      <label for="wf">{t('my.works.filter')}</label>
      <select id="wf" bind:value={filter}>
        {#each WORK_STATUS_FILTERS as f}<option value={f}>{f === 'all' ? t('my.works.all') : t(`my.work.status.${f}`)}</option>{/each}
      </select>
    </div>
    {#if shown.length}
      <ul class="list">
        {#each shown as w (w.id)}
          <li class="item">
            <div class="main">
              <Tag branch={w.branch}>{t(`branch.${w.branch}`)}</Tag>
              <h2><a href={url.my(lang, `obras/${w.id}`)}>{tr(w.title, w.lang) || t('my.works.untitled')}</a></h2>
              <p class="meta muted">
                <span class="st st-{w.status}">{t(`my.work.status.${w.status}`)}</span>
                · {t(`my.work.vis.${w.visibility}`)}
                · {new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(w.updated_at))}
              </p>
            </div>
            <div class="acts">
              <Button size="sm" variant="secondary" href={url.my(lang, `obras/${w.id}`)}>{t('common.edit')}</Button>
              {#if w.status === 'published'}<Button size="sm" variant="ghost" href={url.work(lang, w.short_id, tr(w.title, w.lang))}>{t('my.works.view')}</Button>{/if}
            </div>
          </li>
        {/each}
      </ul>
    {:else}
      <Empty>{t('my.works.noneFilter')}</Empty>
    {/if}
  {/if}
</div>

<style>
  h1 { font-size: clamp(1.6rem, 4vw, 2.2rem); margin: 0; }
  .head { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; justify-content: space-between; }
  .filter { display: flex; gap: var(--space-3); align-items: center; }
  .filter label { font-weight: 600; font-size: 0.9rem; }
  .filter select { padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface); min-height: 40px; }
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); }
  .item { display: grid; gap: var(--space-3); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-4); }
  h2 { font-size: 1.2rem; margin: var(--space-2) 0 var(--space-1); overflow-wrap: anywhere; }
  h2 a { text-decoration: none; }
  .meta { margin: 0; font-size: 0.88rem; }
  .st { font-weight: 600; }
  .st-published { color: var(--ok); }
  .st-hidden { color: var(--danger); }
  .st-draft, .st-review { color: var(--warn); }
  .acts { display: flex; gap: var(--space-2); flex-wrap: wrap; }
  @media (min-width: 720px) { .item { grid-template-columns: 1fr auto; align-items: center; } }
</style>
