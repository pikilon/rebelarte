<script lang="ts">
  import { t } from '$lib/i18n';
  import { PAGE, listOpenReports, resolveTargets, type ResolvedTarget } from '$lib/api/moderation';
  import type { ActionSpec } from '$lib/moderation/logic';
  import type { ProfilePublic, Report } from '$lib/types';
  import ReportCard from '$lib/components/moderation/ReportCard.svelte';
  import { reportKey } from '$lib/moderation/logic';
  import Button from '$lib/components/ui/Button.svelte';
  import Empty from '$lib/components/ui/Empty.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';

  let reports = $state<Report[]>([]);
  let targets = $state(new Map<string, ResolvedTarget>());
  let profiles = $state(new Map<string, ProfilePublic>());
  let loading = $state(true);
  let loadingMore = $state(false);
  let hasMore = $state(false);
  let error = $state(false);
  let flash = $state<string | null>(null);

  async function fetchPage(offset: number) {
    const rows = await listOpenReports(offset);
    const r = await resolveTargets(rows, rows.map((x) => x.reporter_id).filter((x): x is string => !!x));
    targets = new Map([...targets, ...r.targets]);
    profiles = new Map([...profiles, ...r.profiles]);
    hasMore = rows.length === PAGE;
    return rows;
  }

  async function load() {
    loading = true;
    error = false;
    try {
      reports = await fetchPage(0);
    } catch {
      error = true;
    } finally {
      loading = false;
    }
  }

  async function more() {
    loadingMore = true;
    try {
      reports = [...reports, ...(await fetchPage(reports.length))];
    } catch {
      error = true;
    } finally {
      loadingMore = false;
    }
  }

  function done(r: Report, a: ActionSpec) {
    reports = reports.filter((x) => x.id !== r.id);
    flash = t('mod.done', { action: t(a.label) });
  }

  $effect(() => { void load(); });
</script>

<h2 class="sr-only">{t('mod.tab.reports')}</h2>
{#if flash}<Notice kind="ok">{flash}</Notice>{/if}
{#if loading}
  <Spinner />
{:else if error && !reports.length}
  <Notice kind="error">{t('common.error')} <Button size="sm" variant="secondary" onclick={load}>{t('contact.retry')}</Button></Notice>
{:else if !reports.length}
  <Empty>{t('mod.reports.empty')}</Empty>
{:else}
  <p class="muted">{t('mod.reports.count', { n: reports.length })}</p>
  <div class="list">
    {#each reports as r (r.id)}
      <ReportCard report={r} target={targets.get(reportKey(r))} reporter={r.reporter_id ? profiles.get(r.reporter_id) : undefined} ondone={done} />
    {/each}
  </div>
  {#if error}<Notice kind="error">{t('common.error')}</Notice>{/if}
  {#if hasMore}<div class="row more"><Button variant="secondary" loading={loadingMore} onclick={more}>{t('common.more')}</Button></div>{/if}
{/if}

<style>
  .list { display: grid; gap: var(--space-4); }
  .more { justify-content: center; margin-top: var(--space-4); }
</style>
