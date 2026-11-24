<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { currentLang, t } from '$lib/i18n';
  import { url } from '$lib/routes';
  import { loadInbox } from '$lib/api/contact';
  import { formatShort, pickText, type InboxItem } from '$lib/contact/logic';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Empty from '$lib/components/ui/Empty.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import Tag from '$lib/components/ui/Tag.svelte';

  const lang = $derived(currentLang());
  let items = $state<InboxItem[]>([]);
  let loading = $state(true);
  let error = $state(false);

  async function load(me: string) {
    loading = true;
    error = false;
    try {
      items = await loadInbox(me);
    } catch {
      error = true;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    const me = auth.userId;
    if (me) void load(me);
    else if (auth.ready) loading = false;
  });
</script>

<svelte:head><title>{t('contact.inbox.title')} · Rebelarte</title></svelte:head>

<div class="container page">
  <div class="head">
    <h1>{t('contact.inbox.title')}</h1>
    <Button variant="ghost" href={url.my(lang, 'notificaciones')}>{t('contact.notifications.title')}</Button>
  </div>

  {#if loading}
    <Spinner />
  {:else if error}
    <Notice kind="error">{t('common.error')} <Button size="sm" variant="secondary" onclick={() => auth.userId && load(auth.userId)}>{t('contact.retry')}</Button></Notice>
  {:else if !items.length}
    <Empty>{t('contact.inbox.empty')}</Empty>
  {:else}
    <ul class="list">
      {#each items as it (it.conversation.id)}
        <li class:unread={it.unread > 0}>
          <a class="item" href={url.my(lang, `mensajes/${it.conversation.id}`)}>
            <Avatar path={it.other?.avatar_path} name={it.other?.display_name ?? '?'} size={44} />
            <div class="main">
              <div class="top">
                <strong class="name">{it.other?.display_name ?? t('contact.unknownUser')}</strong>
                <time datetime={it.conversation.last_message_at}>{formatShort(it.conversation.last_message_at, lang)}</time>
              </div>
              <div class="subject">{it.conversation.subject}</div>
              <div class="preview">{#if it.lastFromMe}<span class="you">{t('contact.you')}:</span> {/if}{it.preview}</div>
              <div class="meta">
                <Tag>{t(`contact.kind.${it.conversation.kind}`)}</Tag>
                {#if it.work}<span class="work">{t('contact.aboutWork', { title: pickText(it.work.title, lang) || '…' })}</span>{/if}
              </div>
            </div>
            {#if it.unread > 0}<span class="count" aria-label={t('contact.unread', { n: it.unread })}>{it.unread}</span>{/if}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .page { padding-top: var(--space-5); }
  .head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-4); }
  h1 { margin: 0; font-size: clamp(1.6rem, 4vw, 2.2rem); }
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); }
  li { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); }
  li.unread { border-left: 4px solid var(--accent); }
  .item { display: flex; gap: var(--space-3); align-items: flex-start; padding: var(--space-3) var(--space-4); text-decoration: none; color: inherit; min-width: 0; }
  .item:hover { background: var(--surface-2); border-radius: var(--radius); color: inherit; }
  .main { flex: 1; min-width: 0; }
  .top { display: flex; justify-content: space-between; gap: var(--space-3); }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  time { color: var(--muted); font-size: 0.8rem; flex: none; }
  .subject { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  li:not(.unread) .subject { font-weight: 500; }
  .preview { color: var(--muted); font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .you { font-style: italic; }
  .meta { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; margin-top: 6px; font-size: 0.8rem; color: var(--muted); }
  .work { overflow-wrap: anywhere; }
  .count { flex: none; background: var(--accent); color: var(--accent-fg); border-radius: 999px; min-width: 22px; padding: 2px 7px; text-align: center; font-size: 0.8rem; font-weight: 700; }
</style>
