<script lang="ts" module>
  import type { BranchId } from '$lib/types';
  export interface Chip { label: string; href: string; active: boolean; color?: string; branch?: BranchId }
</script>

<script lang="ts">
  // Filtros como enlaces (el estado vive en la URL). `color` pinta la rama; `branch` añade su icono.
  import BranchIcon from '$lib/components/ui/BranchIcon.svelte';
  let { label, chips }: { label: string; chips: Chip[] } = $props();
</script>

<nav class="chips" aria-label={label}>
  {#each chips as c (c.href)}
    <a class="chip" class:on={c.active} href={c.href} aria-current={c.active ? 'true' : undefined}
      style:--c={c.color ?? 'var(--fg)'} data-sveltekit-noscroll>{#if c.branch}<BranchIcon branch={c.branch} size={16} />{/if}{c.label}</a>
  {/each}
</nav>

<style>
  .chips { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .chip {
    display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 4px 14px; border-radius: 999px;
    border: 1px solid var(--c); color: var(--c); text-decoration: none; font-size: 0.9rem; font-weight: 500;
    background: transparent;
  }
  .chip:hover { background: color-mix(in srgb, var(--c) 12%, transparent); color: var(--c); }
  .chip.on { background: var(--c); color: var(--bg); }
  .chip.on:hover { color: var(--bg); }
</style>
