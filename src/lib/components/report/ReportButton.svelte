<script lang="ts">
  // Enlace discreto «Denunciar» con diálogo (spec §9). Solo usuarios registrados: reporter_id es el usuario.
  import { page } from '$app/state';
  import { auth } from '$lib/auth.svelte';
  import { currentLang, t } from '$lib/i18n';
  import { url } from '$lib/routes';
  import type { ReportReason, ReportTarget } from '$lib/types';
  import { createReport } from '$lib/api/moderation';
  import { REPORT_DETAILS_MAX, REPORT_REASONS, validateReport } from '$lib/moderation/logic';
  import Button from '$lib/components/ui/Button.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';

  let { targetType, targetId }: { targetType: ReportTarget; targetId: string } = $props();

  const uid = $props.id();
  const lang = $derived(currentLang());
  const next = $derived(page.url.pathname + page.url.search);
  let open = $state(false);
  let reason = $state<ReportReason | ''>('');
  let details = $state('');
  let touched = $state(false);
  let sending = $state(false);
  let error = $state<string | null>(null);
  let done = $state(false);

  const problem = $derived(validateReport(reason, details));

  function show() {
    error = null;
    touched = false;
    open = true;
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    touched = true;
    if (problem || !reason || !auth.userId) return;
    sending = true;
    error = null;
    try {
      await createReport({ reporterId: auth.userId, targetType, targetId, reason, details });
      done = true;
      reason = '';
      details = '';
    } catch {
      error = t('mod.report.error');
    } finally {
      sending = false;
    }
  }

  function closed() {
    done = false;
  }
</script>

<button type="button" class="link" onclick={show}>{t('mod.report.button')}</button>

<Dialog bind:open title={t('mod.report.title')} onclose={closed}>
  {#if !auth.ready}
    <p class="muted">{t('common.loading')}</p>
  {:else if !auth.session}
    <p>{t('mod.report.needLogin')}</p>
    <div class="row"><Button href={url.login(lang, next)}>{t('contact.login')}</Button></div>
  {:else if done}
    <Notice kind="ok">{t('mod.report.sent')}</Notice>
    <div class="row"><Button variant="ghost" onclick={() => (open = false)}>{t('common.close')}</Button></div>
  {:else}
    <form class="form" onsubmit={submit} novalidate>
      <fieldset aria-describedby={touched && problem === 'reason' ? `${uid}-reason-err` : undefined}>
        <legend>{t('mod.report.reason')}</legend>
        {#each REPORT_REASONS as r}
          <label class="opt"><input type="radio" name="{uid}-reason" value={r} bind:group={reason} /> {t(`mod.reason.${r}`)}</label>
        {/each}
        {#if touched && problem === 'reason'}<small class="err" id="{uid}-reason-err" role="alert">{t('mod.report.err.reason')}</small>{/if}
      </fieldset>
      <Field label={t('mod.report.details')} id="{uid}-details" hint={t('mod.report.detailsHint')}
        error={touched && (problem === 'details' || problem === 'tooLong') ? t(`mod.report.err.${problem}`, { max: REPORT_DETAILS_MAX }) : null}>
        <textarea id="{uid}-details" bind:value={details} maxlength={REPORT_DETAILS_MAX} rows="5" aria-describedby="{uid}-details-hint"></textarea>
      </Field>
      <Notice kind="info">
        <p class="nomargin">{t('mod.report.notice')}</p>
        <p class="nomargin">{t('mod.report.procedure')}</p>
      </Notice>
      {#if error}<Notice kind="error">{error}</Notice>{/if}
      <div class="row actions">
        <Button type="submit" loading={sending}>{t('mod.report.send')}</Button>
        <Button type="button" variant="ghost" onclick={() => (open = false)}>{t('common.cancel')}</Button>
      </div>
    </form>
  {/if}
</Dialog>

<style>
  .link { background: none; border: 0; padding: 4px 2px; min-height: 32px; color: var(--muted); font-size: 0.85rem; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
  .link:hover { color: var(--accent); }
  .form { display: grid; gap: var(--space-4); }
  fieldset { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: var(--space-3) var(--space-4); margin: 0; display: grid; gap: 2px; }
  legend { font-weight: 600; font-size: 0.9rem; padding: 0 6px; }
  .opt { display: flex; align-items: center; gap: var(--space-2); min-height: 40px; cursor: pointer; }
  .opt input { width: 20px; height: 20px; accent-color: var(--accent); }
  .err { color: var(--danger); font-weight: 500; }
  .nomargin { margin: 0 0 var(--space-2); font-size: 0.9rem; }
  .actions { justify-content: flex-end; }
</style>
