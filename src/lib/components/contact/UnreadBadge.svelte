<script lang="ts">
  // Contador de no leídos (mensajes y/o avisos). Se recuenta al montar, al llegar un mensaje nuevo
  // (realtime) y cuando alguna página marca algo como leído. Sin sesión no pinta nada.
  import { onMount } from 'svelte';
  import { auth } from '$lib/auth.svelte';
  import { supabase } from '$lib/supabase';
  import { t } from '$lib/i18n';
  import { countUnreadMessages, countUnreadNotifications, onUnreadChanged } from '$lib/api/contact';

  let { kind = 'messages' }: { kind?: 'messages' | 'notifications' | 'all' } = $props();
  let count = $state(0);

  async function refresh() {
    const me = auth.userId;
    if (!me) { count = 0; return; }
    try {
      const [m, n] = await Promise.all([
        kind === 'notifications' ? 0 : countUnreadMessages(me),
        kind === 'messages' ? 0 : countUnreadNotifications(me)
      ]);
      count = m + n;
    } catch {
      /* el indicador es opcional: si falla, no se muestra */
    }
  }

  $effect(() => {
    void auth.userId;
    void refresh();
  });

  onMount(() => {
    const off = onUnreadChanged(() => void refresh());
    const channel = supabase
      .channel(`unread:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => void refresh())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => void refresh())
      .subscribe();
    return () => {
      off();
      void supabase.removeChannel(channel);
    };
  });
</script>

{#if count > 0}
  <span class="badge" role="status" aria-label={t('contact.unread', { n: count })}>{count > 99 ? '99+' : count}</span>
{/if}

<style>
  .badge { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: var(--accent); color: var(--accent-fg); font-size: 0.7rem; font-weight: 700; line-height: 1; margin-left: 4px; }
</style>
