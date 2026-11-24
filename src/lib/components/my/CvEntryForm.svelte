<script lang="ts">
  // Formulario de una entrada del CV (alta o edición). El tipo viene fijado por la sección.
  import { t } from '$lib/i18n';
  import type { CvEntry, CvEntryKind, I18nText, Lang, Visibility } from '$lib/types';
  import Button from '$lib/components/ui/Button.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import I18nInput from './I18nInput.svelte';
  import VisibilitySelect from './VisibilitySelect.svelte';
  import { cleanI18n, hasText } from './logic';
  import type { CvEntryInput } from '$lib/api/my';

  interface Props {
    kind: CvEntryKind;
    entry: CvEntry | null;
    origin: Lang;
    busy?: boolean;
    onsave: (input: CvEntryInput) => void | Promise<void>;
    oncancel: () => void;
  }
  let { kind, entry, origin, busy = false, onsave, oncancel }: Props = $props();

  const uid = $props.id();
  /* svelte-ignore state_referenced_locally */
  let title = $state<I18nText>({ ...(entry?.title ?? {}) });
  /* svelte-ignore state_referenced_locally */
  let description = $state<I18nText>({ ...(entry?.description ?? {}) });
  /* svelte-ignore state_referenced_locally */
  let organization = $state(entry?.organization ?? '');
  /* svelte-ignore state_referenced_locally */
  let start = $state(entry?.start_date ?? '');
  /* svelte-ignore state_referenced_locally */
  let end = $state(entry?.end_date ?? '');
  /* svelte-ignore state_referenced_locally */
  let visibility = $state<Visibility>(entry?.visibility ?? 'public');
  let errTitle = $state<string | null>(null);
  let errDates = $state<string | null>(null);

  const withDates = $derived(kind !== 'skill' && kind !== 'material');
  const entryLang = $derived(entry?.lang ?? origin);

  function submit(e: SubmitEvent) {
    e.preventDefault();
    errTitle = errDates = null;
    if (!hasText(title, entryLang)) errTitle = t('my.cv.errTitle', { lang: t(`lang.${entryLang}`) });
    if (withDates && start && end && end < start) errDates = t('my.cv.errDates');
    if (errTitle || errDates) return;
    void onsave({
      kind,
      title: cleanI18n(title),
      description: cleanI18n(description),
      organization: organization.trim() || null,
      start_date: withDates && start ? start : null,
      end_date: withDates && end ? end : null,
      lang: entryLang,
      visibility
    });
  }
</script>

<form class="stack form" onsubmit={submit} novalidate>
  <I18nInput bind:value={title} origin={entryLang} label={t('my.cv.title')} maxlength={160} error={errTitle} />
  <Field label={t('my.cv.organization')} id="{uid}-org"><input id="{uid}-org" type="text" maxlength="160" bind:value={organization} /></Field>
  {#if withDates}
    <div class="two">
      <Field label={t('my.cv.start')} id="{uid}-s"><input id="{uid}-s" type="date" bind:value={start} /></Field>
      <Field label={t('my.cv.end')} id="{uid}-e" hint={t('my.cv.endHint')} error={errDates}><input id="{uid}-e" type="date" bind:value={end} /></Field>
    </div>
  {/if}
  <I18nInput bind:value={description} origin={entryLang} label={t('my.cv.description')} multiline rows={4} required={false} maxlength={2000} />
  <VisibilitySelect bind:value={visibility} label={t('my.cv.visibility')} />
  <div class="row">
    <Button type="submit" loading={busy}>{t('common.save')}</Button>
    <Button type="button" variant="ghost" onclick={oncancel}>{t('common.cancel')}</Button>
  </div>
</form>

<style>
  .form { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: var(--space-4); background: var(--bg); }
  .two { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
</style>
