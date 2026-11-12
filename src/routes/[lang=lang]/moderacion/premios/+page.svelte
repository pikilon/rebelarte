<script lang="ts">
  import { currentLang, t } from '$lib/i18n';
  import { PAGE, listUnverifiedAwards } from '$lib/api/moderation';
  import { pickText } from '$lib/contact/logic';
  import { actionsFor, type ActionSpec } from '$lib/moderation/logic';
  import type { Award } from '$lib/types';
  import ActionForm from '$lib/components/moderation/ActionForm.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Empty from '$lib/components/ui/Empty.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';

  const lang = $derived(currentLang());
  let awards = $state<Award[]>([]);
  let loading = $state(true);
  let loadingMore = $state(false);
  let hasMore = $state(false);
  let error = $state(false);
  let flash = $state<string | null>(null);

  async function load() {
    loading = true;
    error = false;
    try {
      const rows = await listUnverifiedAwards(0);
      awards = rows;
      hasMore = rows.length === PAGE;
    } catch {
      error = true;
    } finally {
      loading = false;
    }
  }
  async function more() {
    loadingMore = true;
    try {
      const rows = await listUnverifiedAwards(awards.length);
      awards = [...awards, ...rows];
      hasMore = rows.length === PAGE;
    } catch {
      error = true;
    } finally {
      loadingMore = false;
    }
  }
  function verifySpec(a: Award): ActionSpec {
    return { action: 'verify_award', targetType: 'award', targetId: a.id, label: 'mod.action.verify_award', destructive: false };
  }
  function done(a: Award) {
    awards = awards.filter((x) => x.id !== a.id);
    flash = t('mod.done', { action: t('mod.action.verify_award') });
  }
  $effect(() => { void load(); });
</script>

<h2 class="sr-only">{t('mod.tab.awards')}</h2>
<p class="muted">{t('mod.awards.intro')}</p>
{#if flash}<Notice kind="ok">{flash}</Notice>{/if}
{#if loading}
  <Spinner />
{:else if error && !awards.length}
  <Notice kind="error">{t('common.error')} <Button size="sm" variant="secondary" onclick={load}>{t('contact.retry')}</Button></Notice>
{:else if !awards.length}
  <Empty>{t('mod.awards.empty')}</Empty>
{:else}
  <ul class="list">
    {#each awards as a (a.id)}
      <li>
        <div>
          <strong>{pickText(a.name, lang)}</strong>
          <div class="muted">{[a.year, a.organization].filter(Boolean).join(' · ')}</div>
          {#if pickText(a.description, lang)}<p class="desc">{pickText(a.description, lang)}</p>{/if}
        </div>
        <ActionForm actions={[verifySpec(a)]} ondone={() => done(a)} />
      </li>
    {/each}
  </ul>
  {#if error}<Notice kind="error">{t('common.error')}</Notice>{/if}
  {#if hasMore}<div class="row more"><Button variant="secondary" loading={loadingMore} onclick={more}>{t('common.more')}</Button></div>{/if}
{/if}

<style>
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); }
  li { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-4); display: grid; gap: var(--space-3); overflow-wrap: anywhere; }
  .desc { margin: var(--space-2) 0 0; }
  .more { justify-content: center; margin-top: var(--space-4); }
</style>
