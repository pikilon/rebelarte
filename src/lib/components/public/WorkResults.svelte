<script lang="ts">
  // Rejilla de obras con estados de carga, vacío, error y «ver más».
  import { t } from '$lib/i18n';
  import WorkCardView from '$lib/components/ui/WorkCard.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Empty from '$lib/components/ui/Empty.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import type { PagedWorks } from '$lib/api/paged.svelte';

  let { list, showAuthor = true, emptyText }: { list: PagedWorks; showAuthor?: boolean; emptyText?: string } = $props();
</script>

{#if list.status === 'loading' || list.status === 'idle'}
  <Spinner />
{:else if list.status === 'error'}
  <Notice kind="error">{t('public.error.load')}</Notice>
{:else if list.items.length === 0}
  <Empty>{emptyText ?? t('public.results.none')}</Empty>
{:else}
  <ul class="grid-cards list">
    {#each list.items as w (w.id)}
      <li><WorkCardView work={w} {showAuthor} /></li>
    {/each}
  </ul>
  {#if list.moreError}<Notice kind="error">{t('public.error.load')}</Notice>{/if}
  {#if list.more}
    <div class="more">
      <Button variant="secondary" loading={list.loadingMore} onclick={() => list.next()}>{t('common.more')}</Button>
    </div>
  {/if}
{/if}

<style>
  .list { list-style: none; padding: 0; margin: 0; }
  .list > li { display: contents; }
  .more { display: flex; justify-content: center; margin-top: var(--space-6); }
</style>
