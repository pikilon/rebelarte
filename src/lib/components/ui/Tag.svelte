<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { BranchId } from '$lib/types';
  let { branch, href, children }: { branch?: BranchId; href?: string; children: Snippet } = $props();
</script>

{#if href}
  <a class="tag" {href} style:--c={branch ? `var(--rama-${branch})` : 'var(--muted)'}>{@render children()}</a>
{:else}
  <span class="tag" style:--c={branch ? `var(--rama-${branch})` : 'var(--muted)'}>{@render children()}</span>
{/if}

<style>
  .tag { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 0.78rem; font-weight: 600;
    color: var(--c); border: 1px solid var(--c); text-decoration: none; line-height: 1.5; }
  a.tag:hover { background: var(--c); color: var(--bg); }
</style>
