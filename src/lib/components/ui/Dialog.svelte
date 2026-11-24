<script lang="ts">
  // Diálogo modal accesible sobre <dialog>: foco atrapado y devuelto al cerrar (nativo), Escape, aria-labelledby.
  import type { Snippet } from 'svelte';
  import { t } from '$lib/i18n';

  interface Props {
    open: boolean;
    title: string;
    onclose?: () => void;
    children: Snippet;
  }
  let { open = $bindable(false), title, onclose, children }: Props = $props();
  const uid = $props.id();
  let el: HTMLDialogElement | undefined = $state();

  $effect(() => {
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  });

  function handleClose() {
    open = false;
    onclose?.();
  }
  function backdrop(e: MouseEvent) {
    if (e.target === el) el?.close();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog bind:this={el} aria-labelledby="{uid}-title" onclose={handleClose} onclick={backdrop}>
  {#if open}
    <div class="box">
      <header>
        <h2 id="{uid}-title">{title}</h2>
        <button type="button" class="x" onclick={() => el?.close()} aria-label={t('common.close')}>×</button>
      </header>
      <div class="content">{@render children()}</div>
    </div>
  {/if}
</dialog>

<style>
  dialog {
    border: 0; padding: 0; border-radius: var(--radius); background: var(--surface); color: var(--fg);
    box-shadow: var(--shadow); width: min(560px, calc(100vw - 24px)); max-height: calc(100dvh - 24px);
  }
  dialog::backdrop { background: rgb(20 18 15 / 0.55); }
  .box { padding: var(--space-4) var(--space-4) var(--space-5); }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-3); }
  h2 { margin: 0; font-size: 1.3rem; }
  .x { background: transparent; border: 0; font-size: 1.8rem; line-height: 1; cursor: pointer; padding: 0 6px; min-width: 44px; min-height: 44px; margin: -8px -8px 0 0; color: var(--muted); }
  .x:hover { color: var(--fg); }
  .content { display: grid; gap: var(--space-4); }
  @media (min-width: 720px) { .box { padding: var(--space-5) var(--space-6) var(--space-6); } }
</style>
