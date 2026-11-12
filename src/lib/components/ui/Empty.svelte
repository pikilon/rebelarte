<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '$lib/i18n';
  let { children }: { children?: Snippet } = $props();
</script>

<div class="empty">{#if children}{@render children()}{:else}{t('common.empty')}{/if}</div>

<style>
  .empty { padding: var(--space-7) var(--space-4); text-align: center; color: var(--muted); border: 1px dashed var(--line); border-radius: var(--radius); }
</style>
