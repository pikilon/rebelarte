<script lang="ts">
    import { currentLang, t, tr } from '$lib/i18n';
  import { url } from '$lib/routes';
  import Button from '$lib/components/ui/Button.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import { claimParticipation, getParticipationWork, type WorkRef } from '$lib/api/my';
  import { dbErrorKey } from '$lib/components/my/logic';

  const lang = $derived(currentLang());
  let code = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);
  let done = $state(false);
  let claimed = $state<WorkRef | null>(null);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = null;
    const c = code.trim();
    if (!c) return void (error = t('my.claim.errEmpty'));
    busy = true;
    try {
      const pid = await claimParticipation(c);
      done = true;
      code = '';
      claimed = await getParticipationWork(pid).catch(() => null);
    } catch (err) {
      error = t(dbErrorKey(err));
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>{t('my.nav.claim')} · {t('app.name')}</title></svelte:head>

<div class="stack narrow">
  <h1>{t('my.nav.claim')}</h1>
  <p class="muted">{t('my.claim.intro')}</p>
  <form class="stack" onsubmit={submit} novalidate>
    <Field label={t('my.claim.code')} id="claim-code" hint={t('my.claim.hint')} {error}>
      <input id="claim-code" type="text" bind:value={code} autocomplete="off" autocapitalize="none" spellcheck="false" />
    </Field>
    <div><Button type="submit" loading={busy}>{t('my.claim.submit')}</Button></div>
  </form>
  {#if done}
    <Notice kind="ok">
      <p><strong>{t('my.claim.ok')}</strong></p>
      {#if claimed}
        <p><a href={claimed.status === 'published' ? url.work(lang, claimed.short_id, tr(claimed.title, claimed.lang)) : url.my(lang, 'participaciones')}>{tr(claimed.title, claimed.lang)}</a></p>
      {:else}
        <p><a href={url.my(lang, 'participaciones')}>{t('my.nav.participations')}</a></p>
      {/if}
    </Notice>
  {/if}
</div>

<style>
  .narrow { max-width: 560px; }
  h1 { font-size: clamp(1.6rem, 4vw, 2.2rem); }
</style>
