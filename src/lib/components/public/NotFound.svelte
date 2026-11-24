<script lang="ts">
  // 404 amable para obras, autores y ramas que no existen o no son visibles.
  import { currentLang, t } from '$lib/i18n';
  import { url } from '$lib/routes';
  import Button from '$lib/components/ui/Button.svelte';
  import Meta from './Meta.svelte';

  let { title = '', text = '' }: { title?: string; text?: string } = $props();
  const lang = $derived(currentLang());
</script>

<Meta title={title || t('public.notFound.title')} />
<section class="container nf">
  <p class="eyebrow">404</p>
  <h1>{title || t('public.notFound.title')}</h1>
  <p class="muted">{text || t('public.notFound.text')}</p>
  <div class="row">
    <Button href={url.home(lang)}>{t('public.notFound.home')}</Button>
    <Button href={url.search(lang)} variant="secondary">{t('public.notFound.search')}</Button>
  </div>
</section>

<style>
  .nf { padding-top: var(--space-8); padding-bottom: var(--space-7); max-width: 640px; }
  .nf p { font-size: 1.1rem; }
</style>
