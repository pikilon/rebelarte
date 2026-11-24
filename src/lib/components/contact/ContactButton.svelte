<script lang="ts">
  // Botón «Contactar»: abre un diálogo con el formulario de consulta (spec §8). Solo usuarios registrados.
  import { page } from '$app/state';
  import { auth } from '$lib/auth.svelte';
  import { currentLang, t } from '$lib/i18n';
  import { url } from '$lib/routes';
  import { LIMITS, type ContactKind } from '$lib/types';
  import { startConversation } from '$lib/api/contact';
  import {
    CONTACT_KINDS, SUBJECT_MAX, defaultKind, friendlyContactError, validateBody, validateSubject
  } from '$lib/contact/logic';
  import Button from '$lib/components/ui/Button.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';

  let { recipientId, workId = null, recipientName }: { recipientId: string; workId?: string | null; recipientName: string } = $props();

  const uid = $props.id();
  const lang = $derived(currentLang());
  const next = $derived(page.url.pathname + page.url.search);
  let open = $state(false);
  let kind = $state<ContactKind>('commission');
  let subject = $state('');
  let body = $state('');
  let sending = $state(false);
  let error = $state<string | null>(null);
  let touched = $state(false);
  let sentId = $state<string | null>(null);

  const subjectProblem = $derived(validateSubject(subject));
  const bodyProblem = $derived(validateBody(body));
  const isSelf = $derived(auth.userId !== null && auth.userId === recipientId);

  function show() {
    kind = defaultKind(workId);
    error = null;
    touched = false;
    open = true;
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    touched = true;
    if (subjectProblem || bodyProblem) return;
    sending = true;
    error = null;
    try {
      sentId = await startConversation({ recipientId, kind, subject, body, workId });
      subject = '';
      body = '';
    } catch (err) {
      error = t(friendlyContactError(err instanceof Error ? err.message : String(err)));
    } finally {
      sending = false;
    }
  }

  function closed() {
    // Tras el éxito, el siguiente uso empieza limpio.
    if (sentId) sentId = null;
  }
</script>

{#if !isSelf}
  <Button variant="secondary" onclick={show}>{t('contact.button')}</Button>

  <Dialog bind:open title={t('contact.title', { name: recipientName })} onclose={closed}>
    {#if !auth.ready}
      <p class="muted">{t('common.loading')}</p>
    {:else if !auth.session}
      <p>{t('contact.needLogin')}</p>
      <div class="row"><Button href={url.login(lang, next)}>{t('contact.login')}</Button></div>
    {:else if !auth.profile}
      <p>{t('contact.needProfile')}</p>
      <div class="row"><Button href={url.my(lang, 'bienvenida')}>{t('contact.createProfile')}</Button></div>
    {:else if sentId}
      <Notice kind="ok">{t('contact.sent')}</Notice>
      <div class="row">
        <Button href={url.my(lang, `mensajes/${sentId}`)}>{t('contact.viewConversation')}</Button>
        <Button variant="ghost" onclick={() => (open = false)}>{t('common.close')}</Button>
      </div>
    {:else}
      <form class="form" onsubmit={submit} novalidate>
        <Field label={t('contact.kind')} id="{uid}-kind">
          <select id="{uid}-kind" bind:value={kind}>
            {#each CONTACT_KINDS as k}<option value={k}>{t(`contact.kind.${k}`)}</option>{/each}
          </select>
        </Field>
        <Field label={t('contact.subject')} id="{uid}-subject"
          error={touched && subjectProblem ? t(`contact.err.subject.${subjectProblem}`, { max: SUBJECT_MAX }) : null}>
          <input id="{uid}-subject" bind:value={subject} maxlength={SUBJECT_MAX} autocomplete="off" required />
        </Field>
        <Field label={t('contact.body')} id="{uid}-body"
          error={touched && bodyProblem ? t(`contact.err.body.${bodyProblem}`, { max: LIMITS.messageMaxChars }) : null}>
          <textarea id="{uid}-body" bind:value={body} maxlength={LIMITS.messageMaxChars} rows="6" aria-describedby="{uid}-count" required></textarea>
          <small class="count" id="{uid}-count" aria-live="off">{body.length} / {LIMITS.messageMaxChars}</small>
        </Field>
        <Notice kind="info">
          <strong>{t('contact.legal.title')}</strong>
          <p>{t('contact.legal.body')}</p>
          <p class="nomargin">{t('contact.legal.privacy', { name: recipientName })}</p>
        </Notice>
        {#if error}<Notice kind="error">{error}</Notice>{/if}
        <div class="row actions">
          <Button type="submit" loading={sending}>{t('contact.send')}</Button>
          <Button type="button" variant="ghost" onclick={() => (open = false)}>{t('common.cancel')}</Button>
        </div>
      </form>
    {/if}
  </Dialog>
{/if}

<style>
  .form { display: grid; gap: var(--space-4); }
  .count { justify-self: end; color: var(--muted); }
  .nomargin { margin: 0; }
  .form :global(p) { margin: var(--space-2) 0 0; font-size: 0.9rem; }
  .actions { justify-content: flex-end; }
</style>
