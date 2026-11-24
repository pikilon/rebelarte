<script lang="ts">
  import { goto } from '$app/navigation';
  import { currentLang, t } from '$lib/i18n';
  import { url } from '$lib/routes';
  import WorkForm from '$lib/components/my/WorkForm.svelte';

  const lang = $derived(currentLang());
</script>

<svelte:head><title>{t('my.works.new')} · {t('app.name')}</title></svelte:head>

<div class="stack">
  <p><a href={url.my(lang, 'obras')}>← {t('my.nav.works')}</a></p>
  <h1>{t('my.works.new')}</h1>
  <WorkForm work={null} onsaved={(w) => goto(url.my(lang, `obras/${w.id}`), { replaceState: true })} />
</div>

<style>
  h1 { font-size: clamp(1.6rem, 4vw, 2.2rem); }
</style>
