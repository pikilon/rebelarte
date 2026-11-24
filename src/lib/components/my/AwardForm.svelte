<script lang="ts">
  // Premio propio: nombre, año, organismo y descripción. El sello «verificado» lo pone la moderación.
  import { t } from '$lib/i18n';
  import type { Award, I18nText, Lang } from '$lib/types';
  import Button from '$lib/components/ui/Button.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import I18nInput from './I18nInput.svelte';
  import { cleanI18n, hasText } from './logic';
  import type { AwardInput } from '$lib/api/my';

  interface Props {
    award: Award | null;
    origin: Lang;
    busy?: boolean;
    onsave: (input: AwardInput) => void | Promise<void>;
    oncancel: () => void;
  }
  let { award, origin, busy = false, onsave, oncancel }: Props = $props();
  const uid = $props.id();
  /* svelte-ignore state_referenced_locally */
  let name = $state<I18nText>({ ...(award?.name ?? {}) });
  /* svelte-ignore state_referenced_locally */
  let description = $state<I18nText>({ ...(award?.description ?? {}) });
  /* svelte-ignore state_referenced_locally */
  let organization = $state(award?.organization ?? '');
  /* svelte-ignore state_referenced_locally */
  let year = $state(award?.year != null ? String(award.year) : '');
  let errName = $state<string | null>(null);
  let errYear = $state<string | null>(null);
  const lang = $derived(award?.lang ?? origin);

  function submit(e: SubmitEvent) {
    e.preventDefault();
    errName = errYear = null;
    if (!hasText(name, lang)) errName = t('my.cv.errTitle', { lang: t(`lang.${lang}`) });
    const y = year.trim();
    if (y && !(/^\d{4}$/.test(y) && Number(y) >= 1000 && Number(y) <= new Date().getFullYear() + 1)) errYear = t('my.cv.errYear');
    if (errName || errYear) return;
    void onsave({
      name: cleanI18n(name), description: cleanI18n(description), organization: organization.trim() || null,
      year: y ? Number(y) : null, lang
    });
  }
</script>

<form class="stack form" onsubmit={submit} novalidate>
  <I18nInput bind:value={name} origin={lang} label={t('my.cv.awardName')} maxlength={160} error={errName} />
  <div class="two">
    <Field label={t('my.cv.awardOrg')} id="{uid}-o"><input id="{uid}-o" type="text" maxlength="160" bind:value={organization} /></Field>
    <Field label={t('my.cv.awardYear')} id="{uid}-y" error={errYear}><input id="{uid}-y" type="text" inputmode="numeric" maxlength="4" bind:value={year} /></Field>
  </div>
  <I18nInput bind:value={description} origin={lang} label={t('my.cv.description')} multiline rows={3} required={false} maxlength={2000} />
  <div class="row">
    <Button type="submit" loading={busy}>{t('common.save')}</Button>
    <Button type="button" variant="ghost" onclick={oncancel}>{t('common.cancel')}</Button>
  </div>
</form>

<style>
  .form { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: var(--space-4); background: var(--bg); }
  .two { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
</style>
