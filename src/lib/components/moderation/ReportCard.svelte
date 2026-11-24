<script lang="ts">
  import { currentLang, t } from '$lib/i18n';
  import { url } from '$lib/routes';
  import { formatDateTime } from '$lib/contact/logic';
  import { actionsFor, type ActionSpec } from '$lib/moderation/logic';
  import type { ResolvedTarget } from '$lib/api/moderation';
  import type { ProfilePublic, Report } from '$lib/types';
  import ActionForm from './ActionForm.svelte';
  import TargetSummary from './TargetSummary.svelte';

  let { report, target, reporter, ondone }: {
    report: Report; target?: ResolvedTarget; reporter?: ProfilePublic; ondone: (r: Report, a: ActionSpec) => void;
  } = $props();
  const lang = $derived(currentLang());
  const actions = $derived(actionsFor(report.target_type, report.target_id, target?.ownerId));
</script>

<article class="card">
  <header>
    <span class="reason">{t(`mod.reason.${report.reason}`)}</span>
    <time datetime={report.created_at}>{formatDateTime(report.created_at, lang)}</time>
  </header>
  <TargetSummary type={report.target_type} id={report.target_id} {target} />
  {#if report.details}<p class="details">{report.details}</p>{/if}
  <p class="by muted">
    {t('mod.reportedBy')}
    {#if reporter}<a href={url.cv(lang, reporter.alias)}>@{reporter.alias}</a>{:else}{t('mod.target.unavailable')}{/if}
  </p>
  <ActionForm {actions} reportId={report.id} ondone={(a) => ondone(report, a)} />
</article>

<style>
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-4); display: grid; gap: var(--space-3); min-width: 0; }
  header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--space-2); }
  .reason { font-weight: 700; color: var(--accent); }
  time { color: var(--muted); font-size: 0.8rem; }
  .details { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; background: var(--surface-2); padding: var(--space-3); border-radius: var(--radius-sm); }
  .by { margin: 0; font-size: 0.85rem; }
</style>
