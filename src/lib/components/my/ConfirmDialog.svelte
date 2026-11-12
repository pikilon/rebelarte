<script lang="ts">
  // Confirmación para acciones destructivas, con <dialog> nativo (foco atrapado y Escape gratis).
  import { t } from '$lib/i18n';
  import Button from '$lib/components/ui/Button.svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    open: boolean;
    title: string;
    confirmLabel?: string;
    danger?: boolean;
    busy?: boolean;
    onconfirm: () => void | Promise<void>;
    children?: Snippet;
  }
  let { open = $bindable(), title, confirmLabel, danger = true, busy = false, onconfirm, children }: Props = $props();
  let dlg: HTMLDialogElement | undefined = $state();
  const uid = $props.id();

  $effect(() => {
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  });
</script>

<dialog bind:this={dlg} aria-labelledby="{uid}-t" onclose={() => (open = false)} oncancel={() => (open = false)}>
  <h3 id="{uid}-t">{title}</h3>
  {#if children}<div class="msg">{@render children()}</div>{/if}
  <div class="row actions">
    <Button variant="ghost" type="button" onclick={() => (open = false)}>{t('common.cancel')}</Button>
    <Button variant={danger ? 'danger' : 'primary'} type="button" loading={busy} onclick={() => onconfirm()}>{confirmLabel ?? t('common.delete')}</Button>
  </div>
</dialog>

<style>
  dialog { border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); color: var(--fg); padding: var(--space-5); max-width: min(92vw, 440px); box-shadow: var(--shadow); }
  dialog::backdrop { background: rgb(0 0 0 / 0.45); }
  .msg { margin-bottom: var(--space-4); color: var(--muted); }
  .actions { justify-content: flex-end; }
</style>
