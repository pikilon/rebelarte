<script lang="ts">
  import { currentLang, t } from '$lib/i18n';
  import { url } from '$lib/routes';
  import { PAGE, fetchAliases, listActions, resolveTargets, type ModerationActionRow, type ResolvedTarget } from '$lib/api/moderation';
  import { formatDateTime } from '$lib/contact/logic';
  import { reportKey } from '$lib/moderation/logic';
  import type { ProfilePublic } from '$lib/types';
  import TargetSummary from '$lib/components/moderation/TargetSummary.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Empty from '$lib/components/ui/Empty.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';

  const lang = $derived(currentLang());
  let rows = $state<ModerationActionRow[]>([]);
  let targets = $state(new Map<string, ResolvedTarget>());
  let mods = $state(new Map<string, ProfilePublic>());
  let loading = $state(true);
  let loadingMore = $state(false);
  let hasMore = $state(false);
  let error = $state(false);

  async function fetchPage(offset: number) {
    const page = await listActions(offset);
    const [r, m] = await Promise.all([
      resolveTargets(page),
      fetchAliases(page.map((a) => a.moderator_id).filter((x): x is string => !!x))
    ]);
    targets = new Map([...targets, ...r.targets]);
    mods = new Map([...mods, ...m]);
    hasMore = page.length === PAGE;
    return page;
  }
  async function load() {
    loading = true;
    error = false;
    try {
      rows = await fetchPage(0);
    } catch {
      error = true;
    } finally {
      loading = false;
    }
  }
  async function more() {
    loadingMore = true;
    try {
      rows = [...rows, ...(await fetchPage(rows.length))];
    } catch {
      error = true;
    } finally {
      loadingMore = false;
    }
  }
  $effect(() => { void load(); });
</script>

<h2 class="sr-only">{t('mod.tab.history')}</h2>
{#if loading}
  <Spinner />
{:else if error && !rows.length}
  <Notice kind="error">{t('common.error')} <Button size="sm" variant="secondary" onclick={load}>{t('contact.retry')}</Button></Notice>
{:else if !rows.length}
  <Empty>{t('mod.history.empty')}</Empty>
{:else}
  <ul class="list">
    {#each rows as a (a.id)}
      {@const mod = a.moderator_id ? mods.get(a.moderator_id) : undefined}
      <li>
        <div class="top">
          <strong>{t(`mod.action.${a.action}`)}</strong>
          <time datetime={a.created_at}>{formatDateTime(a.created_at, lang)}</time>
        </div>
        <TargetSummary type={a.target_type} id={a.target_id} target={targets.get(reportKey(a))} />
        {#if a.note}<p class="note">{a.note}</p>{/if}
        <p class="by muted">{t('mod.history.by')} {#if mod}<a href={url.cv(lang, mod.alias)}>@{mod.alias}</a>{:else}—{/if}</p>
      </li>
    {/each}
  </ul>
  {#if error}<Notice kind="error">{t('common.error')}</Notice>{/if}
  {#if hasMore}<div class="row more"><Button variant="secondary" loading={loadingMore} onclick={more}>{t('common.more')}</Button></div>{/if}
{/if}

<style>
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); }
  li { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-4); display: grid; gap: var(--space-2); min-width: 0; }
  .top { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--space-2); }
  time { color: var(--muted); font-size: 0.8rem; }
  .note { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; background: var(--surface-2); padding: var(--space-3); border-radius: var(--radius-sm); }
  .by { margin: 0; font-size: 0.85rem; }
  .more { justify-content: center; margin-top: var(--space-4); }
</style>
