<script lang="ts">
  import { publicUrl } from '$lib/supabase';
  let { path, name, size = 48 }: { path: string | null | undefined; name: string; size?: number } = $props();
  const src = $derived(publicUrl('avatars', path));
  const initials = $derived(name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join(''));
</script>

{#if src}
  <img class="av" {src} alt="" width={size} height={size} style:width="{size}px" style:height="{size}px" loading="lazy" />
{:else}
  <span class="av ph" aria-hidden="true" style:width="{size}px" style:height="{size}px" style:font-size="{size * 0.38}px">{initials}</span>
{/if}

<style>
  .av { border-radius: 50%; object-fit: cover; flex: none; }
  .ph { display: inline-grid; place-items: center; background: var(--accent-soft); color: var(--accent); font-family: var(--font-display); font-weight: 700; }
</style>
