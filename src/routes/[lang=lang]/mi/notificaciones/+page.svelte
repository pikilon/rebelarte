<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { currentLang, t } from '$lib/i18n';
  import { url } from '$lib/routes';
  import type { Notification as Notif } from '$lib/types';
  import { NOTIFICATIONS_PAGE, loadNotifications, markAllNotificationsRead, markNotificationRead } from '$lib/api/contact';
  import { formatDateTime } from '$lib/contact/logic';
  import { countUnreadNotifications, describeNotification } from '$lib/contact/notifications';
  import Button from '$lib/components/ui/Button.svelte';
  import Empty from '$lib/components/ui/Empty.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';

  const lang = $derived(currentLang());
  let items = $state<Notif[]>([]);
  let loading = $state(true);
  let loadingMore = $state(false);
  let hasMore = $state(false);
  let error = $state(false);
  let marking = $state(false);

  const unread = $derived(countUnreadNotifications(items));

  async function load(me: string) {
    loading = true;
    error = false;
    try {
      const rows = await loadNotifications(me, 0);
      items = rows;
      hasMore = rows.length === NOTIFICATIONS_PAGE;
    } catch {
      error = true;
    } finally {
      loading = false;
    }
  }

  async function more() {
    if (!auth.userId) return;
    loadingMore = true;
    try {
      const rows = await loadNotifications(auth.userId, items.length);
      items = [...items, ...rows];
      hasMore = rows.length === NOTIFICATIONS_PAGE;
    } catch {
      error = true;
    } finally {
      loadingMore = false;
    }
  }

  async function read(n: Notif) {
    if (n.read_at) return;
    const now = new Date().toISOString();
    items = items.map((x) => (x.id === n.id ? { ...x, read_at: now } : x));
    try {
      await markNotificationRead(n.id);
    } catch {
      items = items.map((x) => (x.id === n.id ? { ...x, read_at: null } : x));
    }
  }

  async function readAll() {
    if (!auth.userId) return;
    marking = true;
    try {
      await markAllNotificationsRead(auth.userId);
      const now = new Date().toISOString();
      items = items.map((x) => (x.read_at ? x : { ...x, read_at: now }));
    } catch {
      error = true;
    } finally {
      marking = false;
    }
  }

  $effect(() => {
    const me = auth.userId;
    if (me) void load(me);
    else if (auth.ready) loading = false;
  });
</script>

<svelte:head><title>{t('contact.notifications.title')} · Rebelarte</title></svelte:head>

<div class="container page">
  <div class="head">
    <h1>{t('contact.notifications.title')}</h1>
    <Button variant="secondary" size="sm" loading={marking} disabled={unread === 0} onclick={readAll}>{t('contact.notifications.markAll')}</Button>
  </div>

  {#if loading}
    <Spinner />
  {:else if error && !items.length}
    <Notice kind="error">{t('common.error')} <Button size="sm" variant="secondary" onclick={() => auth.userId && load(auth.userId)}>{t('contact.retry')}</Button></Notice>
  {:else if !items.length}
    <Empty>{t('contact.notifications.empty')}</Empty>
  {:else}
    {#if error}<Notice kind="error">{t('common.error')}</Notice>{/if}
    <ul class="list">
      {#each items as n (n.id)}
        {@const v = describeNotification(n, lang)}
        {@const text = t(v.key, { actor: v.actor ?? t('contact.notif.someone'), work: v.work ?? t('contact.notif.aWork') })}
        <li class:unread={!n.read_at}>
          {#if v.href}
            <a class="item" href={v.href} onclick={() => read(n)}>
              <span class="dot" aria-hidden="true"></span>
              <span class="txt">{#if !n.read_at}<span class="sr-only">{t('contact.notifications.unread')}: </span>{/if}{text}</span>
              <time datetime={n.created_at}>{formatDateTime(n.created_at, lang)}</time>
            </a>
          {:else}
            <div class="item">
              <span class="dot" aria-hidden="true"></span>
              <span class="txt">{#if !n.read_at}<span class="sr-only">{t('contact.notifications.unread')}: </span>{/if}{text}</span>
              <time datetime={n.created_at}>{formatDateTime(n.created_at, lang)}</time>
              {#if !n.read_at}<Button size="sm" variant="ghost" onclick={() => read(n)}>{t('contact.notifications.markOne')}</Button>{/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
    {#if hasMore}
      <div class="row more"><Button variant="secondary" loading={loadingMore} onclick={more}>{t('common.more')}</Button></div>
    {/if}
  {/if}
  <p class="back"><a href={url.my(lang, 'mensajes')}>{t('contact.inbox.title')}</a></p>
</div>

<style>
  .page { padding-top: var(--space-5); }
  .head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-4); }
  h1 { margin: 0; font-size: clamp(1.6rem, 4vw, 2.2rem); }
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
  li { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); }
  .item { display: grid; grid-template-columns: 10px 1fr; column-gap: var(--space-3); row-gap: 2px; align-items: start; padding: var(--space-3) var(--space-4); text-decoration: none; color: inherit; }
  a.item:hover { background: var(--surface-2); border-radius: var(--radius); color: inherit; }
  .dot { width: 10px; height: 10px; border-radius: 50%; margin-top: 7px; background: transparent; }
  .unread .dot { background: var(--accent); }
  .unread .txt { font-weight: 600; }
  .txt { overflow-wrap: anywhere; }
  time { grid-column: 2; color: var(--muted); font-size: 0.8rem; }
  .item :global(.btn) { grid-column: 2; justify-self: start; }
  .more { justify-content: center; margin-top: var(--space-4); }
  .back { margin-top: var(--space-5); font-size: 0.9rem; }
</style>
