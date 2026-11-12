<script lang="ts" module>
  import type { Award } from '$lib/types';
  export interface AwardItem { award: Award; via?: { title: string; href: string | null } | null }
</script>

<script lang="ts">
  // Premios con sello «verificado». `via` marca los heredados de una obra (premio de la obra X).
  import { t } from '$lib/i18n';
  import LangText from '$lib/components/ui/LangText.svelte';
  let { awards }: { awards: AwardItem[] } = $props();
</script>

<ul class="aw">
  {#each awards as { award, via } (award.id + (via?.href ?? ''))}
    <li>
      <svg class="trophy" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" />
      </svg>
      <div class="body">
        <p class="nm">
          <strong><LangText text={award.name} origin={award.lang} /></strong>
          {#if award.year}<span class="muted">{award.year}</span>{/if}
          {#if award.verified}
            <span class="seal" title={t('public.award.verifiedHint')}>
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
              {t('public.award.verified')}
            </span>
          {/if}
        </p>
        {#if award.organization}<p class="muted sm">{award.organization}</p>{/if}
        {#if via}
          <p class="sm via">
            {#if via.href}{t('public.award.viaWork')} <a href={via.href}>{via.title}</a>{:else}{t('public.award.viaWorkAnon')}{/if}
          </p>
        {/if}
        <div class="sm"><LangText text={award.description} origin={award.lang} multiline /></div>
      </div>
    </li>
  {/each}
</ul>

<style>
  .aw { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-4); }
  li { display: flex; gap: var(--space-3); align-items: flex-start; }
  .trophy { color: var(--accent); flex: none; margin-top: 2px; }
  .body { min-width: 0; }
  p { margin: 0; }
  .nm { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px var(--space-2); overflow-wrap: anywhere; }
  .sm { font-size: 0.9rem; }
  .via { color: var(--muted); }
  .seal { display: inline-flex; align-items: center; gap: 3px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
    color: var(--ok); border: 1px solid var(--ok); border-radius: 999px; padding: 1px 8px 1px 6px; }
</style>
