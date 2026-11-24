<script lang="ts">
  // Iconos de rama (ver $lib/brand). badge = insignia de color vivo con icono blanco.
  import { BRANCH_ICON_PATHS } from '$lib/brand';
  import type { BranchId } from '$lib/types';
  let {
    branch,
    size = 24,
    badge = false,
    label
  }: { branch: BranchId; size?: number; badge?: boolean; label?: string } = $props();
</script>

{#if badge}
  <span class="badge" style:--c="var(--rama-{branch}-vivid)" style:width="{size}px" style:height="{size}px"
    role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
    <svg viewBox="0 0 24 24" width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} fill="none" stroke="currentColor"
      stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{@html BRANCH_ICON_PATHS[branch]}</svg>
  </span>
{:else}
  <svg class="icon" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" role={label ? 'img' : undefined} aria-label={label}
    aria-hidden={label ? undefined : 'true'}>{@html BRANCH_ICON_PATHS[branch]}</svg>
{/if}

<style>
  .icon { flex: none; display: inline-block; vertical-align: middle; }
  .badge {
    flex: none; display: inline-grid; place-items: center; color: #fff; background: var(--c);
    border-radius: 30%; box-shadow: inset 0 -2px 0 rgb(0 0 0 / 0.12);
  }
  .badge svg { display: block; }
</style>
