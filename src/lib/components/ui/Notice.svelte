<script lang="ts">
  import type { Snippet } from 'svelte';
  let { kind = 'info', children }: { kind?: 'info' | 'ok' | 'warn' | 'error'; children: Snippet } = $props();
</script>

<div class="notice {kind}" role={kind === 'error' ? 'alert' : 'status'}>{@render children()}</div>

<style>
  .notice { padding: var(--space-3) var(--space-4); border-radius: var(--radius-sm); border-left: 4px solid var(--line); background: var(--surface-2); }
  .ok { border-color: var(--ok); }
  .warn { border-color: var(--warn); }
  .error { border-color: var(--danger); }
</style>
