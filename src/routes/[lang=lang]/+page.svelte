<script lang="ts">
  // Portada provisional: la sustituye el agente de páginas públicas.
  import { t } from '$lib/i18n';
</script>

<svelte:head><title>{t('app.name')}</title></svelte:head>
<section class="container"><h1>{t('app.name')}</h1><p>{t('app.tagline')}</p></section>
