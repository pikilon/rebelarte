<script lang="ts">
  // Logo de Rebelarte: reinterpretación del Atlas original (figura que sostiene un
  // globo con película y espiral) en trazo plano. Usa los colores del tema.
  import { logoMarkSvg } from '$lib/brand';
  let { size = 36, wordmark = true, tagline }: { size?: number; wordmark?: boolean; tagline?: string } = $props();
  const mark = logoMarkSvg('var(--brand)', 'var(--brand-ink)', 'var(--bg)');
</script>

<span class="logo" style:--s="{size}px">
  <svg class="mark" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">{@html mark}</svg>
  {#if wordmark}
    <span class="words">
      <span class="name">Rebelarte</span>
      {#if tagline}<span class="tag">{tagline}</span>{/if}
    </span>
  {/if}
</span>

<style>
  .logo { display: inline-flex; align-items: center; gap: calc(var(--s) * 0.22); color: var(--fg); }
  .mark { flex: none; display: block; overflow: visible; }
  .words { display: grid; line-height: 1; }
  .name { font-family: var(--font-display); font-weight: 800; font-size: calc(var(--s) * 0.66); letter-spacing: -0.04em; }
  .tag { font-size: 0.7rem; color: var(--muted); font-weight: 500; margin-top: 3px; letter-spacing: 0.01em; }
</style>
