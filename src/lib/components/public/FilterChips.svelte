<script lang="ts" module>
  export interface Chip { label: string; href: string; active: boolean; color?: string }
</script>

<script lang="ts">
  // Filtros como enlaces (el estado vive en la URL). `color` pinta la rama.
  let { label, chips }: { label: string; chips: Chip[] } = $props();
</script>

<nav class="chips" aria-label={label}>
  {#each chips as c (c.href)}
    <a class="chip" class:on={c.active} href={c.href} aria-current={c.active ? 'true' : undefined}
      style:--c={c.color ?? 'var(--fg)'} data-sveltekit-noscroll>{c.label}</a>
  {/each}
</nav>

<style>
  .chips { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .chip {
    display: inline-flex; align-items: center; min-height: 36px; padding: 4px 14px; border-radius: 999px;
    border: 1px solid var(--c); color: var(--c); text-decoration: none; font-size: 0.9rem; font-weight: 500;
    background: transparent;
  }
  .chip:hover { background: color-mix(in srgb, var(--c) 12%, transparent); color: var(--c); }
  .chip.on { background: var(--c); color: var(--bg); }
  .chip.on:hover { color: var(--bg); }
</style>
