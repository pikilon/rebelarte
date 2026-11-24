<script lang="ts">
  // Muestra un texto traducible en el idioma actual; si cae al original, avisa (especificación §7).
  import { currentLang, t, trText } from '$lib/i18n';
  import type { I18nText, Lang } from '$lib/types';
  let { text, origin, multiline = false }: { text: I18nText | null | undefined; origin?: Lang; multiline?: boolean } = $props();
  const r = $derived(trText(text, currentLang(), origin));
</script>

{#if r.text}
  {#if multiline}
    <div class="ml" lang={r.lang ?? undefined}>{r.text}</div>
  {:else}
    <span lang={r.lang ?? undefined}>{r.text}</span>
  {/if}
  {#if r.fallback && r.lang}
    <small class="fb">{t('common.fallbackNotice', { lang: t(`lang.${r.lang}`) })}</small>
  {/if}
{/if}

<style>
  .ml { white-space: pre-line; }
  .fb { display: block; color: var(--muted); font-style: italic; font-size: 0.8rem; margin-top: 2px; }
</style>
