<script lang="ts">
  // Título y descripción de la página. La SPA no genera Open Graph: lo inyecta la capa PHP.
  let { title, description = '' }: { title: string; description?: string } = $props();
  const full = $derived(title ? `${title} · Rebelarte` : 'Rebelarte');

  // La plantilla (app.html) trae una meta description por defecto: se desactiva mientras esta página está montada.
  $effect(() => {
    const defaults = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="description"]:not([data-rb])'));
    for (const m of defaults) m.setAttribute('name', 'description-default');
    return () => {
      for (const m of defaults) m.setAttribute('name', 'description');
    };
  });
</script>

<svelte:head>
  <title>{full}</title>
  {#if description}<meta name="description" content={description} data-rb />{/if}
</svelte:head>
