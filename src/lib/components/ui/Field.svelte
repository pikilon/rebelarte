<script lang="ts">
  // Envoltorio de campo: etiqueta, ayuda y error. El control va como children; usa el id recibido.
  import type { Snippet } from 'svelte';
  interface Props { label: string; id: string; hint?: string; error?: string | null; children: Snippet }
  let { label, id, hint, error, children }: Props = $props();
</script>

<div class="field" class:has-error={!!error}>
  <label for={id}>{label}</label>
  {@render children()}
  {#if hint}<small class="hint" id="{id}-hint">{hint}</small>{/if}
  {#if error}<small class="error" role="alert">{error}</small>{/if}
</div>

<style>
  .field { display: grid; gap: 6px; }
  label { font-weight: 600; font-size: 0.9rem; }
  .field :global(input:not([type='checkbox']):not([type='radio'])),
  .field :global(select),
  .field :global(textarea) {
    width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--radius-sm);
    background: var(--surface); min-height: 44px;
  }
  .field :global(textarea) { min-height: 120px; resize: vertical; }
  .hint { color: var(--muted); }
  .error { color: var(--danger); font-weight: 500; }
  .has-error :global(input), .has-error :global(textarea), .has-error :global(select) { border-color: var(--danger); }
</style>
