<script lang="ts">
  import { currentLang, t } from '$lib/i18n';
  import { url } from '$lib/routes';
  import { PAGE, listHiddenWorks, type HiddenWork } from '$lib/api/moderation';
  import { fetchProfiles } from '$lib/api/contact';
  import { formatDateTime, pickText } from '$lib/contact/logic';
  import type { ActionSpec } from '$lib/moderation/logic';
  import type { ProfilePublic } from '$lib/types';
  import ActionForm from '$lib/components/moderation/ActionForm.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Empty from '$lib/components/ui/Empty.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';

  const lang = $derived(currentLang());
  let works = $state<HiddenWork[]>([]);
  let owners = $state(new Map<string, ProfilePublic>());
  let loading = $state(true);
  let loadingMore = $state(false);
  let hasMore = $state(false);
  let error = $state(false);
  let flash = $state<string | null>(null);

  async function fetchPage(offset: number) {
    const rows = await listHiddenWorks(offset);
    const ps = await fetchProfiles(rows.map((w) => w.uploader_id));
    owners = new Map([...owners, ...ps.map((p) => [p.id, p] as const)]);
    hasMore = rows.length === PAGE;
    return rows;
  }
  async function load() {
    loading = true;
    error = false;
    try {
      works = await fetchPage(0);
    } catch {
      error = true;
    } finally {
      loading = false;
    }
  }
  async function more() {
    loadingMore = true;
    try {
      works = [...works, ...(await fetchPage(works.length))];
    } catch {
      error = true;
    } finally {
      loadingMore = false;
    }
  }
  function restoreSpec(w: HiddenWork): ActionSpec {
    return { action: 'restore', targetType: 'work', targetId: w.id, label: 'mod.action.restore', destructive: false };
  }
  function done(w: HiddenWork) {
    works = works.filter((x) => x.id !== w.id);
    flash = t('mod.done', { action: t('mod.action.restore') });
  }
  $effect(() => { void load(); });
</script>

<h2 class="sr-only">{t('mod.tab.hidden')}</h2>
{#if flash}<Notice kind="ok">{flash}</Notice>{/if}
{#if loading}
  <Spinner />
{:else if error && !works.length}
  <Notice kind="error">{t('common.error')} <Button size="sm" variant="secondary" onclick={load}>{t('contact.retry')}</Button></Notice>
{:else if !works.length}
  <Empty>{t('mod.hidden.empty')}</Empty>
{:else}
  <ul class="list">
    {#each works as w (w.id)}
      {@const title = pickText(w.title, lang)}
      {@const owner = owners.get(w.uploader_id)}
      <li>
        <div>
          <a href={url.work(lang, w.short_id, title)}><strong>{title || w.short_id}</strong></a>
          <div class="muted">
            {#if owner}<a href={url.cv(lang, owner.alias)}>@{owner.alias}</a> · {/if}{formatDateTime(w.updated_at, lang)}
          </div>
        </div>
        <ActionForm actions={[restoreSpec(w)]} ondone={() => done(w)} />
      </li>
    {/each}
  </ul>
  {#if error}<Notice kind="error">{t('common.error')}</Notice>{/if}
  {#if hasMore}<div class="row more"><Button variant="secondary" loading={loadingMore} onclick={more}>{t('common.more')}</Button></div>{/if}
{/if}

<style>
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); }
  li { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-4); display: grid; gap: var(--space-3); overflow-wrap: anywhere; }
  .more { justify-content: center; margin-top: var(--space-4); }
</style>
