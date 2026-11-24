<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { BranchId } from '$lib/types';
  import BranchIcon from './BranchIcon.svelte';
  let { branch, href, icon = false, children }: { branch?: BranchId; href?: string; icon?: boolean; children: Snippet } = $props();
  const c = $derived(branch ? `var(--rama-${branch})` : 'var(--muted)');
</script>

{#if href}
  <a class="tag" {href} style:--c={c}>{#if icon && branch}<BranchIcon {branch} size={15} />{/if}{@render children()}</a>
{:else}
  <span class="tag" style:--c={c}>{#if icon && branch}<BranchIcon {branch} size={15} />{/if}{@render children()}</span>
{/if}

<style>
  .tag {
    display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px; border-radius: 999px; font-size: 0.8rem; font-weight: 600;
    color: var(--c); background: color-mix(in srgb, var(--c) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--c) 35%, transparent); text-decoration: none; line-height: 1.4;
  }
  a.tag:hover { background: var(--c); color: var(--bg); border-color: var(--c); }
</style>
