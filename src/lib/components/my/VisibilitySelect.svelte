<script lang="ts">
  // Selector de visibilidad (público / registrados / privado) con etiqueta oculta o visible.
  import { t } from '$lib/i18n';
  import type { Visibility } from '$lib/types';
  interface Props { value: Visibility; label: string; compact?: boolean }
  let { value = $bindable(), label, compact = false }: Props = $props();
  const uid = $props.id();
  const options: Visibility[] = ['public', 'registered', 'private'];
</script>

<div class="vis" class:compact>
  <label for={uid} class:sr-only={compact}>{label}</label>
  <select id={uid} bind:value>
    {#each options as o}<option value={o}>{t(`visibility.${o}`)}</option>{/each}
  </select>
</div>

<style>
  .vis { display: grid; gap: 6px; }
  label { font-weight: 600; font-size: 0.9rem; }
  select { padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface); min-height: 40px; max-width: 100%; }
  .compact select { font-size: 0.85rem; }
</style>
