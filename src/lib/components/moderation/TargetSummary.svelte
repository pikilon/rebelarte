<script lang="ts">
  // Objetivo de una denuncia o acción, resuelto a algo legible con enlace.
  import { currentLang, t } from '$lib/i18n';
  import { url } from '$lib/routes';
  import { pickText } from '$lib/contact/logic';
  import type { ResolvedTarget } from '$lib/api/moderation';
  import type { ReportTarget } from '$lib/types';
  import Tag from '$lib/components/ui/Tag.svelte';

  let { type, id, target }: { type: ReportTarget; id: string; target?: ResolvedTarget } = $props();
  const lang = $derived(currentLang());
  const title = $derived(target?.title ? pickText(target.title, lang) : '');
</script>

<div class="t">
  <Tag>{t(`mod.target.${type}`)}</Tag>
  {#if !target || !target.found}
    <span class="muted">{t('mod.target.unavailable')} <code>{id.slice(0, 8)}</code></span>
  {:else if type === 'work' || type === 'attachment'}
    <span>
      {#if type === 'attachment'}<span class="muted">{target.extra}</span> — {/if}
      {#if target.workShortId}<a href={url.work(lang, target.workShortId, title)}>{title || target.workShortId}</a>{:else}{title}{/if}
      {#if target.ownerAlias}<span class="muted"> · <a href={url.cv(lang, target.ownerAlias)}>@{target.ownerAlias}</a></span>{/if}
      {#if target.status && target.status !== 'published'}<span class="st">{t(`mod.workStatus.${target.status}`)}</span>{/if}
    </span>
  {:else if type === 'profile'}
    <span>{#if target.alias}<a href={url.cv(lang, target.alias)}>{target.text ?? target.alias}</a> <span class="muted">@{target.alias}</span>{/if}</span>
  {:else if type === 'message'}
    <span class="quote">«{target.text}»
      {#if target.ownerAlias}<span class="muted"> — <a href={url.cv(lang, target.ownerAlias)}>@{target.ownerAlias}</a></span>{/if}</span>
  {:else if type === 'award'}
    <span>{title}{#if target.extra} <span class="muted">({target.extra})</span>{/if}
      {#if target.status === 'verified'}<span class="st">{t('mod.award.verified')}</span>{/if}</span>
  {/if}
</div>

<style>
  .t { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-2); min-width: 0; overflow-wrap: anywhere; }
  .quote { font-style: italic; }
  .st { font-size: 0.75rem; border: 1px solid var(--warn); color: var(--warn); border-radius: 999px; padding: 1px 8px; margin-left: 4px; }
  code { font-size: 0.8rem; }
</style>
