<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onDestroy } from 'svelte';
  import { auth } from '$lib/auth.svelte';
  import { LANGS, currentLang, t } from '$lib/i18n';
  import { url } from '$lib/routes';
  import type { Lang } from '$lib/types';
  import Button from '$lib/components/ui/Button.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import { aliasAvailable } from '$lib/api/my';
  import { aliasProblem, dbErrorKey, normalizeAlias, safeNext, suggestAlias } from '$lib/components/my/logic';

  const lang = $derived(currentLang());
  const next = $derived(safeNext(page.url.searchParams.get('next')));

  let name = $state('');
  let alias = $state('');
  let aliasTouched = false;
  // svelte-ignore state_referenced_locally
  let origin = $state<Lang>(lang);
  let terms = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let availability = $state<'idle' | 'checking' | 'free' | 'taken' | 'unknown'>('idle');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let seq = 0;

  const normalized = $derived(normalizeAlias(alias));
  const problem = $derived(aliasProblem(alias));

  // Ya tiene perfil: no hay nada que hacer aquí.
  $effect(() => {
    if (auth.ready && auth.profile) void goto(next ?? url.my(lang), { replaceState: true });
  });

  function onName() {
    if (!aliasTouched) alias = suggestAlias(name);
  }

  $effect(() => {
    const a = normalized;
    clearTimeout(timer);
    if (aliasProblem(a)) {
      availability = 'idle';
      return;
    }
    availability = 'checking';
    const mine = ++seq;
    timer = setTimeout(async () => {
      try {
        const free = await aliasAvailable(a);
        if (mine === seq) availability = free ? 'free' : 'taken';
      } catch {
        if (mine === seq) availability = 'unknown';
      }
    }, 350);
  });
  onDestroy(() => clearTimeout(timer));

  const aliasError = $derived(
    alias && problem ? t(`my.welcome.alias.${problem}`) : availability === 'taken' ? t('my.welcome.alias.taken') : null
  );

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = null;
    if (!name.trim() || problem || availability === 'taken' || !terms) {
      error = t('my.welcome.errIncomplete');
      return;
    }
    busy = true;
    try {
      await auth.createProfile(normalized, name.trim(), origin);
      await goto(next ?? url.my(lang), { replaceState: true });
    } catch (err) {
      const key = dbErrorKey(err);
      if (key === 'my.err.duplicate') availability = 'taken';
      error = key === 'my.err.duplicate' ? t('my.welcome.alias.taken') : t(key);
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>{t('my.welcome.title')} · {t('app.name')}</title></svelte:head>

<section class="container narrow">
  <div class="card stack">
    <p class="eyebrow">{t('my.welcome.eyebrow')}</p>
    <h1>{t('my.welcome.title')}</h1>
    <p class="muted">{t('my.welcome.lead')}</p>
    <form class="stack" onsubmit={submit} novalidate>
      <Field label={t('my.welcome.name')} id="w-name" hint={t('my.welcome.nameHint')}>
        <input id="w-name" type="text" maxlength="80" autocomplete="name" required bind:value={name} oninput={onName} />
      </Field>
      <Field label={t('my.welcome.alias')} id="w-alias" hint={t('my.welcome.aliasHint')} error={aliasError}>
        <input id="w-alias" type="text" maxlength="30" autocomplete="off" autocapitalize="none" spellcheck="false" required
          aria-invalid={aliasError ? 'true' : undefined} aria-describedby="w-alias-hint w-alias-status"
          bind:value={alias} oninput={() => (aliasTouched = true)} />
      </Field>
      <div id="w-alias-status" aria-live="polite" class="status">
        {#if availability === 'checking'}<span class="muted">{t('my.welcome.alias.checking')}</span>
        {:else if availability === 'free'}<span class="ok">✓ {t('my.welcome.alias.free')}</span>
        {:else if availability === 'unknown'}<span class="muted">{t('my.welcome.alias.unknown')}</span>{/if}
      </div>
      <p class="preview" aria-label={t('my.welcome.preview')}>
        <span class="muted">{t('my.welcome.preview')}</span><br />
        <code>rebelarte.com/{origin}/<strong>{normalized || '…'}</strong></code>
      </p>
      <Field label={t('my.welcome.lang')} id="w-lang" hint={t('my.welcome.langHint')}>
        <select id="w-lang" bind:value={origin}>
          {#each LANGS as l}<option value={l}>{t(`lang.${l}`)}</option>{/each}
        </select>
      </Field>
      <label class="terms">
        <input type="checkbox" bind:checked={terms} required />
        <span>{t('my.welcome.termsPre')} <a href={url.legal(lang, 'condiciones')} target="_blank" rel="noopener">{t('my.welcome.termsLink')}</a> {t('my.welcome.termsPost')}</span>
      </label>
      {#if error}<Notice kind="error">{error}</Notice>{/if}
      <Button type="submit" loading={busy} disabled={!terms}>{t('my.welcome.create')}</Button>
    </form>
  </div>
</section>

<style>
  .narrow { max-width: 560px; padding-top: var(--space-6); }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-5) var(--space-4); box-shadow: var(--shadow); }
  .status { min-height: 1.4em; font-size: 0.88rem; margin-top: calc(var(--space-3) * -1); }
  .ok { color: var(--ok); font-weight: 600; }
  .preview { background: var(--surface-2); border-radius: var(--radius-sm); padding: var(--space-3); margin: 0; font-size: 0.9rem; overflow-wrap: anywhere; }
  code { font-family: ui-monospace, monospace; }
  .terms { display: flex; gap: var(--space-3); align-items: flex-start; font-size: 0.92rem; }
  .terms input { margin-top: 4px; width: 20px; height: 20px; flex: none; }
  @media (min-width: 720px) { .card { padding: var(--space-6); } }
</style>
