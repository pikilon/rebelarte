<script lang="ts">
  import { tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { auth } from '$lib/auth.svelte';
  import { currentLang, t } from '$lib/i18n';
  import { url } from '$lib/routes';
  import { LIMITS, type Conversation, type Message, type ProfilePublic } from '$lib/types';
  import {
    deleteConversationForMe, fetchProfiles, fetchWorkBasics, loadConversation, loadMessages,
    markConversationRead, sendMessage, subscribeMessages
  } from '$lib/api/contact';
  import {
    formatDateTime, friendlyContactError, mergeMessage, otherPartyId, pickText, unreadMessages, validateBody
  } from '$lib/contact/logic';
  import ReportButton from '$lib/components/report/ReportButton.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import Tag from '$lib/components/ui/Tag.svelte';

  const uid = $props.id();
  const lang = $derived(currentLang());
  const convId = $derived(page.params.id ?? '');
  const me = $derived(auth.userId);

  let loading = $state(true);
  let notFound = $state(false);
  let error = $state(false);
  let conv = $state<Conversation | null>(null);
  let messages = $state<Message[]>([]);
  let other = $state<ProfilePublic | null>(null);
  let work = $state<{ short_id: string; title: string } | null>(null);

  let reply = $state('');
  let sending = $state(false);
  let sendError = $state<string | null>(null);

  let confirmDelete = $state(false);
  let deleting = $state(false);
  let deleteError = $state(false);

  let endEl: HTMLDivElement | undefined = $state();

  const replyProblem = $derived(validateBody(reply));

  async function scrollToEnd() {
    await tick();
    endEl?.scrollIntoView({ block: 'end' });
  }

  async function markRead(user: string) {
    if (!unreadMessages(messages, user).length) return;
    try {
      await markConversationRead(convId, user);
      messages = messages.map((m) => (m.sender_id !== user && !m.read_at ? { ...m, read_at: new Date().toISOString() } : m));
    } catch {
      /* no es crítico */
    }
  }

  async function load(user: string, id: string) {
    loading = true;
    notFound = false;
    error = false;
    try {
      const c = await loadConversation(id);
      if (!c) { notFound = true; return; }
      conv = c;
      messages = await loadMessages(id);
      const otherId = otherPartyId(c, user);
      const [profiles, works] = await Promise.all([fetchProfiles([otherId]), c.work_id ? fetchWorkBasics([c.work_id]) : Promise.resolve([])]);
      other = profiles[0] ?? null;
      const w = works[0];
      work = w ? { short_id: w.short_id, title: pickText(w.title, lang) } : null;
      await markRead(user);
      await scrollToEnd();
    } catch {
      error = true;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    const user = me;
    const id = convId;
    if (user && id) void load(user, id);
    else if (auth.ready && !user) loading = false;
  });

  // Tiempo real: mensajes nuevos de la conversación abierta. Sin realtime, basta recargar.
  $effect(() => {
    const id = convId;
    const user = me;
    if (!id || !user) return;
    return subscribeMessages(id, (m) => {
      messages = mergeMessage(messages, m);
      if (m.sender_id !== user) void markRead(user);
      void scrollToEnd();
    });
  });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (replyProblem || !me) return;
    sending = true;
    sendError = null;
    try {
      await sendMessage(convId, reply);
      reply = '';
      // Si no hay realtime, recargamos el hilo para ver el mensaje propio.
      messages = await loadMessages(convId);
      await scrollToEnd();
    } catch (err) {
      sendError = t(friendlyContactError(err instanceof Error ? err.message : String(err)));
    } finally {
      sending = false;
    }
  }

  async function remove() {
    if (!conv || !me) return;
    deleting = true;
    deleteError = false;
    try {
      await deleteConversationForMe(conv, me);
      confirmDelete = false;
      await goto(url.my(lang, 'mensajes'));
    } catch {
      deleteError = true;
    } finally {
      deleting = false;
    }
  }
</script>

<svelte:head><title>{conv?.subject ?? t('contact.inbox.title')} · Rebelarte</title></svelte:head>

<div class="container page">
  <p class="back"><a href={url.my(lang, 'mensajes')}>← {t('contact.inbox.title')}</a></p>

  {#if loading}
    <Spinner />
  {:else if notFound}
    <Notice kind="warn">{t('contact.conversation.notFound')}</Notice>
  {:else if error || !conv}
    <Notice kind="error">{t('common.error')}</Notice>
  {:else}
    <header class="head">
      <div class="who">
        <Avatar path={other?.avatar_path} name={other?.display_name ?? '?'} size={52} />
        <div class="whotxt">
          <h1>{conv.subject}</h1>
          <p class="meta">
            {#if other}<a href={url.cv(lang, other.alias)}>{other.display_name}</a>{:else}{t('contact.unknownUser')}{/if}
            <Tag>{t(`contact.kind.${conv.kind}`)}</Tag>
            {#if work}<a href={url.work(lang, work.short_id, work.title)}>{t('contact.aboutWork', { title: work.title || '…' })}</a>{/if}
          </p>
        </div>
      </div>
      <Button variant="danger" size="sm" onclick={() => { deleteError = false; confirmDelete = true; }}>{t('contact.conversation.delete')}</Button>
    </header>

    <ol class="thread" aria-label={t('contact.conversation.thread')}>
      {#each messages as m (m.id)}
        {@const mine = m.sender_id === me}
        <li class="msg" class:mine>
          <div class="bubble">{m.body}</div>
          <div class="info">
            <time datetime={m.created_at}>{formatDateTime(m.created_at, lang)}</time>
            {#if mine && m.read_at}<span>· {t('contact.conversation.read')}</span>{/if}
            {#if !mine}<ReportButton targetType="message" targetId={m.id} />{/if}
          </div>
        </li>
      {/each}
    </ol>
    <div bind:this={endEl}></div>

    <form class="reply" onsubmit={submit} novalidate>
      <label for="{uid}-reply">{t('contact.conversation.reply')}</label>
      <textarea id="{uid}-reply" bind:value={reply} rows="4" maxlength={LIMITS.messageMaxChars} aria-describedby="{uid}-count"></textarea>
      <div class="foot">
        <small id="{uid}-count" class="muted">{reply.length} / {LIMITS.messageMaxChars}</small>
        <Button type="submit" loading={sending} disabled={!!replyProblem}>{t('contact.send')}</Button>
      </div>
      {#if sendError}<Notice kind="error">{sendError}</Notice>{/if}
      <small class="muted">{t('contact.legal.short')}</small>
    </form>

    <Dialog bind:open={confirmDelete} title={t('contact.conversation.deleteTitle')}>
      <p>{t('contact.conversation.deleteBody')}</p>
      {#if deleteError}<Notice kind="error">{t('common.error')}</Notice>{/if}
      <div class="row actions">
        <Button variant="danger" loading={deleting} onclick={remove}>{t('contact.conversation.deleteConfirm')}</Button>
        <Button variant="ghost" onclick={() => (confirmDelete = false)}>{t('common.cancel')}</Button>
      </div>
    </Dialog>
  {/if}
</div>

<style>
  .page { padding-top: var(--space-4); }
  .back { margin: 0 0 var(--space-3); font-size: 0.9rem; }
  .head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: var(--space-3); margin-bottom: var(--space-4); }
  .who { display: flex; gap: var(--space-3); align-items: center; min-width: 0; flex: 1; }
  .whotxt { min-width: 0; }
  h1 { margin: 0; font-size: clamp(1.3rem, 3.5vw, 1.8rem); overflow-wrap: anywhere; }
  .meta { margin: 4px 0 0; display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; font-size: 0.9rem; }
  .thread { list-style: none; margin: 0 0 var(--space-4); padding: 0; display: grid; gap: var(--space-3); }
  .msg { display: grid; gap: 2px; justify-items: start; }
  .msg.mine { justify-items: end; }
  .bubble { max-width: min(560px, 92%); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-3) var(--space-4); white-space: pre-wrap; overflow-wrap: anywhere; }
  .mine .bubble { background: var(--accent-soft); border-color: transparent; }
  .info { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; color: var(--muted); font-size: 0.78rem; }
  .reply { display: grid; gap: var(--space-2); border-top: 1px solid var(--line); padding-top: var(--space-4); }
  .reply label { font-weight: 600; }
  .reply textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface); resize: vertical; min-height: 96px; }
  .foot { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); }
  .actions { justify-content: flex-end; }
</style>
