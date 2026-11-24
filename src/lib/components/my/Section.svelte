<script lang="ts">
  // Bloque con título para formularios largos.
  import type { Snippet } from 'svelte';
  interface Props { title: string; intro?: string; id?: string; children: Snippet }
  let { title, intro, id, children }: Props = $props();
</script>

<section class="sec" {id} aria-labelledby={id ? `${id}-h` : undefined}>
  <h2 id={id ? `${id}-h` : undefined}>{title}</h2>
  {#if intro}<p class="muted intro">{intro}</p>{/if}
  <div class="body stack">{@render children()}</div>
</section>

<style>
  .sec { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-5) var(--space-4); }
  h2 { font-size: 1.25rem; }
  .intro { margin-top: calc(var(--space-2) * -1); }
  @media (min-width: 720px) { .sec { padding: var(--space-5); } }
</style>
