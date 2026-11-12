<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md';
    href?: string;
    loading?: boolean;
    children: Snippet;
  }
  let { variant = 'primary', size = 'md', href, loading = false, children, ...rest }: Props = $props();
</script>

{#if href}
  <a class="btn {variant} {size}" {href}>{@render children()}</a>
{:else}
  <button class="btn {variant} {size}" disabled={loading || rest.disabled} aria-busy={loading} {...rest}>
    {#if loading}<span class="spin" aria-hidden="true"></span>{/if}
    {@render children()}
  </button>
{/if}

<style>
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2);
    border: 1px solid transparent; border-radius: 999px; cursor: pointer; text-decoration: none;
    font-weight: 600; line-height: 1; white-space: nowrap; transition: background 0.15s, border-color 0.15s;
  }
  .md { padding: 12px 20px; font-size: 0.95rem; min-height: 44px; }
  .sm { padding: 8px 14px; font-size: 0.85rem; min-height: 34px; }
  .primary { background: var(--accent); color: var(--accent-fg); }
  .primary:hover { filter: brightness(0.95); color: var(--accent-fg); }
  .secondary { background: transparent; border-color: var(--fg); color: var(--fg); }
  .secondary:hover { background: var(--surface-2); color: var(--fg); }
  .ghost { background: transparent; color: var(--fg); }
  .ghost:hover { background: var(--surface-2); color: var(--fg); }
  .danger { background: transparent; border-color: var(--danger); color: var(--danger); }
  .danger:hover { background: var(--danger); color: #fff; }
  .btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .spin { width: 14px; height: 14px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: s 0.7s linear infinite; }
  @keyframes s { to { transform: rotate(360deg); } }
</style>
